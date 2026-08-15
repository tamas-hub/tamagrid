use std::{
    env,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{ipc::Channel, AppHandle, State};
use tokio::{
    sync::Mutex,
    time::{sleep, sleep_until, Instant},
};

use super::{
    protocol::AppServerEvent,
    transport::{AppServerTransport, StdioTransport},
};

const SOAK_GENERATION: u64 = 1;
const SOAK_TURN_ID: &str = "tamagrid-packaged-soak-turn";
const SOAK_ITEM_ID: &str = "tamagrid-packaged-soak-item";
const DELTA_INTERVAL_MS: u64 = 20;
const DELTA_BYTES: usize = 256;
const MIN_DURATION_MS: u64 = 1_000;
const MAX_DURATION_MS: u64 = 600_000;
const MAX_REPORT_BYTES: usize = 64 * 1024;
const RESULT_PATH_ENV: &str = "TAMAGRID_SOAK_RESULT_PATH";
const PROCESS_TREE_FIXTURE_PATH_ENV: &str = "TAMAGRID_SOAK_PROCESS_TREE_FIXTURE_PATH";
const PROCESS_TREE_RESULT_PATH_ENV: &str = "TAMAGRID_SOAK_PROCESS_TREE_RESULT_PATH";

static SOAK_STARTED: AtomicBool = AtomicBool::new(false);

#[derive(Default)]
pub struct ProcessTreeProbeState {
    transport: Mutex<Option<Arc<StdioTransport>>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProtocolSoakParams {
    thread_id: String,
    duration_ms: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProtocolSoakDescriptor {
    duration_ms: u64,
    delta_events: u64,
    delta_bytes_per_event: usize,
    expected_delta_bytes: u64,
    expected_last_sequence: u64,
    thread_id: String,
    turn_id: &'static str,
    item_id: &'static str,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn run_protocol_soak(
    app: AppHandle,
    on_event: Channel<AppServerEvent>,
    params: ProtocolSoakParams,
    process_tree_probe: State<'_, ProcessTreeProbeState>,
) -> Result<Value, String> {
    if params.thread_id.trim().is_empty() || params.thread_id.len() > 512 {
        return Err("The packaged soak thread id is invalid".into());
    }
    if !(MIN_DURATION_MS..=MAX_DURATION_MS).contains(&params.duration_ms) {
        return Err(format!(
            "The packaged soak duration must be between {MIN_DURATION_MS} and {MAX_DURATION_MS} ms"
        ));
    }
    if SOAK_STARTED.swap(true, Ordering::SeqCst) {
        return Err("The packaged soak test can run only once per process".into());
    }

    let delta_events = (params.duration_ms / DELTA_INTERVAL_MS).max(1);
    let duration_ms = delta_events * DELTA_INTERVAL_MS;
    let descriptor = ProtocolSoakDescriptor {
        duration_ms,
        delta_events,
        delta_bytes_per_event: DELTA_BYTES,
        expected_delta_bytes: delta_events * DELTA_BYTES as u64,
        // turn/started + item/started + deltas + item/completed +
        // thread/status/changed + turn/completed + soakComplete diagnostic.
        expected_last_sequence: delta_events + 6,
        thread_id: params.thread_id.clone(),
        turn_id: SOAK_TURN_ID,
        item_id: SOAK_ITEM_ID,
    };

    if env::var_os(PROCESS_TREE_FIXTURE_PATH_ENV).is_some() {
        start_process_tree_crash_probe(&on_event, process_tree_probe.inner()).await?;
        // The outer runner terminates this Tauri process after the fixture has
        // reported both PIDs. Do not emit a terminal event or arm the normal
        // renderer timeout in this deliberately interrupted run.
        return Ok(json!({
            "turn": {
                "id": SOAK_TURN_ID,
                "status": "inProgress",
                "items": [],
                "error": null
            },
            "soak": descriptor
        }));
    }

    let task_descriptor = descriptor.clone();
    let task_app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = emit_protocol_soak(&on_event, &task_descriptor).await {
            write_failure_and_exit(&task_app, &error);
            return;
        }

        // The renderer normally writes the detailed result and exits first.
        // If it becomes unresponsive after receiving the terminal event, leave
        // a bounded failure record instead of hanging the test runner forever.
        sleep(Duration::from_secs(30)).await;
        if result_path().is_ok_and(|path| !path.exists()) {
            write_failure_and_exit(
                &task_app,
                "The WebView did not report the packaged soak result within 30 seconds",
            );
        }
    });

    Ok(json!({
        "turn": {
            "id": SOAK_TURN_ID,
            "status": "inProgress",
            "items": [],
            "error": null
        },
        "soak": descriptor
    }))
}

#[tauri::command]
pub fn complete_protocol_soak(app: AppHandle, report: Value) -> Result<(), String> {
    let passed = report
        .get("passed")
        .and_then(Value::as_bool)
        .ok_or_else(|| {
            "The packaged soak report must contain a boolean passed field".to_string()
        })?;
    let bytes = serde_json::to_vec_pretty(&report)
        .map_err(|error| format!("Could not encode the packaged soak report: {error}"))?;
    if bytes.len() > MAX_REPORT_BYTES {
        return Err("The packaged soak report is too large".into());
    }
    write_result_bytes(&bytes)?;

    tauri::async_runtime::spawn(async move {
        sleep(Duration::from_millis(150)).await;
        app.exit(if passed { 0 } else { 1 });
    });
    Ok(())
}

async fn emit_protocol_soak(
    channel: &Channel<AppServerEvent>,
    descriptor: &ProtocolSoakDescriptor,
) -> Result<(), String> {
    // Let turn/start return first. App Server notifications are allowed to race
    // responses, but this delay makes the renderer result easier to diagnose
    // without weakening the sequence/order assertions.
    sleep(Duration::from_millis(100)).await;

    let mut sequence = 0;
    let started_at_ms = unix_time_ms();
    send_message(
        channel,
        &mut sequence,
        json!({
            "method": "turn/started",
            "params": {
                "threadId": descriptor.thread_id,
                "turn": {
                    "id": SOAK_TURN_ID,
                    "status": "inProgress",
                    "items": [],
                    "error": null
                }
            }
        }),
    )?;
    send_message(
        channel,
        &mut sequence,
        json!({
            "method": "item/started",
            "params": {
                "threadId": descriptor.thread_id,
                "turnId": SOAK_TURN_ID,
                "startedAtMs": started_at_ms,
                "item": {
                    "id": SOAK_ITEM_ID,
                    "type": "agentMessage",
                    "text": "",
                    "phase": "finalAnswer"
                }
            }
        }),
    )?;

    let delta = "0123456789abcdef".repeat(DELTA_BYTES / 16);
    let started = Instant::now();
    for index in 0..descriptor.delta_events {
        sleep_until(started + Duration::from_millis((index + 1).saturating_mul(DELTA_INTERVAL_MS)))
            .await;
        send_message(
            channel,
            &mut sequence,
            json!({
                "method": "item/agentMessage/delta",
                "params": {
                    "threadId": descriptor.thread_id,
                    "turnId": SOAK_TURN_ID,
                    "itemId": SOAK_ITEM_ID,
                    "delta": delta
                }
            }),
        )?;
    }

    let completed_at_ms = unix_time_ms();
    let final_text = delta.repeat(descriptor.delta_events as usize);
    send_message(
        channel,
        &mut sequence,
        json!({
            "method": "item/completed",
            "params": {
                "threadId": descriptor.thread_id,
                "turnId": SOAK_TURN_ID,
                "completedAtMs": completed_at_ms,
                "item": {
                    "id": SOAK_ITEM_ID,
                    "type": "agentMessage",
                    "text": final_text,
                    "phase": "finalAnswer"
                }
            }
        }),
    )?;
    send_message(
        channel,
        &mut sequence,
        json!({
            "method": "thread/status/changed",
            "params": {
                "threadId": descriptor.thread_id,
                "status": { "type": "idle" }
            }
        }),
    )?;
    send_message(
        channel,
        &mut sequence,
        json!({
            "method": "turn/completed",
            "params": {
                "threadId": descriptor.thread_id,
                "turn": {
                    "id": SOAK_TURN_ID,
                    "status": "completed",
                    "items": [],
                    "error": null
                }
            }
        }),
    )?;
    sequence += 1;
    channel
        .send(AppServerEvent::diagnostic(
            SOAK_GENERATION,
            sequence,
            "soakComplete",
            format!(
                "deltaEvents={};deltaBytes={}",
                descriptor.delta_events, descriptor.expected_delta_bytes
            ),
        ))
        .map_err(|error| format!("Could not deliver the soak completion event: {error}"))?;

    if sequence != descriptor.expected_last_sequence {
        return Err(format!(
            "The packaged soak sequence ended at {sequence}, expected {}",
            descriptor.expected_last_sequence
        ));
    }
    Ok(())
}

fn send_message(
    channel: &Channel<AppServerEvent>,
    sequence: &mut u64,
    message: Value,
) -> Result<(), String> {
    *sequence += 1;
    channel
        .send(AppServerEvent::message(SOAK_GENERATION, *sequence, message))
        .map_err(|error| format!("Could not deliver packaged soak event {sequence}: {error}"))
}

fn unix_time_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn result_path() -> Result<PathBuf, String> {
    json_output_path(RESULT_PATH_ENV, "packaged soak")
}

async fn start_process_tree_crash_probe(
    channel: &Channel<AppServerEvent>,
    state: &ProcessTreeProbeState,
) -> Result<(), String> {
    let executable = process_tree_fixture_path()?;
    let report_path = json_output_path(PROCESS_TREE_RESULT_PATH_ENV, "process-tree")?;
    if report_path.exists() {
        return Err("The process-tree result file already exists".into());
    }

    let mut slot = state.transport.lock().await;
    if slot.is_some() {
        return Err("The process-tree crash probe is already active".into());
    }
    let transport = StdioTransport::spawn(executable, SOAK_GENERATION, channel.clone())
        .await
        .map_err(|error| format!("Could not start the process-tree fixture: {error}"))?;
    #[cfg(target_os = "macos")]
    let gate = json!({
        "processGuardPid": transport
            .packaged_soak_process_guard_id()
            .await
            .ok_or_else(|| "The macOS process-group guard pid is unavailable".to_string())?
    });
    #[cfg(not(target_os = "macos"))]
    let gate = json!({});
    if let Err(error) = transport
        .notify("tamagrid/processTreeCrashProbe", gate)
        .await
    {
        let _ = transport.shutdown().await;
        return Err(format!(
            "Could not release the process-tree fixture start gate: {error}"
        ));
    }
    *slot = Some(transport);
    Ok(())
}

fn process_tree_fixture_path() -> Result<PathBuf, String> {
    let raw = env::var(PROCESS_TREE_FIXTURE_PATH_ENV)
        .map_err(|_| format!("{PROCESS_TREE_FIXTURE_PATH_ENV} is not configured"))?;
    let requested = PathBuf::from(raw);
    if !requested.is_absolute() {
        return Err("The process-tree fixture path must be absolute".into());
    }
    let canonical = requested
        .canonicalize()
        .map_err(|error| format!("The process-tree fixture is unavailable: {error}"))?;
    if !canonical.is_file() {
        return Err("The process-tree fixture must be a file".into());
    }
    let expected_name = if cfg!(windows) {
        "tamagrid-process-tree-fixture.exe"
    } else {
        "tamagrid-process-tree-fixture"
    };
    if canonical.file_name() != Some(OsStr::new(expected_name)) {
        return Err("The process-tree fixture has an unexpected file name".into());
    }
    let current_executable = env::current_exe()
        .and_then(|path| path.canonicalize())
        .map_err(|error| format!("Could not locate the packaged soak executable: {error}"))?;
    if canonical.parent() != current_executable.parent() {
        return Err("The process-tree fixture must be next to the packaged soak executable".into());
    }
    Ok(canonical)
}

fn json_output_path(environment_name: &str, label: &str) -> Result<PathBuf, String> {
    let raw =
        env::var(environment_name).map_err(|_| format!("{environment_name} is not configured"))?;
    let requested = PathBuf::from(raw);
    if !requested.is_absolute() {
        return Err(format!("The {label} result path must be absolute"));
    }
    let parent = requested
        .parent()
        .ok_or_else(|| format!("The {label} result path has no parent"))?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("The {label} result directory is unavailable: {error}"))?;
    let file_name = requested
        .file_name()
        .ok_or_else(|| format!("The {label} result path has no file name"))?;
    if Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        != Some("json")
    {
        return Err(format!(
            "The {label} result file must use the .json extension"
        ));
    }
    Ok(canonical_parent.join(file_name))
}

fn write_result_bytes(bytes: &[u8]) -> Result<(), String> {
    let path = result_path()?;
    fs::write(path, bytes)
        .map_err(|error| format!("Could not write the packaged soak result: {error}"))
}

fn write_failure_and_exit(app: &AppHandle, error: &str) {
    let report = json!({
        "passed": false,
        "backendFailure": error,
    });
    if let Ok(bytes) = serde_json::to_vec_pretty(&report) {
        let _ = write_result_bytes(&bytes);
    }
    app.exit(2);
}

#[cfg(test)]
mod tests {
    use super::{MAX_DURATION_MS, MIN_DURATION_MS};

    #[test]
    fn packaged_soak_duration_bounds_are_nonzero_and_bounded() {
        const {
            assert!(MIN_DURATION_MS >= 1_000);
            assert!(MAX_DURATION_MS <= 10 * 60 * 1_000);
            assert!(MIN_DURATION_MS < MAX_DURATION_MS);
        }
    }
}

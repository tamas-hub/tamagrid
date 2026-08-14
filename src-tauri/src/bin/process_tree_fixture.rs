#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env,
    fs::OpenOptions,
    io::{self, BufRead, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::Duration,
};

use serde_json::json;

const RESULT_PATH_ENV: &str = "TAMAGRID_SOAK_PROCESS_TREE_RESULT_PATH";
const DESCENDANT_ARGUMENT: &str = "--tamagrid-process-tree-descendant";

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}

fn run() -> Result<(), String> {
    let arguments = env::args().skip(1).collect::<Vec<_>>();
    match arguments.as_slice() {
        [argument] if argument == "app-server" => run_app_server_fixture(),
        [argument] if argument == DESCENDANT_ARGUMENT => {
            thread::sleep(Duration::from_secs(10 * 60));
            Ok(())
        }
        _ => Err("The process-tree fixture received unexpected arguments".into()),
    }
}

fn run_app_server_fixture() -> Result<(), String> {
    // StdioTransport writes only after it has assigned this process to the
    // production Job Object / process group. Waiting for that frame prevents
    // the descendant from racing ahead of containment setup.
    let mut gate = String::new();
    io::stdin()
        .lock()
        .read_line(&mut gate)
        .map_err(|error| format!("Could not read the fixture start gate: {error}"))?;
    let gate: serde_json::Value = serde_json::from_str(&gate)
        .map_err(|error| format!("Could not decode the fixture start gate: {error}"))?;
    if gate.get("method").and_then(serde_json::Value::as_str)
        != Some("tamagrid/processTreeCrashProbe")
    {
        return Err("The process-tree fixture received an unexpected start gate".into());
    }
    let process_guard_pid = gate
        .pointer("/params/processGuardPid")
        .and_then(serde_json::Value::as_u64);
    if process_guard_pid.is_some_and(|process_id| process_id > u32::MAX as u64) {
        return Err("The process-tree fixture guard pid is invalid".into());
    }

    let executable = env::current_exe()
        .map_err(|error| format!("Could not locate the process-tree fixture: {error}"))?;
    let mut descendant = Command::new(executable)
        .arg(DESCENDANT_ARGUMENT)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not spawn the fixture descendant: {error}"))?;

    let report_path = json_result_path()?;
    let report = serde_json::to_vec_pretty(&json!({
        "parentPid": std::process::id(),
        "descendantPid": descendant.id(),
        "processGuardPid": process_guard_pid,
    }))
    .map_err(|error| format!("Could not encode the process-tree report: {error}"))?;
    let mut report_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(report_path)
        .map_err(|error| format!("Could not create the process-tree report: {error}"))?;
    report_file
        .write_all(&report)
        .and_then(|_| report_file.flush())
        .map_err(|error| format!("Could not write the process-tree report: {error}"))?;

    // Remain alive even after stdin EOF. The test therefore passes only when
    // the OS containment owned by the abruptly terminated Tauri process kills
    // this process and its descendant.
    descendant
        .wait()
        .map_err(|error| format!("Could not wait for the fixture descendant: {error}"))?;
    Ok(())
}

fn json_result_path() -> Result<PathBuf, String> {
    let raw =
        env::var(RESULT_PATH_ENV).map_err(|_| format!("{RESULT_PATH_ENV} is not configured"))?;
    let requested = PathBuf::from(raw);
    if !requested.is_absolute() {
        return Err("The process-tree result path must be absolute".into());
    }
    let parent = requested
        .parent()
        .ok_or_else(|| "The process-tree result path has no parent".to_string())?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|error| format!("The process-tree result directory is unavailable: {error}"))?;
    let file_name = requested
        .file_name()
        .ok_or_else(|| "The process-tree result path has no file name".to_string())?;
    if Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        != Some("json")
    {
        return Err("The process-tree result file must use the .json extension".into());
    }
    Ok(canonical_parent.join(file_name))
}

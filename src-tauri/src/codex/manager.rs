use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    env,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    sync::Arc,
};
use tauri::{ipc::Channel, AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tokio::{io::AsyncReadExt, process::Command, sync::oneshot, sync::Mutex, time::Duration};

use super::{
    protocol::{AppServerEvent, ConnectionInfo, DetectionResult},
    transport::{AppServerTransport, StdioTransport},
};

const MAX_VERSION_OUTPUT: usize = 64 * 1024;

const MAX_IDENTIFIER: usize = 512;
const MAX_CURSOR: usize = 2_048;
const MAX_CWD: usize = 4_096;
const MAX_MESSAGE: usize = 1_048_576;
const MAX_REVIEW_INSTRUCTIONS: usize = 65_536;
const MAX_SEARCH: usize = 512;
const MAX_THREAD_NAME: usize = 256;
const EXECUTABLE_PREFERENCE_FILE: &str = "approved-codex-executable.json";

#[derive(Default)]
pub struct AppServerManager {
    current: Mutex<Option<Arc<StdioTransport>>>,
    lifecycle: Mutex<()>,
    dangerous_confirmation: Mutex<()>,
    generation: AtomicU64,
}

impl AppServerManager {
    async fn connect(
        &self,
        app: &AppHandle,
        events: Channel<AppServerEvent>,
    ) -> Result<ConnectionInfo, String> {
        let _guard = self.lifecycle.lock().await;
        self.disconnect_current().await?;

        // Executable selection is deliberately resolved in Rust. The WebView
        // cannot supply a path that will be executed.
        let verified = resolve_codex(app).await?;
        ensure_executable_unchanged(&verified).await?;
        let detection = verified.detection.clone();
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        let transport = StdioTransport::spawn(verified.canonical_path, generation, events)
            .await
            .map_err(|error| error.to_string())?;

        let handshake = async {
            transport
                .request(
                    "initialize",
                    json!({
                        "clientInfo": {
                            "name": "tamagrid",
                            "title": "TamaGrid",
                            "version": env!("CARGO_PKG_VERSION")
                        }
                    }),
                )
                .await
                .map_err(|error| error.to_string())?;
            transport
                .notify("initialized", json!({}))
                .await
                .map_err(|error| error.to_string())?;
            let account = transport
                .request("account/read", json!({ "refreshToken": false }))
                .await
                .map_err(|error| error.to_string())?;
            let account = sanitize_account_response(account);
            let models = read_all_models(transport.as_ref()).await?;
            // Rate limit metadata was added after the core account API. Older
            // Codex versions remain connectable and surface usage as unavailable.
            let rate_limits = transport
                .request("account/rateLimits/read", json!({}))
                .await
                .ok();
            Ok::<_, String>((account, models, rate_limits))
        }
        .await;

        let (account, models, rate_limits) = match handshake {
            Ok(result) => result,
            Err(error) => {
                let _ = transport.shutdown().await;
                return Err(format!("App Server compatibility check failed: {error}"));
            }
        };

        *self.current.lock().await = Some(transport);
        Ok(ConnectionInfo {
            generation,
            executable_path: detection.executable_path,
            version: detection.version,
            account,
            models,
            rate_limits,
        })
    }

    async fn disconnect_current(&self) -> Result<(), String> {
        if let Some(transport) = self.current.lock().await.take() {
            transport
                .shutdown()
                .await
                .map_err(|error| error.to_string())?;
        }
        Ok(())
    }

    async fn disconnect(&self) -> Result<(), String> {
        let _guard = self.lifecycle.lock().await;
        self.disconnect_current().await
    }

    async fn transport(&self) -> Result<Arc<StdioTransport>, String> {
        self.current
            .lock()
            .await
            .clone()
            .ok_or_else(|| "Codex App Server is not connected".into())
    }

    async fn request(&self, method: &str, params: Value) -> Result<Value, String> {
        self.transport()
            .await?
            .request(method, params)
            .await
            .map_err(|error| error.to_string())
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ApprovalPolicy {
    Untrusted,
    OnRequest,
    Never,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SandboxMode {
    ReadOnly,
    WorkspaceWrite,
    DangerFullAccess,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Personality {
    None,
    Friendly,
    Pragmatic,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReasoningSummary {
    None,
    Auto,
    Concise,
    Detailed,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelListParams {
    cursor: Option<String>,
    limit: Option<u16>,
    include_hidden: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThreadListParams {
    cursor: Option<String>,
    limit: Option<u16>,
    search_term: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThreadStartParams {
    model: Option<String>,
    cwd: Option<String>,
    service_tier: Option<String>,
    approval_policy: Option<ApprovalPolicy>,
    sandbox: Option<SandboxMode>,
    personality: Option<Personality>,
    ephemeral: Option<bool>,
    service_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThreadResumeParams {
    thread_id: String,
    model: Option<String>,
    cwd: Option<String>,
    service_tier: Option<String>,
    approval_policy: Option<ApprovalPolicy>,
    sandbox: Option<SandboxMode>,
    personality: Option<Personality>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThreadReadParams {
    thread_id: String,
    include_turns: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ThreadNameSetParams {
    thread_id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TurnStartParams {
    thread_id: String,
    text: String,
    model: Option<String>,
    cwd: Option<String>,
    effort: Option<String>,
    summary: Option<ReasoningSummary>,
    service_tier: Option<String>,
    approval_policy: Option<ApprovalPolicy>,
    sandbox_mode: Option<SandboxMode>,
    personality: Option<Personality>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TurnSteerParams {
    thread_id: String,
    expected_turn_id: String,
    text: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TurnInterruptParams {
    thread_id: String,
    turn_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReviewStartParams {
    thread_id: String,
    target: ReviewTarget,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum ReviewTarget {
    UncommittedChanges,
    BaseBranch { branch: String },
    Commit { sha: String, title: Option<String> },
    Custom { instructions: String },
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ApprovalDecision {
    Accept,
    Decline,
}

#[tauri::command]
pub async fn detect_codex(app: AppHandle) -> Result<DetectionResult, String> {
    Ok(resolve_codex(&app).await?.detection)
}

#[tauri::command]
pub async fn choose_codex_executable(app: AppHandle) -> Result<DetectionResult, String> {
    let (sender, receiver) = oneshot::channel();
    let picker = app
        .dialog()
        .file()
        .set_title("Choose the native Codex executable / Codex実行ファイルを選択");
    #[cfg(target_os = "windows")]
    let picker = picker.add_filter("Codex executable", &["exe"]);
    picker.pick_file(move |selection| {
        let _ = sender.send(selection);
    });
    let selected = receiver
        .await
        .map_err(|_| "The executable picker closed unexpectedly".to_string())?
        .ok_or_else(|| "Executable selection was cancelled".to_string())?
        .into_path()
        .map_err(|error| format!("The selected executable path is invalid: {error}"))?;
    let canonical = validate_candidate_file(selected).await?;
    let verified = confirm_and_verify_candidate(
        &app,
        canonical,
        "Run this executable to verify Codex? / この実行ファイルを確認しますか？",
        None,
    )
    .await?;
    save_approved_executable(&app, &verified).await?;
    Ok(verified.detection)
}

#[tauri::command]
pub async fn use_auto_detect_codex(app: AppHandle) -> Result<DetectionResult, String> {
    Ok(resolve_auto_codex(&app).await?.detection)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn connect_app_server(
    app: AppHandle,
    state: State<'_, AppServerManager>,
    on_event: Channel<AppServerEvent>,
) -> Result<ConnectionInfo, String> {
    state.connect(&app, on_event).await
}

#[tauri::command]
pub async fn disconnect_app_server(state: State<'_, AppServerManager>) -> Result<(), String> {
    state.disconnect().await
}

#[tauri::command]
pub async fn codex_account_read(state: State<'_, AppServerManager>) -> Result<Value, String> {
    let response = state
        .request("account/read", json!({ "refreshToken": false }))
        .await?;
    Ok(sanitize_account_response(response))
}

#[tauri::command]
pub async fn codex_rate_limits_read(state: State<'_, AppServerManager>) -> Result<Value, String> {
    state.request("account/rateLimits/read", json!({})).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_model_list(
    state: State<'_, AppServerManager>,
    params: ModelListParams,
) -> Result<Value, String> {
    let limit = params.limit.unwrap_or(100);
    if !(1..=100).contains(&limit) {
        return Err("model/list limit must be between 1 and 100".into());
    }
    validate_optional_text("model cursor", params.cursor.as_deref(), MAX_CURSOR, false)?;
    if params.include_hidden == Some(true) {
        return Err("TamaGrid does not expose hidden Codex models".into());
    }
    state
        .request(
            "model/list",
            json!({
                "cursor": params.cursor,
                "includeHidden": false,
                "limit": limit
            }),
        )
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_thread_list(
    state: State<'_, AppServerManager>,
    params: ThreadListParams,
) -> Result<Value, String> {
    let limit = params.limit.unwrap_or(25);
    if !(1..=100).contains(&limit) {
        return Err("thread/list limit must be between 1 and 100".into());
    }
    validate_optional_text("thread cursor", params.cursor.as_deref(), MAX_CURSOR, false)?;
    validate_optional_text(
        "thread search",
        params.search_term.as_deref(),
        MAX_SEARCH,
        true,
    )?;
    let mut request = json!({
        "cursor": params.cursor,
        "limit": limit,
        "sortKey": "updated_at",
        "sortDirection": "desc",
        "archived": false,
        "sourceKinds": [
            "cli", "vscode", "exec", "appServer", "subAgent",
            "subAgentReview", "subAgentCompact", "subAgentThreadSpawn",
            "subAgentOther", "unknown"
        ]
    });
    if let Some(search) = params.search_term.filter(|value| !value.trim().is_empty()) {
        request["searchTerm"] = Value::String(search.trim().to_owned());
    }
    state.request("thread/list", request).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_thread_start(
    state: State<'_, AppServerManager>,
    params: ThreadStartParams,
) -> Result<Value, String> {
    if params.ephemeral == Some(true) {
        return Err("TamaGrid creates persisted threads so they can be restored".into());
    }
    if let Some(service_name) = params.service_name.as_deref() {
        if service_name != "tamagrid" {
            return Err("thread/start serviceName is fixed by TamaGrid".into());
        }
    }
    let request = safe_thread_params(
        params.model,
        params.cwd,
        params.service_tier,
        params.approval_policy,
        params.sandbox,
        params.personality,
        true,
    )?;
    state.request("thread/start", request).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_thread_resume(
    state: State<'_, AppServerManager>,
    params: ThreadResumeParams,
) -> Result<Value, String> {
    validate_identifier("thread id", &params.thread_id)?;
    let mut request = safe_thread_params(
        params.model,
        params.cwd,
        params.service_tier,
        params.approval_policy,
        params.sandbox,
        params.personality,
        false,
    )?;
    request["threadId"] = Value::String(params.thread_id);
    state.request("thread/resume", request).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_thread_read(
    state: State<'_, AppServerManager>,
    params: ThreadReadParams,
) -> Result<Value, String> {
    validate_identifier("thread id", &params.thread_id)?;
    if params.include_turns == Some(false) {
        return Err("TamaGrid thread reads always include turns".into());
    }
    state
        .request(
            "thread/read",
            json!({ "threadId": params.thread_id, "includeTurns": true }),
        )
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_thread_name_set(
    state: State<'_, AppServerManager>,
    params: ThreadNameSetParams,
) -> Result<Value, String> {
    validate_identifier("thread id", &params.thread_id)?;
    validate_text("thread name", &params.name, MAX_THREAD_NAME, false, true)?;
    state
        .request(
            "thread/name/set",
            json!({ "threadId": params.thread_id, "name": params.name.trim() }),
        )
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_turn_start(
    app: AppHandle,
    state: State<'_, AppServerManager>,
    params: TurnStartParams,
) -> Result<Value, String> {
    validate_identifier("thread id", &params.thread_id)?;
    validate_text("message", &params.text, MAX_MESSAGE, false, false)?;
    validate_common_options(
        params.model.as_deref(),
        params.cwd.as_deref(),
        params.service_tier.as_deref(),
        params.effort.as_deref(),
    )?;

    let approval = params.approval_policy.unwrap_or(ApprovalPolicy::OnRequest);
    let sandbox = params.sandbox_mode.unwrap_or(SandboxMode::WorkspaceWrite);
    if approval == ApprovalPolicy::Never || sandbox == SandboxMode::DangerFullAccess {
        let _guard = state.dangerous_confirmation.lock().await;
        let cwd = params
            .cwd
            .as_deref()
            .unwrap_or("Codex default working directory");
        let message = format!(
            "This Codex turn can run with elevated authority.\n\nApproval policy: {}\nSandbox: {}\nWorking directory: {}\n\nConfirm only if you intend to grant this authority for this turn. The choice is not remembered.\n\nこのターンに高い権限を与える場合のみ実行してください。この確認は保存されません。",
            approval_label(approval),
            sandbox_label(sandbox),
            cwd
        );
        if !show_native_confirmation(
            &app,
            "High-risk Codex turn / 高リスク実行の確認",
            message,
            "Run this turn / このターンを実行",
        )
        .await?
        {
            return Err("High-risk Codex turn was cancelled by the user".into());
        }
    }

    let mut request = Map::new();
    request.insert("threadId".into(), Value::String(params.thread_id));
    request.insert(
        "input".into(),
        json!([{ "type": "text", "text": params.text }]),
    );
    insert_string(&mut request, "model", params.model);
    insert_string(&mut request, "cwd", normalized_optional(params.cwd));
    insert_string(&mut request, "effort", params.effort);
    insert_string(&mut request, "serviceTier", params.service_tier);
    request.insert("approvalPolicy".into(), json!(approval));
    request.insert(
        "sandboxPolicy".into(),
        sandbox_policy(sandbox, request.get("cwd").and_then(Value::as_str)),
    );
    if let Some(summary) = params.summary {
        request.insert("summary".into(), json!(summary));
    }
    if let Some(personality) = params.personality {
        request.insert("personality".into(), json!(personality));
    }
    state.request("turn/start", Value::Object(request)).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_turn_steer(
    state: State<'_, AppServerManager>,
    params: TurnSteerParams,
) -> Result<Value, String> {
    validate_identifier("thread id", &params.thread_id)?;
    validate_identifier("turn id", &params.expected_turn_id)?;
    validate_text("message", &params.text, MAX_MESSAGE, false, false)?;
    state
        .request(
            "turn/steer",
            json!({
                "threadId": params.thread_id,
                "expectedTurnId": params.expected_turn_id,
                "input": [{ "type": "text", "text": params.text }]
            }),
        )
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_turn_interrupt(
    state: State<'_, AppServerManager>,
    params: TurnInterruptParams,
) -> Result<Value, String> {
    validate_identifier("thread id", &params.thread_id)?;
    validate_identifier("turn id", &params.turn_id)?;
    state
        .request(
            "turn/interrupt",
            json!({ "threadId": params.thread_id, "turnId": params.turn_id }),
        )
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn codex_review_start(
    state: State<'_, AppServerManager>,
    params: ReviewStartParams,
) -> Result<Value, String> {
    validate_identifier("thread id", &params.thread_id)?;
    validate_review_target(&params.target)?;
    state
        .request(
            "review/start",
            json!({
                "threadId": params.thread_id,
                "delivery": "inline",
                "target": params.target
            }),
        )
        .await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn approve_request(
    state: State<'_, AppServerManager>,
    request_id: Value,
    decision: ApprovalDecision,
) -> Result<(), String> {
    state
        .transport()
        .await?
        .respond_checked(
            request_id,
            json!({ "decision": decision }),
            &[
                "item/commandExecution/requestApproval",
                "item/fileChange/requestApproval",
            ],
        )
        .await
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn safe_thread_params(
    model: Option<String>,
    cwd: Option<String>,
    service_tier: Option<String>,
    approval_policy: Option<ApprovalPolicy>,
    sandbox: Option<SandboxMode>,
    personality: Option<Personality>,
    new_thread: bool,
) -> Result<Value, String> {
    validate_common_options(
        model.as_deref(),
        cwd.as_deref(),
        service_tier.as_deref(),
        None,
    )?;
    let mut request = Map::new();
    insert_string(&mut request, "model", model);
    insert_string(&mut request, "cwd", normalized_optional(cwd));
    insert_string(&mut request, "serviceTier", service_tier);
    if let Some(personality) = personality {
        request.insert("personality".into(), json!(personality));
    }

    // Existing Codex configuration may be more permissive than the UI shows.
    // Explicitly apply a safe baseline whenever a thread is loaded. Elevated
    // choices are turn-scoped and require a native confirmation instead.
    let safe_approval = match approval_policy {
        Some(ApprovalPolicy::Untrusted) => ApprovalPolicy::Untrusted,
        _ => ApprovalPolicy::OnRequest,
    };
    let safe_sandbox = match sandbox {
        Some(SandboxMode::ReadOnly) => SandboxMode::ReadOnly,
        _ => SandboxMode::WorkspaceWrite,
    };
    request.insert("approvalPolicy".into(), json!(safe_approval));
    request.insert("sandbox".into(), json!(safe_sandbox));
    if new_thread {
        request.insert("ephemeral".into(), Value::Bool(false));
        request.insert("serviceName".into(), Value::String("tamagrid".into()));
    }
    Ok(Value::Object(request))
}

fn validate_common_options(
    model: Option<&str>,
    cwd: Option<&str>,
    service_tier: Option<&str>,
    effort: Option<&str>,
) -> Result<(), String> {
    validate_optional_text("model", model, MAX_IDENTIFIER, false)?;
    validate_optional_text("service tier", service_tier, MAX_IDENTIFIER, false)?;
    validate_optional_text("reasoning effort", effort, MAX_IDENTIFIER, false)?;
    if let Some(cwd) = cwd.filter(|value| !value.trim().is_empty()) {
        validate_text("working directory", cwd, MAX_CWD, false, true)?;
        if !Path::new(cwd.trim()).is_absolute() {
            return Err("Working directory must be an absolute path".into());
        }
    }
    Ok(())
}

fn validate_review_target(target: &ReviewTarget) -> Result<(), String> {
    match target {
        ReviewTarget::UncommittedChanges => Ok(()),
        ReviewTarget::BaseBranch { branch } => {
            validate_text("base branch", branch, MAX_IDENTIFIER, false, true)
        }
        ReviewTarget::Commit { sha, title } => {
            validate_text("commit SHA", sha, MAX_IDENTIFIER, false, true)?;
            validate_optional_text("commit title", title.as_deref(), 1_024, true)
        }
        ReviewTarget::Custom { instructions } => validate_text(
            "review instructions",
            instructions,
            MAX_REVIEW_INSTRUCTIONS,
            false,
            false,
        ),
    }
}

fn validate_identifier(field: &str, value: &str) -> Result<(), String> {
    validate_text(field, value, MAX_IDENTIFIER, false, true)
}

fn validate_optional_text(
    field: &str,
    value: Option<&str>,
    max_length: usize,
    allow_empty: bool,
) -> Result<(), String> {
    if let Some(value) = value {
        validate_text(field, value, max_length, allow_empty, true)?;
    }
    Ok(())
}

fn validate_text(
    field: &str,
    value: &str,
    max_length: usize,
    allow_empty: bool,
    reject_controls: bool,
) -> Result<(), String> {
    let trimmed = value.trim();
    if !allow_empty && trimmed.is_empty() {
        return Err(format!("{field} cannot be empty"));
    }
    if value.len() > max_length {
        return Err(format!(
            "{field} exceeds the {max_length}-byte safety limit"
        ));
    }
    if value.contains('\0')
        || (reject_controls
            && value
                .chars()
                .any(|character| character.is_control() && !matches!(character, '\t')))
    {
        return Err(format!("{field} contains unsupported control characters"));
    }
    Ok(())
}

fn normalized_optional(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn insert_string(map: &mut Map<String, Value>, key: &str, value: Option<String>) {
    if let Some(value) = value.filter(|value| !value.is_empty()) {
        map.insert(key.into(), Value::String(value));
    }
}

fn sandbox_policy(mode: SandboxMode, cwd: Option<&str>) -> Value {
    match mode {
        SandboxMode::DangerFullAccess => json!({ "type": "dangerFullAccess" }),
        SandboxMode::ReadOnly => json!({ "type": "readOnly", "networkAccess": false }),
        SandboxMode::WorkspaceWrite => json!({
            "type": "workspaceWrite",
            "writableRoots": cwd.map(|value| vec![value]).unwrap_or_default(),
            "networkAccess": false
        }),
    }
}

fn approval_label(policy: ApprovalPolicy) -> &'static str {
    match policy {
        ApprovalPolicy::Untrusted => "untrusted",
        ApprovalPolicy::OnRequest => "on-request",
        ApprovalPolicy::Never => "never (commands may run without approval)",
    }
}

fn sandbox_label(mode: SandboxMode) -> &'static str {
    match mode {
        SandboxMode::ReadOnly => "read-only",
        SandboxMode::WorkspaceWrite => "workspace-write",
        SandboxMode::DangerFullAccess => "danger-full-access (system-wide access)",
    }
}

async fn show_native_confirmation(
    app: &AppHandle,
    title: &str,
    message: String,
    accept_label: &str,
) -> Result<bool, String> {
    let (sender, receiver) = oneshot::channel();
    app.dialog()
        .message(message)
        .title(title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            accept_label.into(),
            "Cancel / キャンセル".into(),
        ))
        .show(move |confirmed| {
            let _ = sender.send(confirmed);
        });
    receiver
        .await
        .map_err(|_| "The native confirmation dialog closed unexpectedly".to_string())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExecutablePreference {
    version: u8,
    executable_path: String,
    #[serde(default)]
    sha256: Option<String>,
}

struct VerifiedCodex {
    detection: DetectionResult,
    canonical_path: PathBuf,
    sha256: String,
}

fn executable_preference_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Could not resolve TamaGrid's config directory: {error}"))?;
    Ok(directory.join(EXECUTABLE_PREFERENCE_FILE))
}

async fn load_approved_executable(app: &AppHandle) -> Option<ExecutablePreference> {
    let path = executable_preference_path(app).ok()?;
    let contents = tokio::fs::read_to_string(path).await.ok()?;
    serde_json::from_str(&contents).ok()
}

async fn save_approved_executable(
    app: &AppHandle,
    executable: &VerifiedCodex,
) -> Result<(), String> {
    let path = executable_preference_path(app)?;
    let parent = path
        .parent()
        .ok_or_else(|| "TamaGrid config path has no parent directory".to_string())?;
    tokio::fs::create_dir_all(parent)
        .await
        .map_err(|error| format!("Could not create TamaGrid's config directory: {error}"))?;
    let contents = serde_json::to_vec_pretty(&ExecutablePreference {
        version: 2,
        executable_path: executable.detection.executable_path.clone(),
        sha256: Some(executable.sha256.clone()),
    })
    .map_err(|error| format!("Could not encode Codex executable preference: {error}"))?;
    tokio::fs::write(path, contents)
        .await
        .map_err(|error| format!("Could not save Codex executable preference: {error}"))
}

async fn read_all_models(transport: &StdioTransport) -> Result<Vec<Value>, String> {
    let mut models = Vec::new();
    let mut cursor: Option<String> = None;
    for _ in 0..100 {
        let result = transport
            .request(
                "model/list",
                json!({ "limit": 100, "includeHidden": false, "cursor": cursor }),
            )
            .await
            .map_err(|error| error.to_string())?;
        let page = result
            .get("data")
            .and_then(Value::as_array)
            .ok_or_else(|| "model/list returned an invalid data field".to_string())?;
        models.extend(page.iter().cloned());
        cursor = result
            .get("nextCursor")
            .and_then(Value::as_str)
            .map(str::to_owned);
        if cursor.is_none() {
            return Ok(models);
        }
    }
    Err("model/list exceeded the pagination safety limit".into())
}

async fn resolve_codex(app: &AppHandle) -> Result<VerifiedCodex, String> {
    if let Some(preference) = load_approved_executable(app).await {
        if let Ok(canonical) =
            validate_candidate_file(PathBuf::from(&preference.executable_path)).await
        {
            let current_sha256 = sha256_file(&canonical).await?;
            if approved_hash_matches(&preference, &current_sha256) {
                return verify_candidate(canonical, current_sha256).await;
            }

            let previous = preference
                .sha256
                .as_deref()
                .filter(|value| !value.is_empty());
            let verified = confirm_and_verify_candidate(
                app,
                canonical,
                "The approved Codex executable changed or predates fingerprint pinning. / 承認済みCodex実行ファイルが変更されたか、指紋固定前の設定です。",
                previous,
            )
            .await?;
            save_approved_executable(app, &verified).await?;
            return Ok(verified);
        }
    }
    resolve_auto_codex(app).await
}

async fn resolve_auto_codex(app: &AppHandle) -> Result<VerifiedCodex, String> {
    let canonical = find_auto_codex_candidate().await?;
    let verified = confirm_and_verify_candidate(
        app,
        canonical,
        "TamaGrid auto-detected this Codex executable. / TamaGridがこのCodex実行ファイルを自動検出しました。",
        None,
    )
    .await?;
    save_approved_executable(app, &verified).await?;
    Ok(verified)
}

async fn find_auto_codex_candidate() -> Result<PathBuf, String> {
    let mut seen = HashSet::new();
    for candidate in codex_candidates() {
        let key = candidate.to_string_lossy().to_ascii_lowercase();
        if seen.insert(key) {
            if let Ok(canonical) = validate_candidate_file(candidate).await {
                return Ok(canonical);
            }
        }
    }
    Err("Codex executable was not found. Install Codex or choose its native executable in Settings.".into())
}

fn codex_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    #[cfg(windows)]
    if let Some(appdata) = env::var_os("APPDATA") {
        let platform_package = if cfg!(target_arch = "aarch64") {
            "@openai/codex-win32-arm64"
        } else {
            "@openai/codex-win32-x64"
        };
        candidates.push(
            PathBuf::from(appdata)
                .join("npm/node_modules/@openai/codex/node_modules")
                .join(platform_package)
                .join(if cfg!(target_arch = "aarch64") {
                    "vendor/aarch64-pc-windows-msvc/bin/codex.exe"
                } else {
                    "vendor/x86_64-pc-windows-msvc/bin/codex.exe"
                }),
        );
    }

    if let Some(path) = env::var_os("PATH") {
        for directory in env::split_paths(&path) {
            #[cfg(windows)]
            candidates.push(directory.join("codex.exe"));
            #[cfg(not(windows))]
            candidates.push(directory.join("codex"));
        }
    }

    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from("/opt/homebrew/bin/codex"));
        candidates.push(PathBuf::from("/usr/local/bin/codex"));
    }
    candidates
}

async fn validate_candidate_file(path: PathBuf) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("Codex executable path must be absolute".into());
    }
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|_| format!("Codex executable does not exist: {}", path.display()))?;
    if !metadata.is_file() {
        return Err(format!(
            "Codex executable is not a file: {}",
            path.display()
        ));
    }

    #[cfg(windows)]
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| !extension.eq_ignore_ascii_case("exe"))
        .unwrap_or(true)
    {
        return Err("On Windows, select the native codex.exe rather than a shell wrapper".into());
    }

    tokio::fs::canonicalize(&path)
        .await
        .map_err(|error| format!("Could not resolve Codex executable path: {error}"))
}

async fn confirm_and_verify_candidate(
    app: &AppHandle,
    canonical: PathBuf,
    reason: &str,
    previous_sha256: Option<&str>,
) -> Result<VerifiedCodex, String> {
    let current_sha256 = sha256_file(&canonical).await?;
    let previous = previous_sha256
        .map(|value| format!("\nPreviously approved SHA-256: {value}"))
        .unwrap_or_default();
    let message = format!(
        "{reason}\n\nPath: {}\nCurrent SHA-256: {current_sha256}{previous}\n\nTamaGrid will run --version now and app-server when you connect. Continue only if you trust this exact file.\n\nこのファイルとSHA-256を信頼できる場合のみ続行してください。",
        canonical.display()
    );
    if !show_native_confirmation(
        app,
        "Verify Codex executable / 実行ファイルの確認",
        message,
        "Trust and verify / 信頼して確認",
    )
    .await?
    {
        return Err("Executable verification was cancelled".into());
    }
    verify_candidate(canonical, current_sha256).await
}

async fn verify_candidate(
    canonical: PathBuf,
    expected_sha256: String,
) -> Result<VerifiedCodex, String> {
    let mut command = Command::new(&canonical);
    command
        .arg("--version")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.as_std_mut().creation_flags(0x0800_0000);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("Codex executable is not runnable: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Codex version stdout was unavailable".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Codex version stderr was unavailable".to_string())?;
    let check = async {
        let stdout = read_bounded_output(stdout, MAX_VERSION_OUTPUT);
        let stderr = read_bounded_output(stderr, MAX_VERSION_OUTPUT);
        let status = child.wait();
        tokio::try_join!(stdout, stderr, status)
    };
    let (stdout, _stderr, status) = match tokio::time::timeout(Duration::from_secs(8), check).await
    {
        Ok(Ok(output)) => output,
        Ok(Err(error)) => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err(format!("Codex version check failed safely: {error}"));
        }
        Err(_) => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err("Codex version check timed out".into());
        }
    };
    if !status.success() {
        return Err(format!(
            "Codex version check failed with exit code {:?}",
            status.code()
        ));
    }
    let version = String::from_utf8_lossy(&stdout).trim().to_owned();
    if version.is_empty() || !version.to_ascii_lowercase().contains("codex") {
        return Err("The selected executable did not identify itself as Codex".into());
    }
    let verified_sha256 = sha256_file(&canonical).await?;
    if !verified_sha256.eq_ignore_ascii_case(&expected_sha256) {
        return Err("The Codex executable changed while it was being verified".into());
    }
    Ok(VerifiedCodex {
        detection: DetectionResult {
            executable_path: path_string(&canonical),
            version,
        },
        canonical_path: canonical,
        sha256: verified_sha256,
    })
}

async fn read_bounded_output<R: tokio::io::AsyncRead + Unpin>(
    reader: R,
    max_length: usize,
) -> std::io::Result<Vec<u8>> {
    let mut output = Vec::new();
    reader
        .take((max_length + 1) as u64)
        .read_to_end(&mut output)
        .await?;
    if output.len() > max_length {
        Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Codex version output exceeded the safety limit",
        ))
    } else {
        Ok(output)
    }
}

async fn ensure_executable_unchanged(executable: &VerifiedCodex) -> Result<(), String> {
    let current_sha256 = sha256_file(&executable.canonical_path).await?;
    if current_sha256.eq_ignore_ascii_case(&executable.sha256) {
        Ok(())
    } else {
        Err("The Codex executable changed after verification; connection was cancelled".into())
    }
}

fn approved_hash_matches(preference: &ExecutablePreference, current_sha256: &str) -> bool {
    preference.version == 2
        && preference
            .sha256
            .as_deref()
            .is_some_and(|approved| approved.eq_ignore_ascii_case(current_sha256))
}

async fn sha256_file(path: &Path) -> Result<String, String> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|error| format!("Could not open Codex executable for fingerprinting: {error}"))?;
    let mut hasher = Sha256::new();
    // Keep the read buffer off the future's stack. This function is nested in
    // the Tauri connection command several times, and an inline 64 KiB array
    // makes that command future large enough to overflow Windows' default
    // 1 MiB UI-thread stack before Tokio can spawn it.
    let mut buffer = vec![0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .await
            .map_err(|error| format!("Could not fingerprint Codex executable: {error}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn sanitize_account_response(response: Value) -> Value {
    let requires_openai_auth = response
        .get("requiresOpenaiAuth")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let account = response
        .get("account")
        .and_then(Value::as_object)
        .and_then(|raw| {
            let account_type = raw.get("type").and_then(Value::as_str)?;
            let mut safe = Map::new();
            safe.insert("type".into(), Value::String(account_type.to_owned()));
            if let Some(plan_type) = raw.get("planType").and_then(Value::as_str) {
                safe.insert("planType".into(), Value::String(plan_type.to_owned()));
            }
            Some(Value::Object(safe))
        });
    json!({
        "requiresOpenaiAuth": requires_openai_auth,
        "account": account
    })
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use std::{mem::size_of_val, path::Path};

    use serde_json::json;

    use super::{
        approved_hash_matches, safe_thread_params, sanitize_account_response,
        validate_common_options, ApprovalPolicy, ExecutablePreference, SandboxMode,
        MAX_VERSION_OUTPUT,
    };

    #[test]
    fn thread_loads_strip_persisted_high_risk_authority() {
        let cwd = std::env::current_dir()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        let params = safe_thread_params(
            None,
            Some(cwd),
            None,
            Some(ApprovalPolicy::Never),
            Some(SandboxMode::DangerFullAccess),
            None,
            true,
        )
        .unwrap();
        assert_eq!(params["approvalPolicy"], "on-request");
        assert_eq!(params["sandbox"], "workspace-write");
        assert_eq!(params["ephemeral"], false);
    }

    #[test]
    fn safe_restrictive_thread_options_are_preserved() {
        let cwd = std::env::current_dir()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        let params = safe_thread_params(
            None,
            Some(cwd),
            None,
            Some(ApprovalPolicy::Untrusted),
            Some(SandboxMode::ReadOnly),
            None,
            false,
        )
        .unwrap();
        assert_eq!(params["approvalPolicy"], "untrusted");
        assert_eq!(params["sandbox"], "read-only");
        assert!(params.get("ephemeral").is_none());
    }

    #[test]
    fn working_directory_must_be_absolute_and_control_free() {
        assert!(validate_common_options(None, Some("relative"), None, None).is_err());
        let invalid = format!("{}\nbad", std::env::current_dir().unwrap().display());
        assert!(validate_common_options(None, Some(&invalid), None, None).is_err());
    }

    #[test]
    fn executable_fingerprint_requires_v2_and_an_exact_hash() {
        let legacy = ExecutablePreference {
            version: 1,
            executable_path: "codex".into(),
            sha256: None,
        };
        assert!(!approved_hash_matches(&legacy, "abc"));

        let pinned = ExecutablePreference {
            version: 2,
            executable_path: "codex".into(),
            sha256: Some("ABC123".into()),
        };
        assert!(approved_hash_matches(&pinned, "abc123"));
        assert!(!approved_hash_matches(&pinned, "changed"));
    }

    #[test]
    fn account_response_exposes_only_auth_state_needed_by_the_ui() {
        let sanitized = sanitize_account_response(json!({
            "requiresOpenaiAuth": true,
            "account": {
                "type": "chatgpt",
                "email": format!("private{}example.invalid", '@'),
                "planType": "plus",
                "accessToken": "must-not-cross-ipc"
            },
            "unexpected": "discarded"
        }));
        assert_eq!(
            sanitized,
            json!({
                "requiresOpenaiAuth": true,
                "account": { "type": "chatgpt", "planType": "plus" }
            })
        );
    }

    #[test]
    fn executable_fingerprint_future_stays_small_for_tauri_ipc() {
        let future = super::sha256_file(Path::new("unused-test-path"));
        assert!(
            size_of_val(&future) < 4 * 1024,
            "sha256 future unexpectedly grew to {} bytes",
            size_of_val(&future)
        );
    }

    #[tokio::test]
    async fn version_output_reader_rejects_oversized_output() {
        let acceptable = vec![b'x'; MAX_VERSION_OUTPUT];
        assert_eq!(
            super::read_bounded_output(&acceptable[..], MAX_VERSION_OUTPUT)
                .await
                .unwrap()
                .len(),
            MAX_VERSION_OUTPUT
        );

        let oversized = vec![b'x'; MAX_VERSION_OUTPUT + 1];
        assert_eq!(
            super::read_bounded_output(&oversized[..], MAX_VERSION_OUTPUT)
                .await
                .unwrap_err()
                .kind(),
            std::io::ErrorKind::InvalidData
        );
    }
}

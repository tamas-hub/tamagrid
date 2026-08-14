use async_trait::async_trait;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Weak,
    },
};
use tauri::ipc::Channel;
use thiserror::Error;
use tokio::{
    io::{AsyncBufRead, AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::{oneshot, Mutex},
    time::{sleep, timeout, Duration},
};

use super::protocol::AppServerEvent;

#[cfg(windows)]
mod process_tree {
    use std::{io, mem::size_of, ptr};
    use windows_sys::Win32::{
        Foundation::{CloseHandle, HANDLE},
        System::{
            JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
                SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            },
            Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE},
        },
    };

    pub struct ProcessJob {
        handle: HANDLE,
    }

    // A Windows HANDLE may be used from any thread as long as ownership and
    // closure are synchronized. ProcessJob owns the handle for its full life.
    unsafe impl Send for ProcessJob {}
    unsafe impl Sync for ProcessJob {}

    impl ProcessJob {
        pub fn assign(process_id: u32) -> io::Result<Self> {
            unsafe {
                let job = CreateJobObjectW(ptr::null(), ptr::null());
                if job.is_null() {
                    return Err(io::Error::last_os_error());
                }
                let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
                limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                if SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &limits as *const _ as *const _,
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                ) == 0
                {
                    let error = io::Error::last_os_error();
                    CloseHandle(job);
                    return Err(error);
                }

                let process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, process_id);
                if process.is_null() {
                    let error = io::Error::last_os_error();
                    CloseHandle(job);
                    return Err(error);
                }
                let assigned = AssignProcessToJobObject(job, process);
                let assign_error = (assigned == 0).then(io::Error::last_os_error);
                CloseHandle(process);
                if let Some(error) = assign_error {
                    CloseHandle(job);
                    return Err(error);
                }
                Ok(Self { handle: job })
            }
        }

        pub fn terminate(&self) -> io::Result<()> {
            unsafe {
                if TerminateJobObject(self.handle, 1) == 0 {
                    Err(io::Error::last_os_error())
                } else {
                    Ok(())
                }
            }
        }
    }

    impl Drop for ProcessJob {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.handle);
            }
        }
    }
}

#[cfg(unix)]
mod process_tree {
    use std::io;

    pub fn terminate_process_group(process_group_id: i32) -> io::Result<()> {
        unsafe {
            if libc::kill(-process_group_id, libc::SIGKILL) == -1 {
                let error = io::Error::last_os_error();
                if error.raw_os_error() != Some(libc::ESRCH) {
                    return Err(error);
                }
            }
        }
        Ok(())
    }
}

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_PROTOCOL_LINE: usize = 16 * 1024 * 1024;
const MAX_DIAGNOSTIC_LINE: usize = 64 * 1024;
const DELTA_FLUSH_INTERVAL: Duration = Duration::from_millis(20);
const MAX_BUFFERED_DELTA_BYTES: usize = 1024 * 1024;
const MAX_BUFFERED_DELTA_EVENTS: usize = 256;
const MAX_COALESCED_DELTA_BYTES: usize = 128 * 1024;
const SUPPORTED_SERVER_REQUESTS: &[&str] = &[
    "item/commandExecution/requestApproval",
    "item/fileChange/requestApproval",
];
const COALESCED_DELTA_METHODS: &[&str] = &[
    "item/agentMessage/delta",
    "item/plan/delta",
    "item/reasoning/summaryTextDelta",
    "item/commandExecution/outputDelta",
];

#[derive(Default)]
struct DeltaBuffer {
    events: Vec<BufferedDelta>,
    bytes: usize,
}

struct BufferedDelta {
    key: String,
    message: Value,
    bytes: usize,
}

#[derive(Debug, Error)]
pub enum TransportError {
    #[error("Codex App Server is not connected")]
    Disconnected,
    #[error("Codex App Server request timed out: {0}")]
    Timeout(String),
    #[error("Codex App Server returned an error: {0}")]
    Rpc(String),
    #[error("Failed to communicate with Codex App Server: {0}")]
    Io(String),
    #[error("Invalid JSON-RPC id")]
    InvalidId,
    #[error("No pending App Server request matches this approval")]
    UnknownServerRequest,
}

type PendingResponse = oneshot::Sender<Result<Value, TransportError>>;

#[async_trait]
pub trait AppServerTransport: Send + Sync {
    async fn request(&self, method: &str, params: Value) -> Result<Value, TransportError>;
    async fn notify(&self, method: &str, params: Value) -> Result<(), TransportError>;
    async fn respond_checked(
        &self,
        id: Value,
        result: Value,
        allowed_methods: &[&str],
    ) -> Result<String, TransportError>;
    async fn shutdown(&self) -> Result<(), TransportError>;
}

pub struct StdioTransport {
    child: Mutex<Child>,
    stdin: Mutex<Option<ChildStdin>>,
    pending: Mutex<HashMap<String, PendingResponse>>,
    server_requests: Mutex<HashMap<String, String>>,
    active_turns: Mutex<HashMap<String, String>>,
    delta_buffer: Mutex<DeltaBuffer>,
    delta_delivery: Mutex<()>,
    events: Channel<AppServerEvent>,
    generation: u64,
    next_request_id: AtomicU64,
    sequence: AtomicU64,
    emit_lock: std::sync::Mutex<()>,
    closed: AtomicBool,
    #[cfg(windows)]
    process_job: process_tree::ProcessJob,
    #[cfg(unix)]
    process_group_id: i32,
    #[cfg(target_os = "macos")]
    process_guard: Mutex<Option<Child>>,
}

impl StdioTransport {
    pub async fn spawn(
        executable: PathBuf,
        generation: u64,
        events: Channel<AppServerEvent>,
    ) -> Result<Arc<Self>, TransportError> {
        let mut command = Command::new(&executable);
        command
            .arg("app-server")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.as_std_mut().creation_flags(CREATE_NO_WINDOW);
        }

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            // Put Codex and every child it launches in a dedicated process
            // group so shutdown cannot leave tool subprocesses behind.
            unsafe {
                command.as_std_mut().pre_exec(|| {
                    if libc::setpgid(0, 0) == -1 {
                        Err(std::io::Error::last_os_error())
                    } else {
                        Ok(())
                    }
                });
            }
        }

        let mut child = command
            .spawn()
            .map_err(|error| TransportError::Io(format!("{} ({})", error, executable.display())))?;
        let process_id = child
            .id()
            .ok_or_else(|| TransportError::Io("App Server process id was unavailable".into()))?;
        #[cfg(windows)]
        let process_job = match process_tree::ProcessJob::assign(process_id) {
            Ok(job) => job,
            Err(error) => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err(TransportError::Io(format!(
                    "Could not place App Server in a kill-on-close process job: {error}"
                )));
            }
        };
        #[cfg(unix)]
        let process_group_id = process_id as i32;
        #[cfg(target_os = "macos")]
        let process_guard = match crate::process_guard::spawn(process_group_id).await {
            Ok(guard) => guard,
            Err(error) => {
                let _ = process_tree::terminate_process_group(process_group_id);
                let _ = child.kill().await;
                let _ = child.wait().await;
                return Err(TransportError::Io(format!(
                    "Could not start the macOS process-group crash guard: {error}"
                )));
            }
        };
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| TransportError::Io("App Server stdin was not available".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| TransportError::Io("App Server stdout was not available".into()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| TransportError::Io("App Server stderr was not available".into()))?;

        let transport = Arc::new(Self {
            child: Mutex::new(child),
            stdin: Mutex::new(Some(stdin)),
            pending: Mutex::new(HashMap::new()),
            server_requests: Mutex::new(HashMap::new()),
            active_turns: Mutex::new(HashMap::new()),
            delta_buffer: Mutex::new(DeltaBuffer::default()),
            delta_delivery: Mutex::new(()),
            events,
            generation,
            next_request_id: AtomicU64::new(1),
            sequence: AtomicU64::new(1),
            emit_lock: std::sync::Mutex::new(()),
            closed: AtomicBool::new(false),
            #[cfg(windows)]
            process_job,
            #[cfg(unix)]
            process_group_id,
            #[cfg(target_os = "macos")]
            process_guard: Mutex::new(Some(process_guard)),
        });

        Self::read_stdout(Arc::downgrade(&transport), stdout);
        Self::read_stderr(Arc::downgrade(&transport), stderr);
        Self::monitor_process(Arc::downgrade(&transport));
        #[cfg(target_os = "macos")]
        Self::monitor_process_guard(Arc::downgrade(&transport));
        Self::flush_buffered_deltas(Arc::downgrade(&transport));
        Ok(transport)
    }

    #[cfg(all(feature = "packaged-soak-test", target_os = "macos"))]
    pub async fn packaged_soak_process_guard_id(&self) -> Option<u32> {
        self.process_guard
            .lock()
            .await
            .as_mut()
            .and_then(|guard| guard.id())
    }

    fn flush_buffered_deltas(transport: Weak<Self>) {
        tauri::async_runtime::spawn(async move {
            loop {
                sleep(DELTA_FLUSH_INTERVAL).await;
                let Some(transport) = transport.upgrade() else {
                    break;
                };
                transport.flush_delta_buffer().await;
                if transport.closed.load(Ordering::SeqCst) {
                    break;
                }
            }
        });
    }

    fn read_stdout(transport: Weak<Self>, stdout: tokio::process::ChildStdout) {
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut first_frame = true;
            loop {
                match read_frame(&mut reader, MAX_PROTOCOL_LINE).await {
                    Ok(Some(mut line)) => {
                        let Some(transport) = transport.upgrade() else {
                            break;
                        };
                        if first_frame {
                            first_frame = false;
                            if line.starts_with(&[0xEF, 0xBB, 0xBF]) {
                                line.drain(..3);
                            }
                        }
                        if line.is_empty() {
                            continue;
                        }
                        let line = match String::from_utf8(line) {
                            Ok(line) => line,
                            Err(error) => {
                                transport.emit_diagnostic(
                                    "malformedJson",
                                    format!("Non-UTF-8 App Server frame was ignored: {error}"),
                                );
                                continue;
                            }
                        };
                        match serde_json::from_str::<Value>(&line) {
                            Ok(message) => transport.route_message(message).await,
                            Err(error) => transport.emit_diagnostic(
                                "malformedJson",
                                format!("Malformed App Server JSON was ignored: {error}"),
                            ),
                        }
                    }
                    Ok(None) => {
                        if let Some(transport) = transport.upgrade() {
                            transport
                                .handle_disconnect("App Server stdout closed")
                                .await;
                        }
                        break;
                    }
                    Err(error) => {
                        if let Some(transport) = transport.upgrade() {
                            transport.emit_diagnostic("transportError", format!("stdout: {error}"));
                            if error.kind() != std::io::ErrorKind::InvalidData {
                                transport
                                    .handle_disconnect("App Server stdout failed")
                                    .await;
                                break;
                            }
                        }
                    }
                }
            }
        });
    }

    fn read_stderr(transport: Weak<Self>, stderr: tokio::process::ChildStderr) {
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stderr);
            while let Ok(Some(line)) = read_frame(&mut reader, MAX_DIAGNOSTIC_LINE).await {
                let Some(transport) = transport.upgrade() else {
                    break;
                };
                let line = String::from_utf8_lossy(&line);
                transport.emit_diagnostic("stderr", redact_diagnostic(&line));
            }
        });
    }

    fn monitor_process(transport: Weak<Self>) {
        tauri::async_runtime::spawn(async move {
            loop {
                sleep(Duration::from_millis(250)).await;
                let Some(transport) = transport.upgrade() else {
                    break;
                };
                let status = {
                    let mut child = transport.child.lock().await;
                    child.try_wait()
                };
                match status {
                    Ok(Some(status)) => {
                        let was_open = !transport.closed.swap(true, Ordering::SeqCst);
                        let _ = transport.terminate_process_tree();
                        #[cfg(target_os = "macos")]
                        let _ = transport.stop_process_guard().await;
                        transport.flush_delta_buffer().await;
                        if was_open {
                            transport.emit(AppServerEvent::exited(
                                transport.generation,
                                0,
                                status.code(),
                            ));
                            transport.fail_pending("App Server process exited").await;
                            transport.server_requests.lock().await.clear();
                            transport.active_turns.lock().await.clear();
                        }
                        break;
                    }
                    Ok(None) => {}
                    Err(error) => {
                        let _ = transport.terminate_process_tree();
                        transport
                            .handle_disconnect(&format!(
                                "App Server process status could not be read: {error}"
                            ))
                            .await;
                        #[cfg(target_os = "macos")]
                        let _ = transport.stop_process_guard().await;
                        break;
                    }
                }
            }
        });
    }

    #[cfg(target_os = "macos")]
    fn monitor_process_guard(transport: Weak<Self>) {
        tauri::async_runtime::spawn(async move {
            loop {
                sleep(Duration::from_millis(250)).await;
                let Some(transport) = transport.upgrade() else {
                    break;
                };
                let status = {
                    let mut slot = transport.process_guard.lock().await;
                    let Some(guard) = slot.as_mut() else {
                        break;
                    };
                    guard.try_wait()
                };
                match status {
                    Ok(Some(_)) => {
                        transport.process_guard.lock().await.take();
                        if !transport.closed.load(Ordering::SeqCst) {
                            let _ = transport.terminate_process_tree();
                            transport
                                .handle_disconnect(
                                    "macOS process-group crash guard exited unexpectedly",
                                )
                                .await;
                        }
                        break;
                    }
                    Ok(None) => {}
                    Err(error) => {
                        let _ = transport.terminate_process_tree();
                        transport
                            .handle_disconnect(&format!(
                                "macOS process-group crash guard failed: {error}"
                            ))
                            .await;
                        let _ = transport.stop_process_guard().await;
                        break;
                    }
                }
            }
        });
    }

    async fn route_message(&self, message: Value) {
        if self.closed.load(Ordering::SeqCst) {
            return;
        }
        if delta_message_key(&message).is_some() {
            self.buffer_delta(message).await;
            return;
        }
        self.flush_delta_buffer().await;

        let id = message.get("id").cloned();
        let method = message
            .get("method")
            .and_then(Value::as_str)
            .map(str::to_owned);

        if let (Some(id), Some(method)) = (id.as_ref(), method.as_ref()) {
            if !SUPPORTED_SERVER_REQUESTS.contains(&method.as_str()) {
                let response = json!({
                    "id": id,
                    "error": {
                        "code": -32601,
                        "message": format!("TamaGrid does not support the server request: {method}")
                    }
                });
                if let Err(error) = self.write_message(&response).await {
                    self.emit_diagnostic("transportError", error.to_string());
                }
                self.emit_diagnostic(
                    "unsupportedServerRequest",
                    format!("Declined unsupported App Server request: {method}"),
                );
                return;
            }
            if let Ok(key) = id_key(id) {
                self.server_requests
                    .lock()
                    .await
                    .insert(key, method.clone());
            }
            self.emit(AppServerEvent::message(self.generation, 0, message));
            return;
        }

        if let Some(id) = id.as_ref() {
            if let Ok(key) = id_key(id) {
                if let Some(sender) = self.pending.lock().await.remove(&key) {
                    let has_result = message.get("result").is_some();
                    let has_error = message.get("error").is_some();
                    let response = if has_result == has_error {
                        Err(TransportError::Rpc(
                            "Malformed response must contain exactly one of result or error".into(),
                        ))
                    } else if let Some(error) = message.get("error") {
                        Err(TransportError::Rpc(rpc_error_message(error)))
                    } else {
                        Ok(message.get("result").cloned().unwrap_or(Value::Null))
                    };
                    let _ = sender.send(response);
                    return;
                }
            }
            self.emit_diagnostic(
                "unknownResponse",
                "Ignored a response with an unknown or expired request id".into(),
            );
            return;
        }

        if method.is_some() {
            self.track_turn_lifecycle(&message).await;
            self.emit(AppServerEvent::message(self.generation, 0, message));
        } else {
            self.emit_diagnostic(
                "malformedJsonRpc",
                "Ignored a malformed JSON-RPC message".into(),
            );
        }
    }

    async fn write_message(&self, message: &Value) -> Result<(), TransportError> {
        if self.closed.load(Ordering::SeqCst) {
            return Err(TransportError::Disconnected);
        }
        let mut encoded =
            serde_json::to_vec(message).map_err(|error| TransportError::Io(error.to_string()))?;
        encoded.push(b'\n');
        let mut stdin = self.stdin.lock().await;
        let stdin = stdin.as_mut().ok_or(TransportError::Disconnected)?;
        stdin
            .write_all(&encoded)
            .await
            .map_err(|error| TransportError::Io(error.to_string()))?;
        stdin
            .flush()
            .await
            .map_err(|error| TransportError::Io(error.to_string()))
    }

    async fn fail_pending(&self, reason: &str) {
        let pending = std::mem::take(&mut *self.pending.lock().await);
        for (_, sender) in pending {
            let _ = sender.send(Err(TransportError::Io(reason.into())));
        }
    }

    async fn handle_disconnect(&self, reason: &str) {
        self.flush_delta_buffer().await;
        let was_open = !self.closed.swap(true, Ordering::SeqCst);
        let tree_error = self.terminate_process_tree().err();
        if was_open {
            self.fail_pending(reason).await;
            self.server_requests.lock().await.clear();
            self.active_turns.lock().await.clear();
            self.emit_diagnostic("disconnected", reason.into());
            if let Some(error) = tree_error {
                self.emit_diagnostic(
                    "transportError",
                    format!("process-tree cleanup after disconnect: {error}"),
                );
            }
        }
    }

    fn emit(&self, mut event: AppServerEvent) {
        // Sequence allocation and Channel::send must remain one critical
        // section. Otherwise the stdout, stderr, process-monitor, and delta
        // flush tasks can allocate sequence N/N+1 but deliver them in reverse,
        // causing the frontend's stale-event guard to discard valid data.
        let _guard = self
            .emit_lock
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        event.sequence = self.sequence.fetch_add(1, Ordering::SeqCst);
        let _ = self.events.send(event);
    }

    fn emit_diagnostic(&self, event_type: &str, detail: String) {
        self.emit(AppServerEvent::diagnostic(
            self.generation,
            0,
            event_type,
            detail,
        ));
    }

    async fn buffer_delta(&self, message: Value) {
        let Some(key) = delta_message_key(&message) else {
            self.emit_message(message);
            return;
        };
        let delta_bytes = message
            .get("params")
            .and_then(|params| params.get("delta"))
            .and_then(Value::as_str)
            .map(str::len)
            .unwrap_or(0);
        if delta_bytes == 0 || delta_bytes > MAX_BUFFERED_DELTA_BYTES {
            self.flush_delta_buffer().await;
            self.emit_message(message);
            return;
        }

        let must_flush = {
            let buffer = self.delta_buffer.lock().await;
            delta_buffer_should_flush(&buffer, delta_bytes)
        };
        if must_flush {
            self.flush_delta_buffer().await;
        }

        let mut buffer = self.delta_buffer.lock().await;
        push_delta_event(&mut buffer, key, message, delta_bytes);
        drop(buffer);
    }

    async fn flush_delta_buffer(&self) {
        // Keep extraction and delivery in one async critical section. A
        // periodic flush must not take a delta batch, pause, and then let a
        // terminal item/completed or turn/completed event overtake it.
        let _delivery = self.delta_delivery.lock().await;
        let pending = {
            let mut buffer = self.delta_buffer.lock().await;
            take_delta_events(&mut buffer)
        };
        for message in pending {
            self.emit_message(message);
        }
    }

    fn emit_message(&self, message: Value) {
        self.emit(AppServerEvent::message(self.generation, 0, message));
    }

    async fn track_turn_lifecycle(&self, message: &Value) {
        let Some(method) = message.get("method").and_then(Value::as_str) else {
            return;
        };
        let Some(params) = message.get("params") else {
            return;
        };
        let Some(thread_id) = params.get("threadId").and_then(Value::as_str) else {
            return;
        };
        let turn_id = params
            .get("turn")
            .and_then(|turn| turn.get("id"))
            .and_then(Value::as_str);
        match (method, turn_id) {
            ("turn/started", Some(turn_id)) => {
                self.active_turns
                    .lock()
                    .await
                    .insert(thread_id.to_owned(), turn_id.to_owned());
            }
            ("turn/completed", Some(turn_id)) => {
                let mut active = self.active_turns.lock().await;
                if active.get(thread_id).map(String::as_str) == Some(turn_id) {
                    active.remove(thread_id);
                }
            }
            _ => {}
        }
    }

    async fn interrupt_active_turns(&self) {
        let active = std::mem::take(&mut *self.active_turns.lock().await);
        for (thread_id, turn_id) in active {
            let id = self.next_request_id.fetch_add(1, Ordering::SeqCst);
            if let Err(error) = self
                .write_message(&json!({
                    "method": "turn/interrupt",
                    "id": id,
                    "params": { "threadId": thread_id, "turnId": turn_id }
                }))
                .await
            {
                self.emit_diagnostic("transportError", format!("turn interrupt: {error}"));
            }
        }
    }

    fn terminate_process_tree(&self) -> Result<(), TransportError> {
        #[cfg(windows)]
        {
            self.process_job
                .terminate()
                .map_err(|error| TransportError::Io(error.to_string()))?;
        }
        #[cfg(unix)]
        process_tree::terminate_process_group(self.process_group_id)
            .map_err(|error| TransportError::Io(error.to_string()))?;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    async fn stop_process_guard(&self) -> Result<(), TransportError> {
        let Some(mut guard) = self.process_guard.lock().await.take() else {
            return Ok(());
        };
        match guard.try_wait() {
            Ok(Some(_)) => Ok(()),
            Ok(None) => {
                guard
                    .kill()
                    .await
                    .map_err(|error| TransportError::Io(error.to_string()))?;
                guard
                    .wait()
                    .await
                    .map_err(|error| TransportError::Io(error.to_string()))?;
                Ok(())
            }
            Err(error) => Err(TransportError::Io(error.to_string())),
        }
    }
}

#[async_trait]
impl AppServerTransport for StdioTransport {
    async fn request(&self, method: &str, params: Value) -> Result<Value, TransportError> {
        let id = self.next_request_id.fetch_add(1, Ordering::SeqCst);
        let key = format!("n:{id}");
        let (sender, receiver) = oneshot::channel();
        self.pending.lock().await.insert(key.clone(), sender);
        if let Err(error) = self
            .write_message(&json!({ "method": method, "id": id, "params": params }))
            .await
        {
            self.pending.lock().await.remove(&key);
            return Err(error);
        }

        match timeout(REQUEST_TIMEOUT, receiver).await {
            Ok(Ok(response)) => response,
            Ok(Err(_)) => Err(TransportError::Disconnected),
            Err(_) => {
                self.pending.lock().await.remove(&key);
                Err(TransportError::Timeout(method.into()))
            }
        }
    }

    async fn notify(&self, method: &str, params: Value) -> Result<(), TransportError> {
        self.write_message(&json!({ "method": method, "params": params }))
            .await
    }

    async fn respond_checked(
        &self,
        id: Value,
        result: Value,
        allowed_methods: &[&str],
    ) -> Result<String, TransportError> {
        let key = id_key(&id)?;
        let mut server_requests = self.server_requests.lock().await;
        let method = server_requests
            .get(&key)
            .cloned()
            .ok_or(TransportError::UnknownServerRequest)?;
        if !allowed_methods.contains(&method.as_str()) {
            return Err(TransportError::UnknownServerRequest);
        }
        self.write_message(&json!({ "id": id, "result": result }))
            .await?;
        server_requests.remove(&key);
        Ok(method)
    }

    async fn shutdown(&self) -> Result<(), TransportError> {
        if self.closed.load(Ordering::SeqCst) {
            let tree_result = self.terminate_process_tree();
            #[cfg(target_os = "macos")]
            return tree_result.and(self.stop_process_guard().await);
            #[cfg(not(target_os = "macos"))]
            return tree_result;
        }
        self.interrupt_active_turns().await;
        // Give App Server a brief opportunity to acknowledge interrupts before
        // the normal EOF shutdown path. The process-tree guard remains the
        // final fallback and bounds total shutdown time.
        sleep(Duration::from_millis(150)).await;
        self.flush_delta_buffer().await;
        if self.closed.swap(true, Ordering::SeqCst) {
            let tree_result = self.terminate_process_tree();
            #[cfg(target_os = "macos")]
            return tree_result.and(self.stop_process_guard().await);
            #[cfg(not(target_os = "macos"))]
            return tree_result;
        }
        self.fail_pending("App Server was stopped").await;
        self.server_requests.lock().await.clear();
        self.stdin.lock().await.take();
        let mut child = self.child.lock().await;
        let result = match child.try_wait() {
            Ok(Some(_)) => Ok(()),
            Ok(None) => match timeout(Duration::from_secs(3), child.wait()).await {
                Ok(Ok(_)) => Ok(()),
                Ok(Err(error)) => Err(TransportError::Io(error.to_string())),
                Err(_) => {
                    let kill_result = child
                        .kill()
                        .await
                        .map_err(|error| TransportError::Io(error.to_string()));
                    if kill_result.is_ok() {
                        let _ = child.wait().await;
                    }
                    kill_result
                }
            },
            Err(error) => Err(TransportError::Io(error.to_string())),
        };
        // Always attempt the OS containment fallback, including the race where
        // the direct child exits between the timeout and Child::kill().
        let tree_result = self.terminate_process_tree();
        #[cfg(target_os = "macos")]
        let guard_result = self.stop_process_guard().await;
        #[cfg(target_os = "macos")]
        return result.and(tree_result).and(guard_result);
        #[cfg(not(target_os = "macos"))]
        result.and(tree_result)
    }
}

#[cfg(unix)]
impl Drop for StdioTransport {
    fn drop(&mut self) {
        let _ = process_tree::terminate_process_group(self.process_group_id);
    }
}

fn delta_buffer_should_flush(buffer: &DeltaBuffer, incoming_bytes: usize) -> bool {
    buffer.bytes.saturating_add(incoming_bytes) > MAX_BUFFERED_DELTA_BYTES
        || buffer.events.len() >= MAX_BUFFERED_DELTA_EVENTS
}

fn push_delta_event(buffer: &mut DeltaBuffer, key: String, message: Value, delta_bytes: usize) {
    if let Some(last) = buffer.events.last_mut() {
        if last.key == key
            && last.bytes.saturating_add(delta_bytes) <= MAX_COALESCED_DELTA_BYTES
            && append_message_delta(&mut last.message, &message)
        {
            last.bytes += delta_bytes;
            buffer.bytes += delta_bytes;
            return;
        }
    }
    buffer.events.push(BufferedDelta {
        key,
        message,
        bytes: delta_bytes,
    });
    buffer.bytes += delta_bytes;
}

fn take_delta_events(buffer: &mut DeltaBuffer) -> Vec<Value> {
    buffer.bytes = 0;
    std::mem::take(&mut buffer.events)
        .into_iter()
        .map(|event| event.message)
        .collect()
}

fn delta_message_key(message: &Value) -> Option<String> {
    let method = message.get("method").and_then(Value::as_str)?;
    if !COALESCED_DELTA_METHODS.contains(&method) {
        return None;
    }
    let params = message.get("params")?;
    let delta = params.get("delta").and_then(Value::as_str)?;
    if delta.is_empty() {
        return None;
    }
    let thread_id = params.get("threadId").and_then(Value::as_str)?;
    let turn_id = params.get("turnId").and_then(Value::as_str)?;
    let item_id = params.get("itemId").and_then(Value::as_str)?;
    Some(format!(
        "{method}\u{1f}{thread_id}\u{1f}{turn_id}\u{1f}{item_id}"
    ))
}

fn append_message_delta(target: &mut Value, incoming: &Value) -> bool {
    let Some(incoming_delta) = incoming
        .get("params")
        .and_then(|params| params.get("delta"))
        .and_then(Value::as_str)
    else {
        return false;
    };
    let Some(target_delta) = target
        .get_mut("params")
        .and_then(Value::as_object_mut)
        .and_then(|params| params.get_mut("delta"))
        .and_then(|delta| delta.as_str())
    else {
        return false;
    };
    let mut combined = String::with_capacity(target_delta.len() + incoming_delta.len());
    combined.push_str(target_delta);
    combined.push_str(incoming_delta);
    if let Some(params) = target.get_mut("params").and_then(Value::as_object_mut) {
        params.insert("delta".into(), Value::String(combined));
        true
    } else {
        false
    }
}

fn id_key(id: &Value) -> Result<String, TransportError> {
    match id {
        Value::Number(number) => Ok(format!("n:{number}")),
        Value::String(value) => Ok(format!("s:{value}")),
        _ => Err(TransportError::InvalidId),
    }
}

fn rpc_error_message(error: &Value) -> String {
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Unknown JSON-RPC error")
        .to_owned();
    match error.get("code").and_then(Value::as_i64) {
        Some(code) => format!("{message} (code {code})"),
        None => message,
    }
}

fn redact_diagnostic(line: &str) -> String {
    let lower = line.to_ascii_lowercase();
    if [
        "authorization",
        "bearer ",
        "api_key",
        "apikey",
        "access_token",
        "password",
        "credential",
        "cookie",
        "token",
        "secret",
        "private_key",
        "c:\\users\\",
        "/users/",
        "/home/",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
        || line.contains('@')
    {
        return "[sensitive App Server diagnostic redacted]".into();
    }
    line.chars().take(500).collect()
}

async fn read_frame<R: AsyncBufRead + Unpin>(
    reader: &mut R,
    max_length: usize,
) -> std::io::Result<Option<Vec<u8>>> {
    let mut frame = Vec::new();
    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            return if frame.is_empty() {
                Ok(None)
            } else {
                Ok(Some(frame))
            };
        }

        if let Some(newline) = available.iter().position(|byte| *byte == b'\n') {
            if frame.len() + newline > max_length {
                reader.consume(newline + 1);
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "App Server line exceeded the safety limit",
                ));
            }
            frame.extend_from_slice(&available[..newline]);
            reader.consume(newline + 1);
            if frame.last() == Some(&b'\r') {
                frame.pop();
            }
            return Ok(Some(frame));
        }

        let available_length = available.len();
        if frame.len() + available_length > max_length {
            reader.consume(available_length);
            loop {
                let remaining = reader.fill_buf().await?;
                if remaining.is_empty() {
                    break;
                }
                if let Some(newline) = remaining.iter().position(|byte| *byte == b'\n') {
                    reader.consume(newline + 1);
                    break;
                }
                let remaining_length = remaining.len();
                reader.consume(remaining_length);
            }
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "App Server line exceeded the safety limit",
            ));
        }
        frame.extend_from_slice(available);
        reader.consume(available_length);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        append_message_delta, delta_buffer_should_flush, delta_message_key, id_key,
        push_delta_event, read_frame, redact_diagnostic, take_delta_events, DeltaBuffer,
        MAX_BUFFERED_DELTA_BYTES, MAX_BUFFERED_DELTA_EVENTS, MAX_COALESCED_DELTA_BYTES,
    };
    use serde_json::json;

    #[test]
    fn ids_keep_number_and_string_namespaces_separate() {
        assert_eq!(id_key(&json!(7)).unwrap(), "n:7");
        assert_eq!(id_key(&json!("7")).unwrap(), "s:7");
    }

    #[test]
    fn diagnostics_with_credentials_are_redacted() {
        assert_eq!(
            redact_diagnostic("Authorization: Bearer private"),
            "[sensitive App Server diagnostic redacted]"
        );
        assert_eq!(
            redact_diagnostic(&format!("signed in as user{}example.invalid", '@')),
            "[sensitive App Server diagnostic redacted]"
        );
        assert_eq!(
            redact_diagnostic(r"cache path C:\Users\someone\.codex"),
            "[sensitive App Server diagnostic redacted]"
        );
        assert_eq!(redact_diagnostic("safe warning"), "safe warning");
    }

    #[test]
    fn adjacent_matching_deltas_can_be_coalesced_without_crossing_items() {
        let mut first = json!({
            "method": "item/agentMessage/delta",
            "params": {
                "threadId": "thread-1",
                "turnId": "turn-1",
                "itemId": "item-1",
                "delta": "hel"
            }
        });
        let second = json!({
            "method": "item/agentMessage/delta",
            "params": {
                "threadId": "thread-1",
                "turnId": "turn-1",
                "itemId": "item-1",
                "delta": "lo"
            }
        });
        let other_item = json!({
            "method": "item/agentMessage/delta",
            "params": {
                "threadId": "thread-1",
                "turnId": "turn-1",
                "itemId": "item-2",
                "delta": "!"
            }
        });

        assert_eq!(delta_message_key(&first), delta_message_key(&second));
        assert_ne!(delta_message_key(&first), delta_message_key(&other_item));
        assert!(append_message_delta(&mut first, &second));
        assert_eq!(first["params"]["delta"], "hello");
    }

    #[tokio::test]
    async fn bounded_frame_reader_handles_crlf_and_rejects_long_lines() {
        let mut reader = tokio::io::BufReader::new(&b"ok\r\ntoolong\nnext\n"[..]);
        assert_eq!(
            read_frame(&mut reader, 4).await.unwrap(),
            Some(b"ok".to_vec())
        );
        assert_eq!(
            read_frame(&mut reader, 4).await.unwrap_err().kind(),
            std::io::ErrorKind::InvalidData
        );
        assert_eq!(
            read_frame(&mut reader, 4).await.unwrap(),
            Some(b"next".to_vec())
        );
    }

    #[test]
    fn hundred_thousand_delta_flood_stays_bounded_without_losing_payload() {
        let mut buffer = DeltaBuffer::default();
        let mut input_bytes = 0usize;
        let mut delivered_bytes = 0usize;
        let mut max_buffered_bytes = 0usize;
        let mut max_buffered_events = 0usize;
        let mut max_coalesced_bytes = 0usize;
        let mut flushes = 0usize;

        let flush = |buffer: &mut DeltaBuffer,
                     delivered_bytes: &mut usize,
                     max_coalesced_bytes: &mut usize,
                     flushes: &mut usize| {
            for message in take_delta_events(buffer) {
                let bytes = message["params"]["delta"].as_str().unwrap().len();
                *delivered_bytes += bytes;
                *max_coalesced_bytes = (*max_coalesced_bytes).max(bytes);
            }
            *flushes += 1;
        };

        for index in 0..100_000usize {
            let message = json!({
                "method": "item/agentMessage/delta",
                "params": {
                    "threadId": "thread-1",
                    "turnId": "turn-1",
                    "itemId": "item-1",
                    "delta": "delta-0123456789"
                }
            });
            let delta_bytes = message["params"]["delta"].as_str().unwrap().len();
            input_bytes += delta_bytes;
            if delta_buffer_should_flush(&buffer, delta_bytes) {
                flush(
                    &mut buffer,
                    &mut delivered_bytes,
                    &mut max_coalesced_bytes,
                    &mut flushes,
                );
            }
            let key = delta_message_key(&message).unwrap();
            push_delta_event(&mut buffer, key, message, delta_bytes);
            max_buffered_bytes = max_buffered_bytes.max(buffer.bytes);
            max_buffered_events = max_buffered_events.max(buffer.events.len());
            assert_eq!(index + 1, input_bytes / delta_bytes);
        }
        flush(
            &mut buffer,
            &mut delivered_bytes,
            &mut max_coalesced_bytes,
            &mut flushes,
        );

        assert_eq!(delivered_bytes, input_bytes);
        assert!(max_buffered_bytes <= MAX_BUFFERED_DELTA_BYTES);
        assert!(max_buffered_events <= MAX_BUFFERED_DELTA_EVENTS);
        assert!(max_coalesced_bytes <= MAX_COALESCED_DELTA_BYTES);
        assert!(flushes > 1);
    }

    #[cfg(windows)]
    #[tokio::test]
    async fn windows_job_termination_kills_spawned_descendants() {
        use std::{os::windows::process::CommandExt, time::Instant};
        use tokio::{
            io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
            process::Command,
            time::{sleep, timeout, Duration},
        };
        use windows_sys::Win32::{
            Foundation::{CloseHandle, WAIT_OBJECT_0},
            System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE},
        };

        fn is_running(process_id: u32) -> bool {
            unsafe {
                let handle = OpenProcess(PROCESS_SYNCHRONIZE, 0, process_id);
                if handle.is_null() {
                    return false;
                }
                let state = WaitForSingleObject(handle, 0);
                CloseHandle(handle);
                state != WAIT_OBJECT_0
            }
        }

        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let script = "$null=[Console]::In.ReadLine(); $child=Start-Process -FilePath \"$env:SystemRoot\\System32\\ping.exe\" -ArgumentList \"127.0.0.1\",\"-n\",\"30\" -PassThru; [Console]::Out.WriteLine($child.Id); [Console]::Out.Flush(); $child.WaitForExit()";
        let mut command = Command::new("powershell.exe");
        command
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true);
        command.as_std_mut().creation_flags(CREATE_NO_WINDOW);
        let mut parent = command.spawn().unwrap();
        let parent_id = parent.id().unwrap();
        let process_job = super::process_tree::ProcessJob::assign(parent_id).unwrap();
        parent
            .stdin
            .as_mut()
            .unwrap()
            .write_all(b"start\n")
            .await
            .unwrap();

        let mut output = BufReader::new(parent.stdout.take().unwrap());
        let mut line = String::new();
        // Fresh GitHub-hosted Windows runners can spend tens of seconds
        // starting Windows PowerShell under Defender load. This timeout only
        // covers fixture startup; the post-termination deadline stays strict.
        timeout(Duration::from_secs(60), output.read_line(&mut line))
            .await
            .expect("PowerShell fixture did not report its descendant PID within 60 seconds")
            .expect("failed to read descendant PID from PowerShell fixture");
        let descendant_id: u32 = line.trim().parse().unwrap();
        assert!(is_running(descendant_id));

        process_job.terminate().unwrap();
        timeout(Duration::from_secs(5), parent.wait())
            .await
            .unwrap()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        while is_running(descendant_id) && Instant::now() < deadline {
            sleep(Duration::from_millis(25)).await;
        }
        assert!(!is_running(descendant_id));
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn unix_process_group_termination_kills_spawned_descendants() {
        use std::{os::unix::process::CommandExt, time::Instant};
        use tokio::{
            io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
            process::Command,
            time::{sleep, timeout, Duration},
        };

        fn is_running(process_id: i32) -> bool {
            unsafe {
                if libc::kill(process_id, 0) == 0 {
                    return true;
                }
                std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
            }
        }

        let mut command = Command::new("sh");
        command
            .args([
                "-c",
                "read gate; sleep 30 & child=$!; echo $child; wait $child",
            ])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true);
        unsafe {
            command.as_std_mut().pre_exec(|| {
                if libc::setpgid(0, 0) == -1 {
                    Err(std::io::Error::last_os_error())
                } else {
                    Ok(())
                }
            });
        }
        let mut parent = command.spawn().unwrap();
        let process_group_id = parent.id().unwrap() as i32;
        parent
            .stdin
            .as_mut()
            .unwrap()
            .write_all(b"start\n")
            .await
            .unwrap();

        let mut output = BufReader::new(parent.stdout.take().unwrap());
        let mut line = String::new();
        timeout(Duration::from_secs(5), output.read_line(&mut line))
            .await
            .unwrap()
            .unwrap();
        let descendant_id: i32 = line.trim().parse().unwrap();
        assert!(is_running(descendant_id));

        super::process_tree::terminate_process_group(process_group_id).unwrap();
        timeout(Duration::from_secs(5), parent.wait())
            .await
            .unwrap()
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        while is_running(descendant_id) && Instant::now() < deadline {
            sleep(Duration::from_millis(25)).await;
        }
        assert!(!is_running(descendant_id));
    }
}

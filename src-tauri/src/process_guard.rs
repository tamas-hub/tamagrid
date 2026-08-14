use std::{
    env,
    ffi::{OsStr, OsString},
    io,
    io::Write,
    process::Stdio,
    ptr,
};

use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, Command},
    time::{timeout, Duration},
};

const PROCESS_GUARD_ARGUMENT: &str = "--tamagrid-macos-process-group-guard";
const PROCESS_GUARD_READY: &str = "tamagrid-process-group-guard-ready";
const PROCESS_GUARD_START_TIMEOUT: Duration = Duration::from_secs(5);

pub(crate) fn run_if_requested() -> Option<i32> {
    let arguments = env::args_os().collect::<Vec<_>>();
    if arguments.get(1).map(OsString::as_os_str) != Some(OsStr::new(PROCESS_GUARD_ARGUMENT)) {
        return None;
    }

    let result = parse_guard_arguments(&arguments)
        .and_then(|(owner_pid, process_group_id)| run_guard(owner_pid, process_group_id));
    if let Err(error) = result {
        eprintln!("TamaGrid process-group guard failed: {error}");
        Some(2)
    } else {
        Some(0)
    }
}

pub(crate) async fn spawn(process_group_id: i32) -> io::Result<Child> {
    if process_group_id <= 1 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "The guarded process-group id is invalid",
        ));
    }

    let executable = env::current_exe()?.canonicalize()?;
    let mut command = Command::new(executable);
    command
        .arg(PROCESS_GUARD_ARGUMENT)
        .arg(std::process::id().to_string())
        .arg(process_group_id.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    let mut child = command.spawn()?;
    let stdout = child.stdout.take().ok_or_else(|| {
        io::Error::other("The macOS process-group guard did not expose its readiness pipe")
    })?;
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    let readiness = timeout(PROCESS_GUARD_START_TIMEOUT, reader.read_line(&mut line)).await;
    let ready =
        matches!(readiness, Ok(Ok(bytes)) if bytes > 0 && line.trim() == PROCESS_GUARD_READY);
    if !ready {
        let _ = child.kill().await;
        let _ = child.wait().await;
        return Err(io::Error::other(
            "The macOS process-group guard did not become ready",
        ));
    }
    Ok(child)
}

fn parse_guard_arguments(arguments: &[OsString]) -> Result<(i32, i32), String> {
    if arguments.len() != 4 || arguments[1] != OsStr::new(PROCESS_GUARD_ARGUMENT) {
        return Err("The process-group guard received unexpected arguments".into());
    }
    let owner_pid = parse_pid(&arguments[2], "owner")?;
    let process_group_id = parse_pid(&arguments[3], "process group")?;
    if owner_pid == process_group_id {
        return Err("The owner and guarded process group must be different".into());
    }
    Ok((owner_pid, process_group_id))
}

fn parse_pid(value: &OsStr, label: &str) -> Result<i32, String> {
    let value = value
        .to_str()
        .ok_or_else(|| format!("The process-group guard {label} pid is not valid Unicode"))?;
    let parsed = value
        .parse::<i32>()
        .map_err(|_| format!("The process-group guard {label} pid is invalid"))?;
    if parsed <= 1 {
        return Err(format!(
            "The process-group guard {label} pid must be greater than one"
        ));
    }
    Ok(parsed)
}

fn run_guard(owner_pid: i32, process_group_id: i32) -> Result<(), String> {
    let own_group = unsafe { libc::getpgrp() };
    if own_group == process_group_id {
        return Err("The process-group guard refuses to target its own group".into());
    }

    let observed_group = unsafe { libc::getpgid(process_group_id) };
    if observed_group == -1 {
        let validation_error = io::Error::last_os_error();
        let cleanup_error = terminate_process_group(process_group_id).err();
        return Err(match cleanup_error {
            Some(cleanup_error) => format!(
                "The guarded process group is unavailable: {validation_error}; cleanup also failed: {cleanup_error}"
            ),
            None => format!("The guarded process group is unavailable: {validation_error}"),
        });
    }
    if observed_group != process_group_id {
        return Err("The guarded pid is not a process-group leader".into());
    }

    // Once the target group is validated, every exit path is fail-closed. This
    // also covers the narrow race where TamaGrid exits before kqueue is ready.
    let monitor_result = monitor_owner_and_group_leader(owner_pid, process_group_id);
    let termination_result = terminate_process_group(process_group_id);
    match (monitor_result, termination_result) {
        (Ok(()), Ok(())) => Ok(()),
        (Err(error), Ok(())) => Err(error),
        (Ok(()), Err(error)) => Err(format!(
            "Could not terminate the guarded process group: {error}"
        )),
        (Err(monitor_error), Err(termination_error)) => Err(format!(
            "{monitor_error}; process-group cleanup also failed: {termination_error}"
        )),
    }
}

fn monitor_owner_and_group_leader(owner_pid: i32, process_group_id: i32) -> Result<(), String> {
    let actual_parent = unsafe { libc::getppid() };
    if actual_parent != owner_pid {
        return Err("The process-group guard owner exited before monitoring was ready".into());
    }

    let queue = Kqueue::new().map_err(|error| error.to_string())?;
    queue
        .watch_process_exit(owner_pid)
        .map_err(|error| error.to_string())?;
    // Watching the leader as well as the owner bounds the lifetime of the
    // guard and prevents it from retaining a stale process-group identifier.
    queue
        .watch_process_exit(process_group_id)
        .map_err(|error| error.to_string())?;
    println!("{PROCESS_GUARD_READY}");
    io::stdout()
        .flush()
        .map_err(|error| format!("Could not report process-group guard readiness: {error}"))?;
    queue
        .wait_for_process_exit([owner_pid, process_group_id])
        .map_err(|error| error.to_string())
}

fn terminate_process_group(process_group_id: i32) -> io::Result<()> {
    if unsafe { libc::kill(-process_group_id, libc::SIGKILL) } == -1 {
        let error = io::Error::last_os_error();
        if error.raw_os_error() != Some(libc::ESRCH) {
            return Err(error);
        }
    }
    Ok(())
}

struct Kqueue(i32);

impl Kqueue {
    fn new() -> io::Result<Self> {
        let descriptor = unsafe { libc::kqueue() };
        if descriptor == -1 {
            Err(io::Error::last_os_error())
        } else {
            Ok(Self(descriptor))
        }
    }

    fn watch_process_exit(&self, process_id: i32) -> io::Result<()> {
        let change = libc::kevent {
            ident: process_id as libc::uintptr_t,
            filter: libc::EVFILT_PROC,
            flags: libc::EV_ADD | libc::EV_ENABLE | libc::EV_ONESHOT,
            fflags: libc::NOTE_EXIT,
            data: 0,
            udata: ptr::null_mut(),
        };
        let result = unsafe { libc::kevent(self.0, &change, 1, ptr::null_mut(), 0, ptr::null()) };
        if result == -1 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        }
    }

    fn wait_for_process_exit(&self, process_ids: [i32; 2]) -> io::Result<()> {
        loop {
            let mut event = libc::kevent {
                ident: 0,
                filter: 0,
                flags: 0,
                fflags: 0,
                data: 0,
                udata: ptr::null_mut(),
            };
            let result =
                unsafe { libc::kevent(self.0, ptr::null(), 0, &mut event, 1, ptr::null()) };
            if result == -1 {
                let error = io::Error::last_os_error();
                if error.kind() == io::ErrorKind::Interrupted {
                    continue;
                }
                return Err(error);
            }
            if result == 1 && event.flags & libc::EV_ERROR != 0 {
                return Err(io::Error::from_raw_os_error(event.data as i32));
            }
            if result == 1
                && event.filter == libc::EVFILT_PROC
                && event.fflags & libc::NOTE_EXIT != 0
                && process_ids
                    .iter()
                    .any(|process_id| event.ident == *process_id as libc::uintptr_t)
            {
                return Ok(());
            }
        }
    }
}

impl Drop for Kqueue {
    fn drop(&mut self) {
        unsafe {
            libc::close(self.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_guard_arguments, PROCESS_GUARD_ARGUMENT};

    #[test]
    fn guard_arguments_require_two_distinct_positive_pids() {
        let valid = vec![
            "tamagrid".into(),
            PROCESS_GUARD_ARGUMENT.into(),
            "101".into(),
            "202".into(),
        ];
        assert_eq!(parse_guard_arguments(&valid).unwrap(), (101, 202));

        for invalid in [
            vec!["tamagrid".into(), PROCESS_GUARD_ARGUMENT.into()],
            vec![
                "tamagrid".into(),
                PROCESS_GUARD_ARGUMENT.into(),
                "1".into(),
                "202".into(),
            ],
            vec![
                "tamagrid".into(),
                PROCESS_GUARD_ARGUMENT.into(),
                "101".into(),
                "101".into(),
            ],
        ] {
            assert!(parse_guard_arguments(&invalid).is_err());
        }
    }
}

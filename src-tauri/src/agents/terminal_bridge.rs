//! ACP `terminal/*` (design doc 3.6): agent-run commands on plain pipes, not
//! the interactive PTY terminal. Output from stdout and stderr is merged into
//! one buffer that keeps the *tail* once `outputByteLimit` is exceeded.

use super::acp::RpcError;
use super::events::{AgentEvent, EventSink};
use super::fs_bridge;
use super::process::{JobObject, hide_console};
use agent_client_protocol_schema::v1::TerminalExitStatus;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::{Child, Command};
use tokio::sync::watch;

/// Default cap when the agent does not send `outputByteLimit` (1 MiB).
pub const DEFAULT_OUTPUT_LIMIT: usize = 1024 * 1024;
/// Live output to the UI is batched at most this often.
const FLUSH_EVERY: Duration = Duration::from_millis(100);
const FLUSH_BYTES: usize = 8 * 1024;

/// Bounded output buffer that drops from the front, on a char boundary.
#[derive(Debug, Default)]
pub struct OutputBuffer {
    text: String,
    limit: usize,
    truncated: bool,
}

impl OutputBuffer {
    pub fn new(limit: usize) -> Self {
        Self {
            text: String::new(),
            limit,
            truncated: false,
        }
    }

    pub fn push(&mut self, chunk: &str) {
        self.text.push_str(chunk);
        if self.text.len() <= self.limit {
            return;
        }
        let mut cut = self.text.len() - self.limit;
        while !self.text.is_char_boundary(cut) {
            cut += 1;
        }
        self.text.drain(..cut);
        self.truncated = true;
    }

    pub fn snapshot(&self) -> (String, bool) {
        (self.text.clone(), self.truncated)
    }
}

/// Splits valid UTF-8 off the front of `pending`, keeping an incomplete
/// trailing sequence for the next read. Invalid bytes become U+FFFD.
pub fn take_utf8(pending: &mut Vec<u8>) -> String {
    match std::str::from_utf8(pending) {
        Ok(text) => {
            let out = text.to_owned();
            pending.clear();
            out
        }
        Err(err) if err.error_len().is_none() => {
            let valid = err.valid_up_to();
            let out = String::from_utf8_lossy(&pending[..valid]).into_owned();
            pending.drain(..valid);
            out
        }
        Err(_) => {
            let out = String::from_utf8_lossy(pending).into_owned();
            pending.clear();
            out
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct ExitInfo {
    code: Option<u32>,
    signal: Option<String>,
}

impl ExitInfo {
    fn to_status(&self) -> TerminalExitStatus {
        TerminalExitStatus::new()
            .exit_code(self.code)
            .signal(self.signal.clone())
    }
}

struct Terminal {
    session_id: String,
    output: Arc<Mutex<OutputBuffer>>,
    exit: watch::Receiver<Option<ExitInfo>>,
    kill: Option<tokio::sync::oneshot::Sender<()>>,
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

/// All agent terminals, keyed by terminal id.
#[derive(Clone, Default)]
pub struct TerminalBridge {
    terminals: Arc<Mutex<HashMap<String, Terminal>>>,
    events: EventSink,
}

impl TerminalBridge {
    pub fn new(events: EventSink) -> Self {
        Self {
            terminals: Arc::default(),
            events,
        }
    }

    /// `terminal/create`. `roots` are the session's canonical workspace roots.
    #[allow(clippy::too_many_arguments)]
    pub fn create(
        &self,
        session_id: &str,
        command: &str,
        args: &[String],
        env: &[(String, String)],
        cwd: Option<&Path>,
        output_limit: Option<u64>,
        roots: &[PathBuf],
    ) -> Result<String, RpcError> {
        let cwd = match cwd {
            Some(dir) => fs_bridge::resolve_in_roots(dir, roots)
                .map_err(|err| RpcError::invalid_params(err.to_string()))?,
            None => roots
                .first()
                .cloned()
                .ok_or_else(|| RpcError::invalid_params("session has no workspace"))?,
        };
        let limit = output_limit
            .and_then(|n| usize::try_from(n).ok())
            .unwrap_or(DEFAULT_OUTPUT_LIMIT)
            .max(1);

        let mut child = spawn_command(command, args, env, &cwd)
            .map_err(|err| RpcError::internal(format!("could not start `{command}`: {err}")))?;
        let job = JobObject::new().ok();
        if let Some(job) = &job {
            let _ = job.assign(&child);
        }

        let id = format!("term_{}", uuid::Uuid::new_v4().simple());
        let output = Arc::new(Mutex::new(OutputBuffer::new(limit)));
        let (exit_tx, exit_rx) = watch::channel(None);
        let (kill_tx, kill_rx) = tokio::sync::oneshot::channel::<()>();

        let live = LiveOutput::new(self.events.clone(), session_id, &id);
        if let Some(stdout) = child.stdout.take() {
            tokio::spawn(pump(stdout, Arc::clone(&output), live.clone()));
        }
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(pump(stderr, Arc::clone(&output), live.clone()));
        }
        tokio::spawn(supervise(child, job, kill_rx, exit_tx, live));

        lock(&self.terminals).insert(
            id.clone(),
            Terminal {
                session_id: session_id.to_owned(),
                output,
                exit: exit_rx,
                kill: Some(kill_tx),
            },
        );
        Ok(id)
    }

    fn with_terminal<T>(
        &self,
        session_id: &str,
        terminal_id: &str,
        f: impl FnOnce(&mut Terminal) -> T,
    ) -> Result<T, RpcError> {
        let mut map = lock(&self.terminals);
        match map.get_mut(terminal_id) {
            Some(term) if term.session_id == session_id => Ok(f(term)),
            _ => Err(RpcError::not_found(format!(
                "unknown terminal {terminal_id}"
            ))),
        }
    }

    /// `terminal/output`.
    pub fn output(
        &self,
        session_id: &str,
        terminal_id: &str,
    ) -> Result<(String, bool, Option<TerminalExitStatus>), RpcError> {
        self.with_terminal(session_id, terminal_id, |term| {
            let (text, truncated) = lock(&term.output).snapshot();
            let exit = term.exit.borrow().as_ref().map(ExitInfo::to_status);
            (text, truncated, exit)
        })
    }

    /// `terminal/wait_for_exit`.
    pub async fn wait_for_exit(
        &self,
        session_id: &str,
        terminal_id: &str,
    ) -> Result<TerminalExitStatus, RpcError> {
        let mut exit = self.with_terminal(session_id, terminal_id, |term| term.exit.clone())?;
        loop {
            if let Some(info) = exit.borrow().as_ref() {
                return Ok(info.to_status());
            }
            if exit.changed().await.is_err() {
                return Ok(TerminalExitStatus::new());
            }
        }
    }

    /// `terminal/kill`: stops the process but keeps the terminal readable.
    pub fn kill(&self, session_id: &str, terminal_id: &str) -> Result<(), RpcError> {
        self.with_terminal(session_id, terminal_id, |term| {
            if let Some(kill) = term.kill.take() {
                let _ = kill.send(());
            }
        })
    }

    /// `terminal/release`: kills and forgets the terminal.
    pub fn release(&self, session_id: &str, terminal_id: &str) -> Result<(), RpcError> {
        self.kill(session_id, terminal_id)?;
        lock(&self.terminals).remove(terminal_id);
        Ok(())
    }

    /// Kills and forgets every terminal of a session (session closed or crashed).
    pub fn release_session(&self, session_id: &str) {
        let mut map = lock(&self.terminals);
        map.retain(|_, term| {
            if term.session_id != session_id {
                return true;
            }
            if let Some(kill) = term.kill.take() {
                let _ = kill.send(());
            }
            false
        });
    }

    /// Kills everything (app shutdown).
    pub fn release_all(&self) {
        let mut map = lock(&self.terminals);
        for term in map.values_mut() {
            if let Some(kill) = term.kill.take() {
                let _ = kill.send(());
            }
        }
        map.clear();
    }
}

/// Spawns the command hidden. A bare command line (agents often send one
/// string) or a non-executable name runs through the platform shell.
fn spawn_command(
    command: &str,
    args: &[String],
    env: &[(String, String)],
    cwd: &Path,
) -> std::io::Result<Child> {
    let build = |use_shell: bool| {
        let mut cmd = if use_shell {
            shell_command(command, args)
        } else {
            let mut cmd = Command::new(command);
            cmd.args(args);
            cmd
        };
        cmd.current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        for (key, value) in env {
            cmd.env(key, value);
        }
        hide_console(&mut cmd);
        cmd
    };
    let looks_like_shell_line = args.is_empty() && command.contains(char::is_whitespace);
    if looks_like_shell_line {
        return build(true).spawn();
    }
    match build(false).spawn() {
        Ok(child) => Ok(child),
        // Not an executable on PATH (e.g. a shell builtin or a .cmd shim): retry via the shell.
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => build(true).spawn(),
        Err(err) => Err(err),
    }
}

#[cfg(windows)]
fn shell_command(command: &str, args: &[String]) -> Command {
    let mut line = command.to_owned();
    for arg in args {
        line.push(' ');
        line.push_str(&quote_windows_arg(arg));
    }
    let mut cmd = Command::new("cmd.exe");
    // `/S /C "<line>"`: cmd strips exactly the outer quotes and runs the rest verbatim.
    cmd.raw_arg(format!("/S /C \"{line}\""));
    cmd
}

#[cfg(not(windows))]
fn shell_command(command: &str, args: &[String]) -> Command {
    let mut line = command.to_owned();
    for arg in args {
        line.push(' ');
        line.push('\'');
        line.push_str(&arg.replace('\'', "'\\''"));
        line.push('\'');
    }
    let mut cmd = Command::new("/bin/sh");
    cmd.arg("-c").arg(line);
    cmd
}

/// Quotes one argument for a Windows command line (CommandLineToArgvW rules).
#[cfg(windows)]
pub fn quote_windows_arg(arg: &str) -> String {
    if !arg.is_empty() && !arg.contains([' ', '\t', '"']) {
        return arg.to_owned();
    }
    let mut out = String::from('"');
    let mut backslashes = 0;
    for ch in arg.chars() {
        match ch {
            '\\' => backslashes += 1,
            '"' => {
                out.extend(std::iter::repeat_n('\\', backslashes * 2 + 1));
                out.push('"');
                backslashes = 0;
            }
            _ => {
                out.extend(std::iter::repeat_n('\\', backslashes));
                out.push(ch);
                backslashes = 0;
            }
        }
    }
    out.extend(std::iter::repeat_n('\\', backslashes * 2));
    out.push('"');
    out
}

/// Batches live output for the UI (100 ms or 8 KiB, whichever comes first).
#[derive(Clone)]
struct LiveOutput {
    events: EventSink,
    session_id: String,
    terminal_id: String,
    pending: Arc<Mutex<(String, Option<tokio::time::Instant>)>>,
}

impl LiveOutput {
    fn new(events: EventSink, session_id: &str, terminal_id: &str) -> Self {
        Self {
            events,
            session_id: session_id.to_owned(),
            terminal_id: terminal_id.to_owned(),
            pending: Arc::default(),
        }
    }

    fn push(&self, chunk: &str) {
        let flush = {
            let mut pending = lock(&self.pending);
            pending.0.push_str(chunk);
            let started = *pending.1.get_or_insert_with(tokio::time::Instant::now);
            pending.0.len() >= FLUSH_BYTES || started.elapsed() >= FLUSH_EVERY
        };
        if flush {
            self.flush();
        }
    }

    fn flush(&self) {
        let chunk = {
            let mut pending = lock(&self.pending);
            pending.1 = None;
            std::mem::take(&mut pending.0)
        };
        if !chunk.is_empty() {
            self.events.emit(AgentEvent::TerminalOutput {
                session_id: self.session_id.clone(),
                terminal_id: self.terminal_id.clone(),
                chunk,
            });
        }
    }
}

async fn pump<R: AsyncRead + Unpin>(
    mut reader: R,
    output: Arc<Mutex<OutputBuffer>>,
    live: LiveOutput,
) {
    let mut buf = [0u8; 8192];
    let mut pending = Vec::new();
    loop {
        match reader.read(&mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(n) => {
                pending.extend_from_slice(&buf[..n]);
                let text = take_utf8(&mut pending);
                if !text.is_empty() {
                    lock(&output).push(&text);
                    live.push(&text);
                }
            }
        }
    }
    if !pending.is_empty() {
        let text = String::from_utf8_lossy(&pending).into_owned();
        lock(&output).push(&text);
        live.push(&text);
    }
    live.flush();
}

async fn supervise(
    mut child: Child,
    job: Option<JobObject>,
    kill: tokio::sync::oneshot::Receiver<()>,
    exit_tx: watch::Sender<Option<ExitInfo>>,
    live: LiveOutput,
) {
    let status = tokio::select! {
        status = child.wait() => status.ok(),
        _ = kill => {
            if let Some(job) = &job {
                job.terminate();
            }
            let _ = child.start_kill();
            child.wait().await.ok()
        }
    };
    let info = ExitInfo {
        code: status
            .and_then(|s| s.code())
            .and_then(|c| u32::try_from(c).ok()),
        signal: exit_signal(status),
    };
    // Let the pumps drain the last bytes before the exit is announced.
    tokio::time::sleep(Duration::from_millis(30)).await;
    live.flush();
    live.events.emit(AgentEvent::TerminalExited {
        session_id: live.session_id.clone(),
        terminal_id: live.terminal_id.clone(),
        exit_code: info.code.and_then(|c| i32::try_from(c).ok()),
        signal: info.signal.clone(),
    });
    let _ = exit_tx.send(Some(info));
    drop(job);
}

#[cfg(unix)]
fn exit_signal(status: Option<std::process::ExitStatus>) -> Option<String> {
    use std::os::unix::process::ExitStatusExt;
    status.and_then(|s| s.signal()).map(|sig| sig.to_string())
}

#[cfg(not(unix))]
fn exit_signal(_status: Option<std::process::ExitStatus>) -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_buffer_keeps_the_tail_on_a_char_boundary() {
        let mut buf = OutputBuffer::new(5);
        buf.push("abc");
        assert_eq!(buf.snapshot(), ("abc".to_owned(), false));
        buf.push("déf");
        let (text, truncated) = buf.snapshot();
        assert!(truncated);
        assert!(text.len() <= 5);
        assert!(text.ends_with("éf"));
    }

    #[test]
    fn take_utf8_holds_back_incomplete_sequences() {
        let mut pending = "ab".as_bytes().to_vec();
        pending.push(0xC3); // first byte of "é"
        assert_eq!(take_utf8(&mut pending), "ab");
        assert_eq!(pending, vec![0xC3]);
        pending.push(0xA9);
        assert_eq!(take_utf8(&mut pending), "é");
        assert!(pending.is_empty());
    }

    #[test]
    fn take_utf8_replaces_invalid_bytes() {
        let mut pending = vec![b'a', 0xFF, b'b'];
        assert_eq!(take_utf8(&mut pending), "a\u{FFFD}b");
    }

    #[cfg(windows)]
    #[test]
    fn quotes_windows_args() {
        assert_eq!(quote_windows_arg("plain"), "plain");
        assert_eq!(quote_windows_arg("two words"), "\"two words\"");
        assert_eq!(quote_windows_arg(r#"say "hi""#), r#""say \"hi\"""#);
        assert_eq!(quote_windows_arg(r"C:\dir\ "), r#""C:\dir\ ""#);
        assert_eq!(quote_windows_arg(""), "\"\"");
    }

    #[tokio::test]
    async fn runs_a_command_and_reports_exit() {
        let dir = tempfile::tempdir().unwrap();
        let roots = fs_bridge::canonical_roots(&[dir.path()]);
        let bridge = TerminalBridge::new(EventSink::default());
        let (cmd, args): (&str, Vec<String>) = if cfg!(windows) {
            ("cmd.exe", vec!["/C".into(), "echo hello& exit 3".into()])
        } else {
            ("/bin/sh", vec!["-c".into(), "echo hello; exit 3".into()])
        };
        let id = bridge
            .create("s1", cmd, &args, &[], None, None, &roots)
            .unwrap();
        let status = bridge.wait_for_exit("s1", &id).await.unwrap();
        assert_eq!(status.exit_code, Some(3));
        let (text, truncated, exit) = bridge.output("s1", &id).unwrap();
        assert!(text.contains("hello"));
        assert!(!truncated);
        assert!(exit.is_some());
        // Another session cannot read it.
        assert!(bridge.output("s2", &id).is_err());
        bridge.release("s1", &id).unwrap();
        assert!(bridge.output("s1", &id).is_err());
    }

    #[tokio::test]
    async fn rejects_cwd_outside_the_workspace() {
        let dir = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let roots = fs_bridge::canonical_roots(&[dir.path()]);
        let bridge = TerminalBridge::new(EventSink::default());
        let err = bridge
            .create("s1", "echo", &[], &[], Some(other.path()), None, &roots)
            .unwrap_err();
        assert_eq!(err.code, RpcError::INVALID_PARAMS);
    }
}

//! Agent adapter child processes: hidden console, kill-on-close Job Object,
//! and a masked stderr tail for the crash card (design doc 3.8).

use std::collections::VecDeque;
use std::ffi::OsString;
use std::io;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex, PoisonError};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command};

/// Lines of stderr kept for the crash card.
pub const STDERR_TAIL_LINES: usize = 200;
/// A single stderr line is cut beyond this many bytes.
const STDERR_LINE_MAX: usize = 2_000;

/// No console window and its own process group, so the child neither flashes
/// a console nor receives the app's Ctrl+C. No-op off Windows.
pub fn hide_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Threading::{CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW};
        cmd.creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP);
    }
    #[cfg(not(windows))]
    let _ = cmd;
}

/// Windows Job Object with `KILL_ON_JOB_CLOSE`: dropping it (or the app
/// dying) kills every process assigned to it, grandchildren included.
/// Off Windows it is an inert placeholder and `kill_on_drop` does the work.
pub struct JobObject {
    #[cfg(windows)]
    handle: windows_sys::Win32::Foundation::HANDLE,
}

// SAFETY: a Job Object handle is a kernel handle usable from any thread.
unsafe impl Send for JobObject {}
unsafe impl Sync for JobObject {}

impl JobObject {
    #[cfg(windows)]
    pub fn new() -> io::Result<Self> {
        use windows_sys::Win32::System::JobObjects::{
            CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
            SetInformationJobObject,
        };
        // SAFETY: plain Win32 calls; the handle is owned by `Self` and closed in Drop.
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle.is_null() {
                return Err(io::Error::last_os_error());
            }
            let job = Self { handle };
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = SetInformationJobObject(
                job.handle,
                JobObjectExtendedLimitInformation,
                (&raw const info).cast(),
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if ok == 0 {
                return Err(io::Error::last_os_error());
            }
            Ok(job)
        }
    }

    #[cfg(not(windows))]
    pub fn new() -> io::Result<Self> {
        Ok(Self {})
    }

    /// Puts a freshly spawned child into the job.
    #[cfg(windows)]
    pub fn assign(&self, child: &Child) -> io::Result<()> {
        use windows_sys::Win32::System::JobObjects::AssignProcessToJobObject;
        let Some(process) = child.raw_handle() else {
            return Err(io::Error::other("child already exited"));
        };
        // SAFETY: both handles are valid for the duration of the call.
        if unsafe { AssignProcessToJobObject(self.handle, process.cast()) } == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(())
    }

    #[cfg(not(windows))]
    pub fn assign(&self, _child: &Child) -> io::Result<()> {
        Ok(())
    }

    /// Kills every process in the job now.
    pub fn terminate(&self) {
        #[cfg(windows)]
        // SAFETY: valid handle owned by self.
        unsafe {
            windows_sys::Win32::System::JobObjects::TerminateJobObject(self.handle, 1);
        }
    }
}

impl Drop for JobObject {
    fn drop(&mut self) {
        #[cfg(windows)]
        // SAFETY: the handle was created by `new` and is closed exactly once.
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.handle);
        }
    }
}

/// Masks things that look like credentials before stderr is shown or logged.
pub fn mask_secrets(line: &str) -> String {
    const MARKERS: [&str; 6] = ["sk-", "Bearer ", "bearer ", "ya29.", "ghp_", "AIza"];
    let mut out = String::with_capacity(line.len());
    let mut rest = line;
    'scan: while !rest.is_empty() {
        // Only at a word start, so "task-list" is not mistaken for "sk-...".
        let at_boundary = out.chars().next_back().is_none_or(|c| !c.is_alphanumeric());
        for marker in MARKERS {
            if at_boundary && rest.starts_with(marker) {
                out.push_str(marker);
                out.push_str("***");
                let skip = rest[marker.len()..]
                    .find(|c: char| c.is_whitespace() || matches!(c, '"' | '\'' | ',' | ';'))
                    .map_or(rest.len(), |i| marker.len() + i);
                rest = &rest[skip..];
                continue 'scan;
            }
        }
        let ch = rest.chars().next().expect("non-empty");
        out.push(ch);
        rest = &rest[ch.len_utf8()..];
    }
    // Generic `KEY=value` / `"token": "value"` forms for well-known names.
    for key in ["API_KEY", "AUTH_TOKEN", "access_token", "refresh_token"] {
        if let Some(pos) = out.find(key) {
            let after = pos + key.len();
            let value_start = out[after..]
                .find(|c: char| !matches!(c, '=' | ':' | '"' | ' '))
                .map(|i| after + i);
            if let Some(start) = value_start {
                let end = out[start..]
                    .find(|c: char| c.is_whitespace() || matches!(c, '"' | ',' | ';'))
                    .map_or(out.len(), |i| start + i);
                if end > start {
                    out.replace_range(start..end, "***");
                }
            }
        }
    }
    out
}

/// Ring buffer of the last stderr lines (already masked).
#[derive(Debug, Default)]
pub struct StderrTail {
    lines: VecDeque<String>,
}

impl StderrTail {
    pub fn push(&mut self, line: &str) {
        let mut line = mask_secrets(line.trim_end_matches(['\r', '\n']));
        if line.len() > STDERR_LINE_MAX {
            let mut cut = STDERR_LINE_MAX;
            while !line.is_char_boundary(cut) {
                cut -= 1;
            }
            line.truncate(cut);
            line.push('…');
        }
        if self.lines.len() == STDERR_TAIL_LINES {
            self.lines.pop_front();
        }
        self.lines.push_back(line);
    }

    pub fn snapshot(&self) -> Vec<String> {
        self.lines.iter().cloned().collect()
    }
}

pub type SharedStderrTail = Arc<Mutex<StderrTail>>;

pub fn stderr_snapshot(tail: &SharedStderrTail) -> Vec<String> {
    tail.lock()
        .unwrap_or_else(PoisonError::into_inner)
        .snapshot()
}

/// What to run. `env_remove` wins over the inherited environment.
#[derive(Debug, Clone, Default)]
pub struct LaunchSpec {
    pub program: PathBuf,
    pub args: Vec<OsString>,
    pub cwd: Option<PathBuf>,
    pub env_set: Vec<(String, String)>,
    pub env_remove: Vec<String>,
}

/// A running adapter with its pipes split out for the transport.
pub struct AgentProcess {
    pub child: Child,
    pub job: Option<JobObject>,
    pub stdin: ChildStdin,
    pub stdout: ChildStdout,
    pub stderr_tail: SharedStderrTail,
}

/// Spawns the adapter hidden, inside a fresh Job Object, and starts draining
/// stderr into the tail. A failure to create the job is not fatal
/// (`kill_on_drop` still covers the direct child).
pub fn spawn(spec: &LaunchSpec) -> io::Result<AgentProcess> {
    let mut cmd = Command::new(&spec.program);
    cmd.args(&spec.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    if let Some(cwd) = &spec.cwd {
        cmd.current_dir(cwd);
    }
    for key in &spec.env_remove {
        cmd.env_remove(key);
    }
    for (key, value) in &spec.env_set {
        cmd.env(key, value);
    }
    hide_console(&mut cmd);

    let job = JobObject::new().ok();
    let mut child = cmd.spawn()?;
    if let Some(job) = &job {
        // Best effort: if the child is already in a non-nestable job we still run.
        let _ = job.assign(&child);
    }
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| io::Error::other("no stdin pipe"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| io::Error::other("no stdout pipe"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| io::Error::other("no stderr pipe"))?;
    let stderr_tail = SharedStderrTail::default();
    tokio::spawn(drain_stderr(stderr, Arc::clone(&stderr_tail)));
    Ok(AgentProcess {
        child,
        job,
        stdin,
        stdout,
        stderr_tail,
    })
}

async fn drain_stderr(stderr: ChildStderr, tail: SharedStderrTail) {
    let mut reader = BufReader::new(stderr);
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let line = String::from_utf8_lossy(&buf);
                tail.lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .push(&line);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_common_token_shapes() {
        assert_eq!(mask_secrets("key sk-ant-abc123 rest"), "key sk-*** rest");
        assert_eq!(
            mask_secrets("Authorization: Bearer abc.def"),
            "Authorization: Bearer ***"
        );
        assert_eq!(
            mask_secrets("ANTHROPIC_API_KEY=xyz other"),
            "ANTHROPIC_API_KEY=*** other"
        );
        assert_eq!(
            mask_secrets(r#"{"access_token": "tok"}"#),
            r#"{"access_token": "***"}"#
        );
        assert_eq!(mask_secrets("plain line ünicode"), "plain line ünicode");
        assert_eq!(mask_secrets("run task-list now"), "run task-list now");
    }

    #[test]
    fn tail_keeps_last_lines_and_strips_newlines() {
        let mut tail = StderrTail::default();
        for i in 0..(STDERR_TAIL_LINES + 5) {
            tail.push(&format!("line {i}\r\n"));
        }
        let snap = tail.snapshot();
        assert_eq!(snap.len(), STDERR_TAIL_LINES);
        assert_eq!(snap[0], "line 5");
        assert_eq!(
            snap.last().unwrap(),
            &format!("line {}", STDERR_TAIL_LINES + 4)
        );
    }

    #[test]
    fn tail_truncates_long_lines_on_char_boundary() {
        let mut tail = StderrTail::default();
        tail.push(&"é".repeat(STDERR_LINE_MAX));
        let line = &tail.snapshot()[0];
        assert!(line.len() <= STDERR_LINE_MAX + '…'.len_utf8());
        assert!(line.ends_with('…'));
    }

    #[tokio::test]
    async fn spawn_runs_hidden_child_and_captures_stderr() {
        let node = match which_node() {
            Some(node) => node,
            None => return, // node not installed on this machine: skip
        };
        let spec = LaunchSpec {
            program: node,
            args: vec![
                "-e".into(),
                "console.error('hello err'); process.exit(3)".into(),
            ],
            ..LaunchSpec::default()
        };
        let mut proc = spawn(&spec).unwrap();
        let status = proc.child.wait().await.unwrap();
        assert_eq!(status.code(), Some(3));
        // Give the drain task a moment to observe EOF.
        for _ in 0..50 {
            if !stderr_snapshot(&proc.stderr_tail).is_empty() {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        assert_eq!(
            stderr_snapshot(&proc.stderr_tail),
            vec!["hello err".to_string()]
        );
    }

    fn which_node() -> Option<PathBuf> {
        let exe = if cfg!(windows) { "node.exe" } else { "node" };
        std::env::split_paths(&std::env::var_os("PATH")?)
            .map(|dir| dir.join(exe))
            .find(|p| p.is_file())
    }
}

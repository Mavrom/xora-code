//! Running a child process with a time limit, for git's remote commands: an SSH prompt
//! nobody can answer or a stalled network must not hold the Changes panel forever.

use crate::agents::process::JobObject;
use std::io::{self, Read};
use std::process::{Child, Command, Output, Stdio};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

const POLL: Duration = Duration::from_millis(50);

/// Reads a pipe to its end on its own thread, so a chatty child never blocks on a full pipe.
fn drain(pipe: Option<impl Read + Send + 'static>) -> JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut bytes = Vec::new();
        if let Some(mut pipe) = pipe {
            let _ = pipe.read_to_end(&mut bytes);
        }
        bytes
    })
}

/// The reader's bytes if it is done; a reader still blocked (a pipe held open by a process
/// that outlived the kill) is left behind rather than waited on.
fn collect(reader: JoinHandle<Vec<u8>>) -> Vec<u8> {
    if reader.is_finished() {
        reader.join().unwrap_or_default()
    } else {
        Vec::new()
    }
}

/// Kills the child and everything it started (an `ssh` waiting for a passphrase).
fn kill_tree(child: &mut Child, job: Option<&JobObject>) {
    match job {
        Some(job) => job.terminate(),
        None => {
            let _ = child.kill();
        }
    }
    let _ = child.wait();
}

/// Runs `command` (stdin closed, output captured) and waits at most `timeout`. Past it the
/// process tree is killed and the result is `None`.
pub fn output_with_deadline(mut command: Command, timeout: Duration) -> io::Result<Option<Output>> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        // Its own process group, which the job kills as a whole.
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let deadline = Instant::now() + timeout;
    let mut child = command.spawn()?;
    let job = JobObject::new()
        .ok()
        .filter(|job| job.assign_std(&child).is_ok());
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());

    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if Instant::now() >= deadline {
            kill_tree(&mut child, job.as_ref());
            return Ok(None);
        }
        thread::sleep(POLL);
    };
    // The child is gone; give its pipes until the deadline to close (a helper it started
    // may still hold them), then cut the stragglers off.
    while !(stdout.is_finished() && stderr.is_finished()) {
        if Instant::now() >= deadline {
            if let Some(job) = &job {
                job.terminate();
                thread::sleep(POLL);
            }
            break;
        }
        thread::sleep(POLL);
    }
    Ok(Some(Output {
        status,
        stdout: collect(stdout),
        stderr: collect(stderr),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A command that would run for half a minute.
    fn sleeper() -> Command {
        if cfg!(windows) {
            let mut c = Command::new("ping");
            c.args(["-n", "30", "127.0.0.1"]);
            c
        } else {
            let mut c = Command::new("sleep");
            c.arg("30");
            c
        }
    }

    #[test]
    fn gives_up_and_kills_at_the_deadline() {
        let started = Instant::now();
        let out = output_with_deadline(sleeper(), Duration::from_millis(300)).unwrap();
        assert!(out.is_none());
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "{:?}",
            started.elapsed()
        );
    }

    #[test]
    fn returns_the_output_of_a_quick_command() {
        let mut command = Command::new("git");
        command.arg("--version");
        let Ok(out) = output_with_deadline(command, Duration::from_secs(30)) else {
            return; // no git on this machine
        };
        let out = out.expect("finished well before the deadline");
        assert!(out.status.success());
        assert!(String::from_utf8_lossy(&out.stdout).starts_with("git version"));
    }
}

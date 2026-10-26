use super::{Shell, TerminalError};
use portable_pty::{ChildKiller, CommandBuilder, MasterPty, PtySize, native_pty_system};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;

/// Output chunk size; one IPC message per read at most this large.
const READ_BUFFER: usize = 16 * 1024;

/// A running shell. Dropping it closes the PTY, which ends the reader thread.
struct Session {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
struct Inner {
    sessions: Mutex<HashMap<u32, Session>>,
    next_id: AtomicU32,
}

/// All live terminal sessions, shared between commands and session threads.
#[derive(Default, Clone)]
pub struct TerminalManager(Arc<Inner>);

fn pty_size(cols: u16, rows: u16) -> PtySize {
    // A zero-sized PTY confuses some shells; the frontend sends the real size right after.
    PtySize {
        cols: cols.max(1),
        rows: rows.max(1),
        pixel_width: 0,
        pixel_height: 0,
    }
}

impl TerminalManager {
    fn sessions(&self) -> MutexGuard<'_, HashMap<u32, Session>> {
        // A panic while holding the lock cannot leave the map half-updated.
        self.0
            .sessions
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// Removes a session and closes its PTY outside the lock (closing can block briefly).
    fn remove(&self, id: u32) -> Option<Session> {
        self.sessions().remove(&id)
    }

    /// Starts `shell` in a new PTY and returns the session id.
    ///
    /// `on_data` receives raw output bytes (UTF-8 may be split across chunks). `on_exit`
    /// runs once, after the shell has exited and all output has been delivered.
    pub fn spawn(
        &self,
        shell: &Shell,
        cwd: Option<&Path>,
        cols: u16,
        rows: u16,
        mut on_data: impl FnMut(Vec<u8>) + Send + 'static,
        on_exit: impl FnOnce(Option<u32>) + Send + 'static,
    ) -> Result<u32, TerminalError> {
        let pair = native_pty_system()
            .openpty(pty_size(cols, rows))
            .map_err(TerminalError::pty)?;

        let mut cmd = CommandBuilder::new(&shell.program);
        cmd.args(&shell.args);
        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("TERM_PROGRAM", "XoraCode");

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| TerminalError::Spawn(format!("{}: {e}", shell.program.display())))?;
        // Only the child keeps the slave end open, so the PTY closes when it exits.
        drop(pair.slave);

        let master = pair.master;
        let mut reader = master.try_clone_reader().map_err(TerminalError::pty)?;
        let writer = master.take_writer().map_err(TerminalError::pty)?;
        let killer = child.clone_killer();

        let id = self.0.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        self.sessions().insert(
            id,
            Session {
                master,
                writer,
                killer,
            },
        );

        let reader_thread = thread::Builder::new()
            .name(format!("term-{id}-read"))
            .spawn(move || {
                let mut buf = vec![0u8; READ_BUFFER];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => on_data(buf[..n].to_vec()),
                    }
                }
            })?;

        let manager = self.clone();
        thread::Builder::new()
            .name(format!("term-{id}-wait"))
            .spawn(move || {
                let code = child.wait().ok().map(|status| status.exit_code());
                // Closing the PTY ends the reader once the remaining output is drained.
                drop(manager.remove(id));
                let _ = reader_thread.join();
                on_exit(code);
            })?;

        Ok(id)
    }

    /// Sends keyboard input (already encoded by the terminal emulator) to the shell.
    pub fn write(&self, id: u32, data: &[u8]) -> Result<(), TerminalError> {
        let mut sessions = self.sessions();
        let session = sessions.get_mut(&id).ok_or(TerminalError::NotFound(id))?;
        session.writer.write_all(data)?;
        session.writer.flush()?;
        Ok(())
    }

    pub fn resize(&self, id: u32, cols: u16, rows: u16) -> Result<(), TerminalError> {
        let sessions = self.sessions();
        let session = sessions.get(&id).ok_or(TerminalError::NotFound(id))?;
        session
            .master
            .resize(pty_size(cols, rows))
            .map_err(TerminalError::pty)
    }

    /// Terminates the shell and closes its PTY. Unknown ids are ignored (already exited).
    pub fn kill(&self, id: u32) {
        if let Some(mut session) = self.remove(id) {
            let _ = session.killer.kill();
        }
    }

    /// Terminates every session; used when the window closes or the app exits.
    pub fn kill_all(&self) {
        let sessions: Vec<Session> = self.sessions().drain().map(|(_, s)| s).collect();
        for mut session in sessions {
            let _ = session.killer.kill();
        }
    }

    #[cfg(test)]
    fn session_count(&self) -> usize {
        self.sessions().len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    fn echo_shell() -> Shell {
        if cfg!(windows) {
            Shell {
                program: "cmd.exe".into(),
                args: vec!["/c".into(), "echo xora-pty".into()],
            }
        } else {
            Shell {
                program: "/bin/sh".into(),
                args: vec!["-c".into(), "echo xora-pty".into()],
            }
        }
    }

    #[test]
    fn runs_a_command_streams_output_and_reports_exit() {
        let manager = TerminalManager::default();
        let (data_tx, data_rx) = mpsc::channel::<Vec<u8>>();
        let (exit_tx, exit_rx) = mpsc::channel();
        let id = manager
            .spawn(
                &echo_shell(),
                None,
                80,
                24,
                move |chunk| {
                    let _ = data_tx.send(chunk);
                },
                move |code| {
                    let _ = exit_tx.send(code);
                },
            )
            .unwrap();
        assert!(id > 0);

        let code = exit_rx
            .recv_timeout(Duration::from_secs(20))
            .expect("shell exited");
        assert_eq!(code, Some(0));
        let output: Vec<u8> = data_rx.try_iter().flatten().collect();
        assert!(String::from_utf8_lossy(&output).contains("xora-pty"));
        assert_eq!(manager.session_count(), 0, "an exited session is removed");
    }

    #[test]
    fn unknown_ids_are_reported_or_ignored() {
        let manager = TerminalManager::default();
        assert!(matches!(
            manager.write(7, b"x"),
            Err(TerminalError::NotFound(7))
        ));
        assert!(matches!(
            manager.resize(7, 80, 24),
            Err(TerminalError::NotFound(7))
        ));
        manager.kill(7);
        manager.kill_all();
    }

    #[test]
    fn missing_program_is_a_spawn_error() {
        let manager = TerminalManager::default();
        let shell = Shell {
            program: "xora-no-such-shell-binary".into(),
            args: vec![],
        };
        let result = manager.spawn(&shell, None, 80, 24, |_| {}, |_| {});
        assert!(result.is_err());
        assert_eq!(manager.session_count(), 0);
    }
}

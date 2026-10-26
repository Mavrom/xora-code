//! Integrated terminal: pseudo-terminal sessions running the user's default shell.
//!
//! Each session owns a PTY master plus two threads: a reader that streams output to the
//! frontend and a waiter that reaps the shell, closes the PTY and reports the exit code.

pub mod commands;
mod session;

pub use session::TerminalManager;

use serde::{Serialize, Serializer};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};

/// Errors from the terminal commands; serialized as their message string.
#[derive(Debug, thiserror::Error)]
pub enum TerminalError {
    #[error("terminal session {0} not found")]
    NotFound(u32),
    #[error("cannot start the shell: {0}")]
    Spawn(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Pty(String),
}

impl TerminalError {
    /// Wraps a `portable-pty` error (an `anyhow::Error`) without depending on anyhow.
    fn pty(err: impl std::fmt::Display) -> Self {
        Self::Pty(err.to_string())
    }
}

impl Serialize for TerminalError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// The program (and arguments) a new terminal session runs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Shell {
    pub program: PathBuf,
    pub args: Vec<String>,
}

impl Shell {
    fn new(program: impl Into<PathBuf>, args: &[&str]) -> Self {
        Self {
            program: program.into(),
            args: args.iter().map(|a| (*a).to_owned()).collect(),
        }
    }

    /// The program's file stem (`pwsh`, `zsh`), for tab titles.
    pub fn display_name(&self) -> String {
        match self.program.file_stem() {
            Some(stem) => stem.to_string_lossy().into_owned(),
            None => self.program.display().to_string(),
        }
    }
}

/// Picks the default shell.
///
/// Windows: PowerShell 7 (`pwsh`) when it is on the PATH, else Windows PowerShell.
/// Elsewhere: `$SHELL` as a login shell, else `/bin/sh`.
/// `find` looks a program name up on the PATH, which keeps this function pure.
pub fn resolve_shell(
    windows: bool,
    env_shell: Option<&str>,
    find: impl Fn(&str) -> Option<PathBuf>,
) -> Shell {
    if windows {
        let program = find("pwsh.exe")
            .or_else(|| find("powershell.exe"))
            .unwrap_or_else(|| PathBuf::from("powershell.exe"));
        return Shell::new(program, &["-NoLogo"]);
    }
    match env_shell.map(str::trim).filter(|s| !s.is_empty()) {
        Some(shell) => Shell::new(shell, &["-l"]),
        None => Shell::new("/bin/sh", &[]),
    }
}

/// Finds `name` as a file in one of the directories of a PATH-style list.
pub fn find_in_path(name: &str, path_var: &OsStr) -> Option<PathBuf> {
    std::env::split_paths(path_var)
        .filter(|dir| !dir.as_os_str().is_empty())
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
}

/// The shell for this machine, from the real environment.
pub fn default_shell() -> Shell {
    let path = std::env::var_os("PATH").unwrap_or_default();
    let env_shell = std::env::var("SHELL").ok();
    resolve_shell(cfg!(windows), env_shell.as_deref(), |name| {
        find_in_path(name, &path)
    })
}

/// The requested working directory when it exists, else the home directory.
pub fn resolve_cwd(requested: Option<&Path>, home: Option<PathBuf>) -> Option<PathBuf> {
    requested
        .filter(|p| p.is_dir())
        .map(Path::to_path_buf)
        .or(home.filter(|h| h.is_dir()))
}

/// The user's home directory from the environment (`USERPROFILE` on Windows).
pub fn home_dir() -> Option<PathBuf> {
    let var = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
    std::env::var_os(var)
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn none(_: &str) -> Option<PathBuf> {
        None
    }

    #[test]
    fn windows_prefers_pwsh() {
        let shell = resolve_shell(true, None, |name| {
            matches!(name, "pwsh.exe" | "powershell.exe").then(|| PathBuf::from(name))
        });
        assert_eq!(shell, Shell::new("pwsh.exe", &["-NoLogo"]));
    }

    #[test]
    fn windows_falls_back_to_windows_powershell() {
        let found = resolve_shell(true, None, |name| {
            (name == "powershell.exe").then(|| PathBuf::from(r"C:\ps\powershell.exe"))
        });
        assert_eq!(found.program, PathBuf::from(r"C:\ps\powershell.exe"));
        let missing = resolve_shell(true, None, none);
        assert_eq!(missing, Shell::new("powershell.exe", &["-NoLogo"]));
    }

    #[test]
    fn windows_ignores_shell_env() {
        let shell = resolve_shell(true, Some("/usr/bin/zsh"), none);
        assert_eq!(shell.program, PathBuf::from("powershell.exe"));
    }

    #[test]
    fn unix_uses_shell_env_as_login_shell() {
        let shell = resolve_shell(false, Some("/bin/zsh"), none);
        assert_eq!(shell, Shell::new("/bin/zsh", &["-l"]));
    }

    #[test]
    fn unix_falls_back_to_sh() {
        assert_eq!(resolve_shell(false, None, none), Shell::new("/bin/sh", &[]));
        assert_eq!(
            resolve_shell(false, Some("  "), none),
            Shell::new("/bin/sh", &[])
        );
    }

    #[test]
    fn display_name_is_the_file_stem() {
        assert_eq!(Shell::new("pwsh.exe", &[]).display_name(), "pwsh");
        assert_eq!(Shell::new("/bin/zsh", &[]).display_name(), "zsh");
    }

    #[test]
    fn find_in_path_returns_first_match() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        fs::write(b.path().join("tool.exe"), "").unwrap();
        fs::create_dir(a.path().join("tool.exe")).unwrap(); // a directory is not a match
        let path = std::env::join_paths([a.path(), b.path()]).unwrap();
        assert_eq!(
            find_in_path("tool.exe", &path),
            Some(b.path().join("tool.exe"))
        );
        assert_eq!(find_in_path("other.exe", &path), None);
    }

    #[test]
    fn cwd_falls_back_to_home() {
        let dir = tempfile::tempdir().unwrap();
        let home = tempfile::tempdir().unwrap();
        let home_path = Some(home.path().to_path_buf());
        assert_eq!(
            resolve_cwd(Some(dir.path()), home_path.clone()),
            Some(dir.path().into())
        );
        let gone = dir.path().join("missing");
        assert_eq!(resolve_cwd(Some(&gone), home_path.clone()), home_path);
        assert_eq!(resolve_cwd(None, None), None);
    }
}

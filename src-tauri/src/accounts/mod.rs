pub mod commands;

use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

/// How long `<cli> --version` may take before we give up on it.
pub const VERSION_TIMEOUT: Duration = Duration::from_secs(3);

/// An agent CLI Xora can drive. Mirrors `AgentId` in the settings.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Provider {
    Claude,
    Codex,
    Gemini,
}

impl Provider {
    pub const ALL: [Provider; 3] = [Provider::Claude, Provider::Codex, Provider::Gemini];

    /// Executable name on PATH (without a Windows extension).
    pub fn binary(self) -> &'static str {
        match self {
            Provider::Claude => "claude",
            Provider::Codex => "codex",
            Provider::Gemini => "gemini",
        }
    }

    /// Arguments that start the CLI's own sign-in flow in a terminal.
    pub fn login_args(self) -> &'static [&'static str] {
        match self {
            // Claude Code signs in from inside the session (`/login`).
            Provider::Claude => &[],
            Provider::Codex => &["login"],
            // Gemini CLI asks for the auth method on first start.
            Provider::Gemini => &[],
        }
    }

    pub fn title(self) -> &'static str {
        match self {
            Provider::Claude => "Claude Code",
            Provider::Codex => "Codex",
            Provider::Gemini => "Gemini CLI",
        }
    }

    /// Where the CLI keeps its sign-in file, given the environment.
    /// Only the file's existence is ever checked; it is never opened.
    pub fn credential_file(self, home: &Path, env: &dyn Fn(&str) -> Option<String>) -> PathBuf {
        let dir = |var: &str, fallback: &str| {
            env(var)
                .filter(|v| !v.trim().is_empty())
                .map_or_else(|| home.join(fallback), PathBuf::from)
        };
        match self {
            Provider::Claude => dir("CLAUDE_CONFIG_DIR", ".claude").join(".credentials.json"),
            Provider::Codex => dir("CODEX_HOME", ".codex").join("auth.json"),
            Provider::Gemini => home.join(".gemini").join("oauth_creds.json"),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SignIn {
    SignedIn,
    SignedOut,
    Unknown,
}

/// What the Accounts page shows for one provider.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub provider: Provider,
    /// Resolved executable, if the CLI is installed.
    pub path: Option<String>,
    /// Parsed `--version` output, if it answered in time.
    pub version: Option<String>,
    pub sign_in: SignIn,
}

/// File names to try for `binary` in one directory. On Windows only
/// executable extensions count (npm also drops an extensionless shell script
/// next to the `.cmd` shim, which Windows cannot run).
pub fn candidate_names(binary: &str, windows: bool, pathext: Option<&str>) -> Vec<String> {
    if !windows {
        return vec![binary.to_owned()];
    }
    let mut exts: Vec<String> = vec![".exe".into(), ".cmd".into(), ".bat".into()];
    for ext in pathext.unwrap_or_default().split(';') {
        let ext = ext.trim().to_ascii_lowercase();
        if ext.starts_with('.')
            && matches!(ext.as_str(), ".com" | ".exe" | ".cmd" | ".bat")
            && !exts.contains(&ext)
        {
            exts.push(ext);
        }
    }
    exts.into_iter()
        .map(|ext| format!("{binary}{ext}"))
        .collect()
}

/// Directories to search: PATH first, then common install locations a GUI
/// app may not inherit (npm's global bin, the native Claude installer).
pub fn search_dirs(path_var: Option<&OsStr>, extra: &[PathBuf]) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = path_var
        .map(|p| std::env::split_paths(p).collect())
        .unwrap_or_default();
    for dir in extra {
        if !dirs.contains(dir) {
            dirs.push(dir.clone());
        }
    }
    dirs.retain(|d| !d.as_os_str().is_empty());
    dirs
}

/// First `dir/name` that `is_file` accepts, in directory order.
pub fn resolve(
    dirs: &[PathBuf],
    names: &[String],
    is_file: &dyn Fn(&Path) -> bool,
) -> Option<PathBuf> {
    dirs.iter()
        .flat_map(|dir| names.iter().map(move |name| dir.join(name)))
        .find(|p| is_file(p))
}

/// Extracts the first `x.y[.z…]` token, e.g. "2.0.14 (Claude Code)" -> "2.0.14",
/// "codex-cli 0.46.0" -> "0.46.0".
pub fn parse_version(output: &str) -> Option<String> {
    output
        .split(|c: char| c.is_whitespace() || c == '(' || c == ')' || c == ',')
        .find_map(|token| {
            let token = token.trim_start_matches('v');
            let start = token.find(|c: char| c.is_ascii_digit())?;
            let token = &token[start..];
            let end = token
                .find(|c: char| !(c.is_ascii_alphanumeric() || c == '.' || c == '-'))
                .unwrap_or(token.len());
            let token = &token[..end];
            let mut parts = token.split('.');
            let ok = parts
                .next()
                .is_some_and(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
                && parts
                    .next()
                    .is_some_and(|p| p.chars().next().is_some_and(|c| c.is_ascii_digit()));
            ok.then(|| token.to_owned())
        })
}

/// Sign-in heuristic: the credential file exists. Claude on macOS keeps its
/// token in the Keychain, so a missing file there means "unknown".
pub fn sign_in_state(provider: Provider, credential_exists: Option<bool>, macos: bool) -> SignIn {
    match credential_exists {
        None => SignIn::Unknown,
        Some(true) => SignIn::SignedIn,
        Some(false) if macos && provider == Provider::Claude => SignIn::Unknown,
        Some(false) => SignIn::SignedOut,
    }
}

/// Hides the console window a `.cmd` shim would otherwise flash on Windows.
fn no_window(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

/// Runs `<exe> --version`, killing it after `timeout`.
pub fn read_version(exe: &Path, timeout: Duration) -> Option<String> {
    let mut child = no_window(&mut Command::new(exe))
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    let mut stdout = child.stdout.take()?;
    let mut stderr = child.stderr.take()?;
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut out = String::new();
        let _ = stdout.read_to_string(&mut out);
        let _ = stderr.read_to_string(&mut out);
        let _ = tx.send(out);
    });
    match rx.recv_timeout(timeout) {
        Ok(out) => {
            let _ = child.wait();
            parse_version(&out)
        }
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            None
        }
    }
}

/// The real environment: PATH, PATHEXT and the usual extra install dirs.
pub struct Env {
    pub home: Option<PathBuf>,
    pub dirs: Vec<PathBuf>,
    pub pathext: Option<String>,
}

impl Env {
    pub fn current(home: Option<PathBuf>) -> Self {
        let mut extra = Vec::new();
        if let Some(home) = &home {
            extra.push(home.join(".local").join("bin"));
        }
        if cfg!(windows) {
            if let Some(appdata) = std::env::var_os("APPDATA") {
                extra.push(PathBuf::from(appdata).join("npm"));
            }
        } else {
            extra.push(PathBuf::from("/usr/local/bin"));
            extra.push(PathBuf::from("/opt/homebrew/bin"));
        }
        Self {
            dirs: search_dirs(std::env::var_os("PATH").as_deref(), &extra),
            pathext: std::env::var("PATHEXT").ok(),
            home,
        }
    }

    pub fn locate(&self, provider: Provider) -> Option<PathBuf> {
        let names = candidate_names(provider.binary(), cfg!(windows), self.pathext.as_deref());
        resolve(&self.dirs, &names, &|p| p.is_file())
    }

    pub fn detect(&self, provider: Provider) -> ProviderStatus {
        let path = self.locate(provider);
        let version = path
            .as_deref()
            .and_then(|p| read_version(p, VERSION_TIMEOUT));
        let exists = self.home.as_deref().map(|home| {
            provider
                .credential_file(home, &|var| std::env::var(var).ok())
                .is_file()
        });
        ProviderStatus {
            provider,
            path: path.map(|p| p.display().to_string()),
            version,
            sign_in: sign_in_state(provider, exists, cfg!(target_os = "macos")),
        }
    }
}

/// Opens the provider's sign-in flow in a new terminal window.
pub fn open_login(exe: &Path, provider: Provider) -> std::io::Result<()> {
    let args = provider.login_args();
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // `start "<title>" cmd /k ""<exe>" args"`: a fresh console that stays open
        // after the CLI exits. The outer quotes are the ones `cmd /k` strips, so a
        // path with spaces survives.
        let mut inner = format!("\"{}\"", exe.display());
        for arg in args {
            inner.push(' ');
            inner.push_str(arg);
        }
        let line = format!(
            "/c start \"Xora - {}\" cmd /k \"{inner}\"",
            provider.title()
        );
        no_window(&mut Command::new("cmd")).raw_arg(line).spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        let mut script = shell_quote(&exe.display().to_string());
        for arg in args {
            script.push(' ');
            script.push_str(arg);
        }
        let apple = format!(
            "tell application \"Terminal\" to do script \"{}\"",
            script.replace('\\', "\\\\").replace('"', "\\\"")
        );
        Command::new("osascript")
            .args([
                "-e",
                &apple,
                "-e",
                "tell application \"Terminal\" to activate",
            ])
            .spawn()?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("x-terminal-emulator")
            .arg("-e")
            .arg(exe)
            .args(args)
            .spawn()?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn candidate_names_on_windows_use_executable_extensions_only() {
        let names = candidate_names("claude", true, Some(".COM;.EXE;.BAT;.CMD;.VBS;.JS;.PY"));
        assert_eq!(
            names,
            ["claude.exe", "claude.cmd", "claude.bat", "claude.com"]
        );
    }

    #[test]
    fn candidate_names_elsewhere_is_the_bare_binary() {
        assert_eq!(candidate_names("codex", false, None), ["codex"]);
    }

    #[test]
    fn search_dirs_appends_extra_without_duplicates() {
        let path = std::env::join_paths([PathBuf::from("a"), PathBuf::from("b")]).unwrap();
        let dirs = search_dirs(Some(&path), &[PathBuf::from("b"), PathBuf::from("c")]);
        assert_eq!(
            dirs,
            [PathBuf::from("a"), PathBuf::from("b"), PathBuf::from("c")]
        );
    }

    #[test]
    fn resolve_prefers_earlier_directories_then_name_order() {
        let dirs = [PathBuf::from("one"), PathBuf::from("two")];
        let names = candidate_names("gemini", true, None);
        let present = [
            Path::new("two").join("gemini.exe"),
            Path::new("one").join("gemini.cmd"),
        ];
        let found = resolve(&dirs, &names, &|p| present.iter().any(|q| q == p));
        assert_eq!(found, Some(Path::new("one").join("gemini.cmd")));
    }

    #[test]
    fn resolve_finds_a_real_shim_on_disk() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("claude"), "#!/bin/sh").unwrap();
        std::fs::write(dir.path().join("claude.cmd"), "@echo off").unwrap();
        let names = candidate_names("claude", true, None);
        let found = resolve(&[dir.path().to_path_buf()], &names, &|p| p.is_file());
        assert_eq!(found, Some(dir.path().join("claude.cmd")));
    }

    #[test]
    fn parse_version_handles_each_cli_format() {
        assert_eq!(
            parse_version("2.0.14 (Claude Code)\n").as_deref(),
            Some("2.0.14")
        );
        assert_eq!(parse_version("codex-cli 0.46.0").as_deref(), Some("0.46.0"));
        assert_eq!(
            parse_version("0.9.0-nightly.20251020\n").as_deref(),
            Some("0.9.0-nightly.20251020")
        );
        assert_eq!(parse_version("v22.1.0").as_deref(), Some("22.1.0"));
        assert_eq!(parse_version("command not found"), None);
        assert_eq!(parse_version("error 404"), None);
    }

    #[test]
    fn credential_file_honours_config_dir_overrides() {
        let home = Path::new("home");
        let env: HashMap<&str, &str> =
            [("CLAUDE_CONFIG_DIR", "custom"), ("CODEX_HOME", " ")].into();
        let lookup = |var: &str| env.get(var).map(|v| v.to_string());
        assert_eq!(
            Provider::Claude.credential_file(home, &lookup),
            Path::new("custom").join(".credentials.json")
        );
        assert_eq!(
            Provider::Codex.credential_file(home, &lookup),
            home.join(".codex").join("auth.json")
        );
        assert_eq!(
            Provider::Gemini.credential_file(home, &lookup),
            home.join(".gemini").join("oauth_creds.json")
        );
    }

    #[test]
    fn sign_in_state_heuristic() {
        assert_eq!(
            sign_in_state(Provider::Codex, Some(true), false),
            SignIn::SignedIn
        );
        assert_eq!(
            sign_in_state(Provider::Codex, Some(false), false),
            SignIn::SignedOut
        );
        assert_eq!(
            sign_in_state(Provider::Gemini, None, false),
            SignIn::Unknown
        );
        assert_eq!(
            sign_in_state(Provider::Claude, Some(false), true),
            SignIn::Unknown
        );
        assert_eq!(
            sign_in_state(Provider::Claude, Some(false), false),
            SignIn::SignedOut
        );
    }

    #[test]
    fn status_serializes_as_camel_case() {
        let status = ProviderStatus {
            provider: Provider::Gemini,
            path: None,
            version: None,
            sign_in: SignIn::SignedOut,
        };
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(
            json,
            r#"{"provider":"gemini","path":null,"version":null,"signIn":"signedOut"}"#
        );
    }
}

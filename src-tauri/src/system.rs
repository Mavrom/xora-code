//! Facts about the machine Xora runs on, for display, and the macOS launch environment.

/// The computer's name ("MAVROM"), shown above the composer as the place the agent runs.
#[tauri::command]
pub fn system_hostname() -> String {
    hostname_from(|key| {
        std::env::var(key)
            .ok()
            .or_else(|| (key == "HOSTNAME").then(mac_computer_name).flatten())
    })
}

/// macOS does not export `HOSTNAME` to apps opened from Finder; ask the system instead.
fn mac_computer_name() -> Option<String> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    let output = std::process::Command::new("/usr/sbin/scutil")
        .args(["--get", "ComputerName"])
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

const PATH_START: &str = "__XORA_PATH_START__";
const PATH_END: &str = "__XORA_PATH_END__";

/// Apps opened from Finder or the Dock get launchd's bare PATH (`/usr/bin:/bin:...`), so
/// Homebrew, nvm or Volta installs of `node` and `git` are invisible to agents and the
/// file index. Reads the PATH the user's login shell builds and adopts it.
///
/// Call before any thread starts: it sets a process environment variable.
pub fn adopt_login_shell_path() {
    if !cfg!(target_os = "macos") {
        return;
    }
    let shell = std::env::var("SHELL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "/bin/zsh".to_owned());
    let Some(path) = login_shell_path(&shell) else {
        return;
    };
    // SAFETY: called at startup from `run()`, before Tauri or Tokio spawn any thread.
    unsafe { std::env::set_var("PATH", path) };
}

fn login_shell_path(shell: &str) -> Option<String> {
    use std::io::Read;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    // Interactive login, so both `.zprofile` (Homebrew) and `.zshrc` (nvm) run; markers
    // keep banners and prompts printed by those files out of the result.
    let script = format!("printf '%s' \"{PATH_START}${{PATH}}{PATH_END}\"");
    let mut child = Command::new(shell)
        .args(["-ilc", &script])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    // A slow or hanging shell config must not hold the window back.
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(20)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
    let mut out = String::new();
    child.stdout.take()?.read_to_string(&mut out).ok()?;
    extract_path(&out)
}

/// The PATH between the markers, if the shell printed a non-empty one.
fn extract_path(output: &str) -> Option<String> {
    let start = output.rfind(PATH_START)? + PATH_START.len();
    let len = output[start..].find(PATH_END)?;
    let path = output[start..start + len].trim();
    (!path.is_empty()).then(|| path.to_owned())
}

fn hostname_from(var: impl Fn(&str) -> Option<String>) -> String {
    ["COMPUTERNAME", "HOSTNAME"]
        .into_iter()
        .filter_map(&var)
        .map(|name| name.trim().to_string())
        .find(|name| !name.is_empty())
        .unwrap_or_else(|| "Bu bilgisayar".to_string())
}

#[cfg(test)]
mod tests {
    use super::{PATH_END, PATH_START, extract_path, hostname_from, login_shell_path};

    #[test]
    fn extracts_path_between_markers_ignoring_shell_noise() {
        let out = format!("Welcome!\n{PATH_START}/opt/homebrew/bin:/usr/bin{PATH_END}\n");
        assert_eq!(
            extract_path(&out).as_deref(),
            Some("/opt/homebrew/bin:/usr/bin")
        );
        assert_eq!(extract_path("no markers"), None);
        assert_eq!(extract_path(&format!("{PATH_START}{PATH_END}")), None);
    }

    #[cfg(unix)]
    #[test]
    fn reads_path_from_a_real_login_shell() {
        let path = login_shell_path("/bin/sh").expect("PATH from /bin/sh");
        assert!(path.contains("/usr/bin") || path.contains("/bin"), "{path}");
        assert!(!path.contains(PATH_END), "{path}");
    }

    #[test]
    fn prefers_windows_name_then_unix_then_fallback() {
        let both = |k: &str| Some(if k == "COMPUTERNAME" { "MAVROM" } else { "box" }.to_string());
        assert_eq!(hostname_from(both), "MAVROM");
        let unix = |k: &str| (k == "HOSTNAME").then(|| "box".to_string());
        assert_eq!(hostname_from(unix), "box");
        assert_eq!(hostname_from(|_| Some("  ".to_string())), "Bu bilgisayar");
    }
}

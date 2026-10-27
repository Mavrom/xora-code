//! Managed adapter install (design doc 1.2): `node npm-cli.js install --prefix`
//! into `<app data>/agents/<slug>/<version>`. Optional dependencies are kept
//! (the Claude SDK ships its native CLI and Gemini `node-pty` that way).

use super::process::hide_console;
use super::registry::{AgentSpec, NodeRuntime};
use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Arguments after `npm-cli.js`.
pub fn npm_args(spec: &AgentSpec, prefix: &Path) -> Vec<String> {
    vec![
        "install".into(),
        "--prefix".into(),
        prefix.to_string_lossy().into_owned(),
        format!("{}@{}", spec.package, spec.version),
        "--no-fund".into(),
        "--no-audit".into(),
        "--omit=dev".into(),
        "--loglevel=error".into(),
    ]
}

/// Installs the pinned version. Returns the last lines of npm's output on failure.
pub async fn install(
    spec: &AgentSpec,
    node: &NodeRuntime,
    agents_dir: &Path,
) -> Result<(), String> {
    let npm_cli = node
        .npm_cli
        .as_ref()
        .ok_or_else(|| "npm not found (it comes with Node.js)".to_owned())?;
    let prefix = spec.install_dir(agents_dir);
    tokio::fs::create_dir_all(&prefix)
        .await
        .map_err(|err| format!("could not create the folder: {err}"))?;

    let mut cmd = Command::new(&node.exe);
    cmd.arg(npm_cli)
        .args(npm_args(spec, &prefix))
        .current_dir(&prefix)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    hide_console(&mut cmd);
    let mut child = cmd
        .spawn()
        .map_err(|err| format!("could not start npm: {err}"))?;

    let mut tail: Vec<String> = Vec::new();
    if let Some(stderr) = child.stderr.take() {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            tail.push(super::process::mask_secrets(&line));
            if tail.len() > 20 {
                tail.remove(0);
            }
        }
    }
    let status = child.wait().await.map_err(|err| err.to_string())?;
    if status.success() && spec.entry(agents_dir).is_some() {
        return Ok(());
    }
    let detail = tail.join("\n");
    Err(if detail.is_empty() {
        format!("npm install failed ({status})")
    } else {
        detail
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::events::AgentId;
    use crate::agents::registry::spec;

    #[test]
    fn npm_args_pin_the_version_and_keep_optional_deps() {
        let args = npm_args(spec(AgentId::Gemini), Path::new("/x"));
        assert!(args.contains(&"@google/gemini-cli@0.65.0".to_owned()));
        assert!(args.contains(&"--omit=dev".to_owned()));
        assert!(!args.iter().any(|a| a.contains("optional")));
    }
}

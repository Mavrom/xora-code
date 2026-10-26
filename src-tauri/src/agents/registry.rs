//! Which adapters Xora runs, at which pinned versions, and where they live
//! (design doc 1.1/1.2/3.8). Adapters are installed per version under the
//! app data folder and started as `node <entry>`; no npx, no `.cmd` shims.

use super::events::AgentId;
use crate::accounts;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// One supported agent adapter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AgentSpec {
    pub id: AgentId,
    pub display_name: &'static str,
    /// npm package that speaks ACP over stdio.
    pub package: &'static str,
    /// Version Xora was tested with; upgrades are deliberate.
    pub version: &'static str,
    /// Key in the package's `bin` map (falls back to the only entry).
    pub bin: &'static str,
    /// Extra arguments after the entry script.
    pub args: &'static [&'static str],
    /// Minimum Node.js major version the package declares.
    pub min_node_major: u32,
    /// Install folder name under `<app data>/agents/`.
    pub slug: &'static str,
}

pub const SPECS: [AgentSpec; 3] = [
    AgentSpec {
        id: AgentId::Claude,
        display_name: "Claude Code",
        package: "@agentclientprotocol/claude-agent-acp",
        version: "0.95.0",
        bin: "claude-agent-acp",
        args: &[],
        min_node_major: 22,
        slug: "claude-acp",
    },
    AgentSpec {
        id: AgentId::Codex,
        display_name: "Codex",
        package: "@agentclientprotocol/codex-acp",
        version: "2.2.2",
        bin: "codex-acp",
        args: &[],
        min_node_major: 20,
        slug: "codex-acp",
    },
    AgentSpec {
        id: AgentId::Gemini,
        display_name: "Gemini CLI",
        package: "@google/gemini-cli",
        version: "0.65.0",
        bin: "gemini",
        args: &["--acp"],
        min_node_major: 20,
        slug: "gemini",
    },
];

pub fn spec(id: AgentId) -> &'static AgentSpec {
    SPECS.iter().find(|s| s.id == id).expect("every AgentId has a spec")
}

impl AgentSpec {
    /// `<agents_dir>/<slug>/<version>`: the npm `--prefix` for this version.
    pub fn install_dir(&self, agents_dir: &Path) -> PathBuf {
        agents_dir.join(self.slug).join(self.version)
    }

    /// `<prefix>/node_modules/<package>`.
    pub fn package_dir(&self, agents_dir: &Path) -> PathBuf {
        let mut dir = self.install_dir(agents_dir).join("node_modules");
        for part in self.package.split('/') {
            dir.push(part);
        }
        dir
    }

    /// The installed entry script, read from `package.json` `bin`.
    pub fn entry(&self, agents_dir: &Path) -> Option<PathBuf> {
        let pkg_dir = self.package_dir(agents_dir);
        let manifest: Value =
            serde_json::from_slice(&std::fs::read(pkg_dir.join("package.json")).ok()?).ok()?;
        if manifest.get("version").and_then(Value::as_str) != Some(self.version) {
            return None;
        }
        let rel = bin_entry(&manifest, self.bin)?;
        let entry = pkg_dir.join(rel);
        entry.is_file().then_some(entry)
    }
}

/// Resolves a `bin` field that is either a string or a `{ name: path }` map.
pub fn bin_entry<'a>(manifest: &'a Value, name: &str) -> Option<&'a str> {
    match manifest.get("bin")? {
        Value::String(path) => Some(path),
        Value::Object(map) => map
            .get(name)
            .or_else(|| (map.len() == 1).then(|| map.values().next()).flatten())
            .and_then(Value::as_str),
        _ => None,
    }
}

/// A usable Node.js runtime.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeRuntime {
    pub exe: PathBuf,
    pub major: u32,
    /// `npm-cli.js` next to the runtime, used for managed installs.
    pub npm_cli: Option<PathBuf>,
}

/// Extracts the major version from `node --version` output (`v22.11.0`).
pub fn node_major(version: &str) -> Option<u32> {
    version.trim().trim_start_matches('v').split('.').next()?.parse().ok()
}

/// Where Node.js usually lives when a GUI app did not inherit the user's PATH.
fn extra_node_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if cfg!(windows) {
        for var in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(base) = std::env::var_os(var) {
                dirs.push(PathBuf::from(base).join("nodejs"));
            }
        }
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            dirs.push(PathBuf::from(local).join("Volta").join("bin"));
        }
        if let Some(nvm) = std::env::var_os("NVM_SYMLINK") {
            dirs.push(PathBuf::from(nvm));
        }
    } else {
        dirs.push(PathBuf::from("/usr/local/bin"));
        dirs.push(PathBuf::from("/opt/homebrew/bin"));
    }
    dirs
}

/// Finds `node` (only real executables, never `.cmd`) and reads its version.
pub fn find_node() -> Option<NodeRuntime> {
    let dirs = accounts::search_dirs(std::env::var_os("PATH").as_deref(), &extra_node_dirs());
    let names = vec![if cfg!(windows) { "node.exe" } else { "node" }.to_owned()];
    let exe = accounts::resolve(&dirs, &names, &|p: &Path| p.is_file())?;
    let version = node_version(&exe)?;
    let major = node_major(&version)?;
    let npm_cli = npm_cli_for(&exe);
    Some(NodeRuntime { exe, major, npm_cli })
}

fn node_version(exe: &Path) -> Option<String> {
    let mut cmd = std::process::Command::new(exe);
    cmd.arg("--version")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let mut child = cmd.spawn().ok()?;
    let deadline = std::time::Instant::now() + Duration::from_secs(3);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if std::time::Instant::now() < deadline => {
                std::thread::sleep(Duration::from_millis(20));
            }
            _ => {
                let _ = child.kill();
                return None;
            }
        }
    }
    let output = child.wait_with_output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    (!text.is_empty()).then_some(text)
}

/// `npm-cli.js` shipped with the runtime (Windows installer and Unix layouts).
pub fn npm_cli_for(node_exe: &Path) -> Option<PathBuf> {
    let dir = node_exe.parent()?;
    let candidates = [
        dir.join("node_modules").join("npm").join("bin").join("npm-cli.js"),
        dir.join("..").join("lib").join("node_modules").join("npm").join("bin").join("npm-cli.js"),
    ];
    candidates.into_iter().find(|p| p.is_file())
}

/// Why an agent cannot start yet (`AgentStatus::NotInstalled.reason`).
pub fn missing_reason(spec: &AgentSpec, node: Option<&NodeRuntime>, agents_dir: &Path) -> Option<&'static str> {
    match node {
        None => Some("node-missing"),
        Some(node) if node.major < spec.min_node_major => Some("node-too-old"),
        Some(_) if spec.entry(agents_dir).is_none() => Some("package-missing"),
        Some(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_node_majors() {
        assert_eq!(node_major("v22.11.0"), Some(22));
        assert_eq!(node_major("20.1.0\n"), Some(20));
        assert_eq!(node_major("garbage"), None);
    }

    #[test]
    fn resolves_bin_maps_and_strings() {
        let map = json!({ "bin": { "gemini": "bundle/gemini.js", "other": "x.js" } });
        assert_eq!(bin_entry(&map, "gemini"), Some("bundle/gemini.js"));
        let single = json!({ "bin": { "claude-agent-acp": "dist/index.js" } });
        assert_eq!(bin_entry(&single, "renamed"), Some("dist/index.js"));
        let string = json!({ "bin": "cli.js" });
        assert_eq!(bin_entry(&string, "anything"), Some("cli.js"));
        assert_eq!(bin_entry(&json!({}), "x"), None);
    }

    #[test]
    fn entry_requires_the_pinned_version() {
        let dir = tempfile::tempdir().unwrap();
        let spec = spec(AgentId::Codex);
        let pkg = spec.package_dir(dir.path());
        std::fs::create_dir_all(pkg.join("dist")).unwrap();
        std::fs::write(pkg.join("dist").join("index.js"), "").unwrap();
        let manifest = |v: &str| json!({ "version": v, "bin": { "codex-acp": "dist/index.js" } });
        std::fs::write(pkg.join("package.json"), manifest("1.0.0").to_string()).unwrap();
        assert_eq!(spec.entry(dir.path()), None);
        std::fs::write(pkg.join("package.json"), manifest(spec.version).to_string()).unwrap();
        assert_eq!(spec.entry(dir.path()), Some(pkg.join("dist/index.js")));
    }

    #[test]
    fn missing_reason_orders_node_before_package() {
        let dir = tempfile::tempdir().unwrap();
        let spec = spec(AgentId::Claude);
        assert_eq!(missing_reason(spec, None, dir.path()), Some("node-missing"));
        let old = NodeRuntime { exe: "node".into(), major: 20, npm_cli: None };
        assert_eq!(missing_reason(spec, Some(&old), dir.path()), Some("node-too-old"));
        let ok = NodeRuntime { major: 22, ..old };
        assert_eq!(missing_reason(spec, Some(&ok), dir.path()), Some("package-missing"));
    }

    #[test]
    fn every_agent_has_a_spec() {
        for id in [AgentId::Claude, AgentId::Codex, AgentId::Gemini] {
            assert_eq!(spec(id).id, id);
        }
    }
}

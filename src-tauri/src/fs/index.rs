//! The files of a workspace, for quick open (Ctrl+P) and `@` mentions in the composer.
//!
//! In a git repository the list is git's own (`ls-files`: tracked plus untracked files that
//! are not ignored), so `.gitignore` is respected for free. Elsewhere a plain walk skips the
//! usual dependency and build folders.

use std::io;
use std::path::Path;
use std::process::{Command, Stdio};

/// Upper bound on the list; big monorepos are still searchable by their first files.
pub const MAX_FILES: usize = 50_000;

/// Folders a plain walk never enters.
const SKIP: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".turbo",
    ".cache",
    ".venv",
    "venv",
    "__pycache__",
    ".idea",
    ".gradle",
    "bin",
    "obj",
];

/// Workspace-relative paths with `/` separators, at most `limit`.
pub fn list_files(root: &Path, limit: usize) -> io::Result<Vec<String>> {
    if !root.is_dir() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "not a folder"));
    }
    if let Some(files) = git_files(root, limit) {
        return Ok(files);
    }
    walk(root, limit)
}

fn git_files(root: &Path, limit: usize) -> Option<Vec<String>> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(root)
        .args(["ls-files", "-co", "--exclude-standard", "-z"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let out = command.output().ok()?;
    if !out.status.success() {
        return None;
    }
    Some(parse_nul_list(&out.stdout, limit))
}

/// Splits git's `-z` output into paths (deleted-but-listed entries are kept; opening one
/// just fails like any missing file).
pub fn parse_nul_list(bytes: &[u8], limit: usize) -> Vec<String> {
    bytes
        .split(|b| *b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| String::from_utf8_lossy(p).replace('\\', "/"))
        .take(limit)
        .collect()
}

fn walk(root: &Path, limit: usize) -> io::Result<Vec<String>> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            let Ok(kind) = entry.file_type() else {
                continue;
            };
            if kind.is_dir() {
                if !SKIP.contains(&name.as_ref()) {
                    stack.push(entry.path());
                }
            } else if kind.is_file()
                && let Ok(rel) = entry.path().strip_prefix(root)
            {
                out.push(rel.to_string_lossy().replace('\\', "/"));
                if out.len() >= limit {
                    return Ok(out);
                }
            }
        }
    }
    out.sort();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parses_git_nul_output() {
        let bytes = b"src/main.rs\0README.md\0dir\\x.txt\0";
        assert_eq!(
            parse_nul_list(bytes, 10),
            ["src/main.rs", "README.md", "dir/x.txt"]
        );
        assert_eq!(parse_nul_list(bytes, 1), ["src/main.rs"]);
    }

    #[test]
    fn walk_skips_dependency_folders() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::write(root.join("src/a.ts"), "").unwrap();
        fs::write(root.join("README.md"), "").unwrap();
        fs::write(root.join("node_modules/pkg/index.js"), "").unwrap();
        assert_eq!(walk(root, 100).unwrap(), ["README.md", "src/a.ts"]);
    }
}

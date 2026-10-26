//! Git worktrees for agent chats: a chat can run in its own checkout on its own branch,
//! leaving the user's working tree alone. Everything goes through the `git` binary.
//!
//! Errors carry a `[code]` prefix the frontend maps to a message: `no_git`, `dirty`,
//! `unmerged`, `not_ff`, `git` (anything else, with git's own text).

pub mod commands;

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Branches Xora creates live under this prefix; only those are deleted with their worktree.
pub const BRANCH_PREFIX: &str = "xora/";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    pub path: String,
    /// Short branch name, or none when detached.
    pub branch: Option<String>,
    pub head: String,
    /// The repository's main checkout (the first entry git lists).
    pub main: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum GitError {
    #[error("[no_git] git could not be started: {0}")]
    Missing(std::io::Error),
    #[error("[dirty] the worktree has uncommitted changes")]
    Dirty,
    #[error("[unmerged] branch {0} has commits that are not merged")]
    Unmerged(String),
    #[error("[not_ff] {0}")]
    NotFastForward(String),
    #[error("[git] {0}")]
    Failed(String),
}

type Result<T> = std::result::Result<T, GitError>;

/// Runs `git -C dir <args>` without a console window; stdout on success.
fn git(dir: &Path, args: &[&str]) -> Result<String> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(dir)
        .args(args)
        .stdin(Stdio::null())
        .env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let out = command.output().map_err(GitError::Missing)?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim_end().to_owned())
    } else {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_owned();
        Err(GitError::Failed(if stderr.is_empty() {
            format!("git {} failed", args.join(" "))
        } else {
            stderr
        }))
    }
}

/// Parses `git worktree list --porcelain`; the first block is the main checkout.
pub fn parse_porcelain(text: &str) -> Vec<Worktree> {
    let mut out = Vec::new();
    for block in text.split("\n\n").map(str::trim).filter(|b| !b.is_empty()) {
        let mut path = None;
        let mut head = String::new();
        let mut branch = None;
        for line in block.lines() {
            if let Some(p) = line.strip_prefix("worktree ") {
                path = Some(p.to_owned());
            } else if let Some(h) = line.strip_prefix("HEAD ") {
                head = h.to_owned();
            } else if let Some(b) = line.strip_prefix("branch ") {
                branch = Some(b.strip_prefix("refs/heads/").unwrap_or(b).to_owned());
            }
        }
        if let Some(path) = path {
            out.push(Worktree {
                main: out.is_empty(),
                path,
                branch,
                head,
            });
        }
    }
    out
}

/// The repository's worktrees, main checkout first. Not a repository: an empty list.
pub fn list(repo: &Path) -> Result<Vec<Worktree>> {
    match git(repo, &["worktree", "list", "--porcelain"]) {
        Ok(text) => Ok(parse_porcelain(&text)),
        Err(GitError::Failed(_)) => Ok(Vec::new()),
        Err(err) => Err(err),
    }
}

/// A branch- and folder-safe name: Turkish letters folded, anything else a dash.
pub fn slugify(name: &str) -> String {
    let mut slug = String::new();
    for ch in name.trim().to_lowercase().chars() {
        let mapped = match ch {
            'ç' => 'c',
            'ğ' => 'g',
            'ı' | 'i' | 'İ' => 'i',
            'ö' => 'o',
            'ş' => 's',
            'ü' => 'u',
            c if c.is_ascii_alphanumeric() => c,
            _ => '-',
        };
        if mapped == '-' && (slug.is_empty() || slug.ends_with('-')) {
            continue;
        }
        slug.push(mapped);
    }
    let slug: String = slug.trim_end_matches('-').chars().take(40).collect();
    let slug = slug.trim_end_matches('-').to_owned();
    if slug.is_empty() {
        "is".to_owned()
    } else {
        slug
    }
}

fn branch_exists(repo: &Path, branch: &str) -> bool {
    git(
        repo,
        &[
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch}"),
        ],
    )
    .is_ok()
}

/// Opens a new worktree for `repo` on a fresh `xora/<slug>` branch from its HEAD, in
/// `base/<repo folder>/<slug>` (a numbered slug when the name is taken).
pub fn create(repo: &Path, base: &Path, name: &str) -> Result<Worktree> {
    let root = git(repo, &["rev-parse", "--show-toplevel"])?;
    let root = PathBuf::from(root);
    let folder = root
        .file_name()
        .map(|n| slugify(&n.to_string_lossy()))
        .unwrap_or_else(|| "repo".to_owned());
    let stem = slugify(name);
    let (slug, path) = (1..)
        .map(|n| {
            if n == 1 {
                stem.clone()
            } else {
                format!("{stem}-{n}")
            }
        })
        .map(|slug| {
            let path = base.join(&folder).join(&slug);
            (slug, path)
        })
        .find(|(slug, path)| {
            !path.exists() && !branch_exists(&root, &format!("{BRANCH_PREFIX}{slug}"))
        })
        .expect("an unused name exists");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| GitError::Failed(e.to_string()))?;
    }
    let branch = format!("{BRANCH_PREFIX}{slug}");
    let path_str = path.to_string_lossy().into_owned();
    git(
        &root,
        &["worktree", "add", "-b", &branch, &path_str, "HEAD"],
    )?;
    // Report the path the way git lists it: a packaged app's app-data folder can be
    // redirected on Windows, and every later lookup compares against git's own list.
    list(&root)?
        .into_iter()
        .find(|w| w.branch.as_deref() == Some(branch.as_str()))
        .ok_or_else(|| GitError::Failed(format!("worktree for {branch} was not listed")))
}

/// How long a folder git has already let go of is retried while a process (an agent that
/// is shutting down) still has it open.
const RELEASE_WAIT: std::time::Duration = std::time::Duration::from_secs(30);

/// Deletes `path` now, or keeps trying in the background until whatever holds it exits.
fn remove_dir_soon(path: PathBuf) {
    if std::fs::remove_dir_all(&path).is_ok() || !path.exists() {
        return;
    }
    std::thread::spawn(move || {
        let step = std::time::Duration::from_millis(500);
        let mut waited = std::time::Duration::ZERO;
        while waited < RELEASE_WAIT && path.exists() {
            std::thread::sleep(step);
            waited += step;
            let _ = std::fs::remove_dir_all(&path);
        }
    });
}

/// Same folder, whatever the slashes or (on Windows) the letter case.
fn same_path(a: &str, b: &Path) -> bool {
    let norm = |p: &str| {
        let p = p.replace('\\', "/").trim_end_matches('/').to_owned();
        if cfg!(windows) { p.to_lowercase() } else { p }
    };
    norm(a) == norm(&b.to_string_lossy())
}

pub fn is_dirty(path: &Path) -> Result<bool> {
    Ok(!git(path, &["status", "--porcelain"])?.trim().is_empty())
}

fn branch_of(path: &Path) -> Result<Option<String>> {
    let name = git(path, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    Ok((name != "HEAD").then_some(name))
}

/// Removes a worktree and, for Xora's own branches, the branch. Without `force` it refuses
/// uncommitted changes ([`GitError::Dirty`]) and keeps an unmerged branch
/// ([`GitError::Unmerged`], the worktree is gone by then).
pub fn remove(repo: &Path, path: &Path, force: bool) -> Result<()> {
    let branch = branch_of(path).ok().flatten();
    if !force && is_dirty(path)? {
        return Err(GitError::Dirty);
    }
    let path_str = path.to_string_lossy();
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(&path_str);
    if let Err(err) = git(repo, &args) {
        // Git drops its record first and the folder after; a file still held open (an
        // editor, a shell) can fail the second step. Once git has let go, finish the job.
        let still_listed = list(repo)?.iter().any(|w| same_path(&w.path, path));
        if still_listed {
            return Err(err);
        }
        remove_dir_soon(path.to_path_buf());
    }
    if let Some(branch) = branch.filter(|b| b.starts_with(BRANCH_PREFIX)) {
        let flag = if force { "-D" } else { "-d" };
        if git(repo, &["branch", flag, &branch]).is_err() {
            return Err(GitError::Unmerged(branch));
        }
    }
    Ok(())
}

/// Brings a worktree's work into the main checkout's current branch: commits whatever is
/// uncommitted with `message`, fast-forwards the main checkout (never a merge commit, never
/// a conflict), then removes the worktree and its branch. Returns the branch it went into.
pub fn merge(repo: &Path, path: &Path, message: &str) -> Result<String> {
    let branch = branch_of(path)?
        .ok_or_else(|| GitError::Failed("the worktree is not on a branch".to_owned()))?;
    if is_dirty(path)? {
        git(path, &["add", "-A"])?;
        git(path, &["commit", "-m", message])?;
    }
    let main = list(repo)?
        .into_iter()
        .find(|w| w.main)
        .ok_or_else(|| GitError::Failed("no main checkout".to_owned()))?;
    let main_path = PathBuf::from(&main.path);
    let target = main
        .branch
        .ok_or_else(|| GitError::Failed("the main checkout is not on a branch".to_owned()))?;
    if let Err(err) = git(&main_path, &["merge", "--ff-only", &branch]) {
        return Err(GitError::NotFastForward(err.to_string()));
    }
    remove(repo, path, false)?;
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_porcelain_with_main_first() {
        let text = "worktree C:/repo\nHEAD abc\nbranch refs/heads/main\n\n\
                    worktree C:/wt/x\nHEAD def\nbranch refs/heads/xora/x\n\n\
                    worktree C:/wt/d\nHEAD 123\ndetached\n";
        let list = parse_porcelain(text);
        assert_eq!(list.len(), 3);
        assert!(list[0].main && !list[1].main);
        assert_eq!(list[1].branch.as_deref(), Some("xora/x"));
        assert_eq!(list[2].branch, None);
        assert_eq!(list[2].head, "123");
    }

    #[test]
    fn slugs_are_safe_for_branches_and_folders() {
        assert_eq!(slugify("Giriş sayfası düzelt!"), "giris-sayfasi-duzelt");
        assert_eq!(slugify("  --  "), "is");
        assert_eq!(slugify(&"a".repeat(60)).len(), 40);
    }

    fn repo() -> Option<tempfile::TempDir> {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path();
        git(p, &["init", "-q", "-b", "main"]).ok()?;
        git(p, &["config", "user.email", "test@example.invalid"]).ok()?;
        git(p, &["config", "user.name", "Test"]).ok()?;
        std::fs::write(p.join("a.txt"), "one\n").unwrap();
        git(p, &["add", "-A"]).ok()?;
        git(p, &["commit", "-q", "-m", "init"]).ok()?;
        Some(dir)
    }

    #[test]
    fn create_merge_and_remove_round_trip() {
        let Some(repo_dir) = repo() else { return }; // no git on this machine
        let base = tempfile::tempdir().unwrap();
        let repo = repo_dir.path();

        let wt = create(repo, base.path(), "Yeni özellik").unwrap();
        assert_eq!(wt.branch.as_deref(), Some("xora/yeni-ozellik"));
        let again = create(repo, base.path(), "Yeni özellik").unwrap();
        assert_eq!(again.branch.as_deref(), Some("xora/yeni-ozellik-2"));
        assert_eq!(list(repo).unwrap().len(), 3);

        // Uncommitted work blocks removal, then merges into main and cleans up.
        let wt_path = PathBuf::from(&wt.path);
        std::fs::write(wt_path.join("b.txt"), "two\n").unwrap();
        assert!(matches!(
            remove(repo, &wt_path, false),
            Err(GitError::Dirty)
        ));
        assert_eq!(merge(repo, &wt_path, "xora: yeni özellik").unwrap(), "main");
        assert!(repo.join("b.txt").exists());
        assert!(!wt_path.exists());
        assert!(!branch_exists(repo, "xora/yeni-ozellik"));

        remove(repo, Path::new(&again.path), false).unwrap();
        assert_eq!(list(repo).unwrap().len(), 1);
    }

    #[test]
    fn not_a_repository_lists_nothing() {
        let dir = tempfile::tempdir().unwrap();
        if git(dir.path(), &["--version"]).is_err() {
            return;
        }
        assert!(list(dir.path()).unwrap().is_empty());
    }
}

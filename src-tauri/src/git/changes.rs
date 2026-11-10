//! What the Changes panel does to a repository: stage, unstage, discard, diff one file,
//! commit the staged set, and push or pull. Paths are relative to the repository root (as
//! `status` reports them); every command runs from that root, with `--` before the paths.

use super::status::{STATUS_ARGS, StatusEntry, parse_status, toplevel};
use super::{GitError, Result, failure, git, git_within, run};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

/// Diff text past this is cut at a line end (`truncated` is set); the panel is a preview.
pub const MAX_DIFF_BYTES: usize = 256 * 1024;

/// Push and pull give up after this: an SSH passphrase or host-key prompt cannot be
/// answered without a terminal, and a stalled network must not hold the panel forever.
pub const REMOTE_TIMEOUT: Duration = Duration::from_secs(120);

/// Paths per git invocation, so a long "stage all" stays under Windows' command line limit.
const PATHS_PER_CALL: usize = 100;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diff {
    /// Unified diff of one file; empty when it has no change on that side.
    pub text: String,
    pub truncated: bool,
}

/// A path relative to the repository root that stays inside it: no root, drive or `..`.
pub(super) fn checked(path: &str) -> Result<&str> {
    let inside = !path.is_empty()
        && Path::new(path)
            .components()
            .all(|c| matches!(c, Component::Normal(_) | Component::CurDir));
    if inside {
        Ok(path)
    } else {
        Err(GitError::BadPath(path.to_owned()))
    }
}

/// The repository root of `dir`, after checking every path.
fn root_for(dir: &Path, paths: &[String]) -> Result<PathBuf> {
    for path in paths {
        checked(path)?;
    }
    Ok(PathBuf::from(toplevel(dir)?))
}

/// Runs `git <args> -- <paths>` from `root`, in batches.
fn for_paths(root: &Path, args: &[&str], paths: &[String]) -> Result<()> {
    for batch in paths.chunks(PATHS_PER_CALL) {
        let mut all = args.to_vec();
        all.push("--");
        all.extend(batch.iter().map(String::as_str));
        git(root, &all)?;
    }
    Ok(())
}

fn current_entries(root: &Path) -> Result<Vec<StatusEntry>> {
    Ok(parse_status(&git(root, STATUS_ARGS)?).entries)
}

fn has_head(root: &Path) -> bool {
    git(root, &["rev-parse", "--verify", "--quiet", "HEAD"]).is_ok()
}

/// Adds the paths to the index, deletions included.
pub fn stage(dir: &Path, paths: &[String]) -> Result<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let root = root_for(dir, paths)?;
    for_paths(&root, &["add", "-A"], paths)
}

/// Takes the paths out of the index again; the working tree is left alone.
pub fn unstage(dir: &Path, paths: &[String]) -> Result<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let root = root_for(dir, paths)?;
    if has_head(&root) {
        for_paths(&root, &["restore", "--staged"], paths)
    } else {
        // Before the first commit there is no HEAD to restore from: empty the index entry.
        for_paths(
            &root,
            &["rm", "--cached", "-r", "-q", "--ignore-unmatch"],
            paths,
        )
    }
}

/// Throws away the working tree changes of the paths: tracked files go back to their staged
/// (or committed) content, untracked files are deleted. Staged changes are kept. Only what
/// git itself reports as changed right now is touched; anything else asked for is ignored.
pub fn discard(dir: &Path, paths: &[String]) -> Result<()> {
    if paths.is_empty() {
        return Ok(());
    }
    let root = root_for(dir, paths)?;
    let wanted: HashSet<&str> = paths.iter().map(String::as_str).collect();
    let targets: Vec<StatusEntry> = current_entries(&root)?
        .into_iter()
        .filter(|e| wanted.contains(e.path.as_str()))
        .collect();
    if targets.iter().any(|e| e.conflicted) {
        return Err(GitError::Conflicted);
    }
    let restore: Vec<String> = targets
        .iter()
        .filter(|e| !e.untracked && e.unstaged.is_some())
        .map(|e| e.path.clone())
        .collect();
    for_paths(&root, &["restore", "--worktree"], &restore)?;
    for entry in targets.iter().filter(|e| e.untracked) {
        let file = root.join(checked(&entry.path)?);
        // `-uall` lists files, never folders; a symlink is removed, not what it points at.
        match std::fs::symlink_metadata(&file) {
            Ok(meta) if !meta.is_dir() => std::fs::remove_file(&file)
                .map_err(|e| GitError::Failed(format!("{}: {e}", entry.path)))?,
            _ => {}
        }
    }
    Ok(())
}

/// Keeps the first `max` bytes of `text`, cut back to the end of a line.
fn cap(text: String, max: usize) -> Diff {
    if text.len() <= max {
        return Diff {
            text,
            truncated: false,
        };
    }
    let end = text.as_bytes()[..max]
        .iter()
        .rposition(|&b| b == b'\n')
        .unwrap_or(0);
    Diff {
        text: text[..end].to_owned(),
        truncated: true,
    }
}

/// Unified diff of one file: index against HEAD when `staged`, else working tree against
/// the index. An untracked file shows as entirely added; a staged rename (its old path in
/// `orig`) shows as a rename with its real line changes.
pub fn diff(dir: &Path, path: &str, orig: Option<&str>, staged: bool) -> Result<Diff> {
    checked(path)?;
    if let Some(orig) = orig {
        checked(orig)?;
    }
    let root = PathBuf::from(toplevel(dir)?);
    let base = ["diff", "--no-color", "--no-ext-diff"];
    let untracked = !staged && git(&root, &["ls-files", "--", path])?.is_empty();
    let text = if untracked {
        // `--no-index` exits with 1 when the files differ, which is the point here.
        let args = [&base[..], &["--no-index", "--", "/dev/null", path]].concat();
        let out = run(&root, &args)?;
        if !matches!(out.status.code(), Some(0 | 1)) {
            return Err(failure(&args, &out));
        }
        String::from_utf8_lossy(&out.stdout).trim_end().to_owned()
    } else if let (true, Some(orig)) = (staged, orig) {
        git(
            &root,
            &[&base[..], &["--cached", "-M", "--", orig, path]].concat(),
        )?
    } else if staged {
        git(&root, &[&base[..], &["--cached", "--", path]].concat())?
    } else {
        git(&root, &[&base[..], &["--", path]].concat())?
    };
    Ok(cap(text, MAX_DIFF_BYTES))
}

/// Commits the staged changes with `message`; returns the new commit's short id. Git's own
/// identity settings are used as they are.
pub fn commit(dir: &Path, message: &str) -> Result<String> {
    if message.trim().is_empty() {
        return Err(GitError::EmptyMessage);
    }
    let root = PathBuf::from(toplevel(dir)?);
    let entries = current_entries(&root)?;
    if entries.iter().any(|e| e.conflicted) {
        return Err(GitError::Conflicted);
    }
    if !entries.iter().any(|e| e.staged.is_some()) {
        return Err(GitError::NothingStaged);
    }
    git(&root, &["commit", "--quiet", "-m", message]).map_err(|err| match err {
        GitError::Failed(text)
            if text.contains("Please tell me who you are")
                || text.contains("Author identity unknown")
                || text.contains("empty ident name") =>
        {
            GitError::NoIdentity(text)
        }
        other => other,
    })?;
    git(&root, &["rev-parse", "--short", "HEAD"])
}

/// A readable code for a failed push or pull, from git's (English) error text.
pub fn classify_remote(text: String) -> GitError {
    let has = |needle: &str| text.contains(needle);
    if has("Authentication failed")
        || has("could not read Username")
        || has("could not read Password")
        || has("terminal prompts disabled")
        || has("Permission denied (publickey")
        || has("The requested URL returned error: 403")
    {
        GitError::Auth(text)
    } else if has("Could not resolve host")
        || has("Could not resolve hostname")
        || has("unable to access")
        || has("Connection timed out")
        || has("Connection refused")
    {
        GitError::Offline(text)
    } else if has("[rejected]") || has("non-fast-forward") || has("fetch first") {
        GitError::Rejected(text)
    } else if has("Not possible to fast-forward") || has("Diverging branches") {
        GitError::Diverged(text)
    } else if has("no tracking information") || has("has no upstream branch") {
        GitError::NoUpstream(text)
    } else {
        GitError::Failed(text)
    }
}

fn remote_op(result: Result<String>) -> Result<()> {
    match result {
        Ok(_) => Ok(()),
        Err(GitError::Failed(text)) => Err(classify_remote(text)),
        Err(err) => Err(err),
    }
}

/// The remote a branch without an upstream is published to: `origin`, else the first one.
fn pick_remote(remotes: &str) -> Option<&str> {
    let mut names = remotes.lines().map(str::trim).filter(|n| !n.is_empty());
    let first = names.clone().next();
    names.find(|n| *n == "origin").or(first)
}

/// Pushes the current branch; a branch without an upstream is published (and tracked).
pub fn push(dir: &Path) -> Result<()> {
    let root = PathBuf::from(toplevel(dir)?);
    let status = parse_status(&git(&root, STATUS_ARGS)?);
    let branch = status.branch.ok_or(GitError::Detached)?;
    if status.upstream.is_some() {
        return remote_op(git_within(&root, &["push"], REMOTE_TIMEOUT));
    }
    let remotes = git(&root, &["remote"])?;
    let remote = pick_remote(&remotes).ok_or(GitError::NoRemote)?;
    remote_op(git_within(
        &root,
        &["push", "--set-upstream", remote, &branch],
        REMOTE_TIMEOUT,
    ))
}

/// Pulls the upstream into the current branch, fast-forward only (never a merge commit).
pub fn pull(dir: &Path) -> Result<()> {
    let root = PathBuf::from(toplevel(dir)?);
    remote_op(git_within(&root, &["pull", "--ff-only"], REMOTE_TIMEOUT))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::status::status;
    use crate::git::test_repo;
    use std::fs;

    fn strings(paths: &[&str]) -> Vec<String> {
        paths.iter().map(|p| (*p).to_owned()).collect()
    }

    #[test]
    fn rejects_paths_that_leave_the_repository() {
        assert!(checked("src/main.rs").is_ok());
        assert!(checked("dosya adı ş.txt").is_ok());
        for bad in [
            "",
            "../x",
            "a/../../x",
            "/etc/passwd",
            "C:/Windows/x",
            "C:\\x",
        ] {
            if bad.starts_with("C:") && !cfg!(windows) {
                continue; // a plain file name elsewhere
            }
            assert!(
                matches!(checked(bad), Err(GitError::BadPath(_))),
                "{bad} should be rejected"
            );
        }
    }

    #[test]
    fn caps_diffs_at_a_line_end() {
        let small = cap("a\nb".to_owned(), 10);
        assert_eq!((small.text.as_str(), small.truncated), ("a\nb", false));
        let big = cap("line one\nline two\nline three".to_owned(), 15);
        assert_eq!((big.text.as_str(), big.truncated), ("line one", true));
    }

    #[test]
    fn classifies_remote_failures() {
        let code = |text: &str| classify_remote(text.to_owned()).to_string();
        assert!(code("fatal: Authentication failed for 'https://x'").starts_with("[auth]"));
        assert!(
            code(
                "fatal: could not read Username for 'https://github.com': terminal prompts disabled"
            )
            .starts_with("[auth]")
        );
        assert!(code("git@github.com: Permission denied (publickey).").starts_with("[auth]"));
        assert!(code(" ! [rejected]        main -> main (fetch first)").starts_with("[rejected]"));
        assert!(code("fatal: Not possible to fast-forward, aborting.").starts_with("[diverged]"));
        assert!(
            code("There is no tracking information for the current branch.")
                .starts_with("[no_upstream]")
        );
        assert!(
            code("fatal: unable to access 'https://x/': Could not resolve host: x")
                .starts_with("[offline]")
        );
        assert!(code("something else").starts_with("[git]"));
    }

    #[test]
    fn picks_origin_or_the_first_remote() {
        assert_eq!(pick_remote("upstream\norigin\n"), Some("origin"));
        assert_eq!(pick_remote("fork\nupstream"), Some("fork"));
        assert_eq!(pick_remote(""), None);
    }

    #[test]
    fn stage_unstage_commit_round_trip() {
        let Some(dir) = test_repo() else { return }; // no git on this machine
        let p = dir.path();
        fs::write(p.join("a.txt"), "two\n").unwrap();
        fs::write(p.join("b c.txt"), "new\n").unwrap();

        assert!(matches!(commit(p, "x"), Err(GitError::NothingStaged)));
        assert!(matches!(commit(p, "  \n"), Err(GitError::EmptyMessage)));

        stage(p, &strings(&["a.txt", "b c.txt"])).unwrap();
        let staged = status(p).unwrap();
        assert!(staged.entries.iter().all(|e| e.staged.is_some()));

        unstage(p, &strings(&["b c.txt"])).unwrap();
        let entries = status(p).unwrap().entries;
        let b = entries.iter().find(|e| e.path == "b c.txt").unwrap();
        assert!(b.untracked && b.staged.is_none());

        let id = commit(p, "Change a").unwrap();
        assert!(!id.is_empty());
        let after = status(p).unwrap();
        assert_eq!(after.entries.len(), 1, "only the untracked file is left");
        assert_eq!(git(p, &["log", "-1", "--format=%s"]).unwrap(), "Change a");
    }

    #[test]
    fn unstages_before_the_first_commit() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path();
        if git(p, &["init", "-q"]).is_err() {
            return;
        }
        git(p, &["config", "core.autocrlf", "false"]).unwrap();
        fs::write(p.join("first.txt"), "x\n").unwrap();
        stage(p, &strings(&["first.txt"])).unwrap();
        unstage(p, &strings(&["first.txt"])).unwrap();
        let entries = status(p).unwrap().entries;
        assert!(entries[0].untracked);
        assert!(p.join("first.txt").exists());
    }

    #[test]
    fn discard_restores_tracked_and_deletes_only_listed_untracked() {
        let Some(dir) = test_repo() else { return };
        let p = dir.path();
        fs::write(p.join("a.txt"), "edited\n").unwrap();
        fs::write(p.join("junk [1].txt"), "x\n").unwrap();
        fs::write(p.join("keep.txt"), "x\n").unwrap();
        fs::write(p.join(".gitignore"), "ignored.log\n").unwrap();
        fs::write(p.join("ignored.log"), "x\n").unwrap();

        // A pattern-looking name is that one file; an ignored file is never touched.
        discard(p, &strings(&["a.txt", "junk [1].txt", "ignored.log"])).unwrap();
        assert_eq!(fs::read_to_string(p.join("a.txt")).unwrap(), "one\n");
        assert!(!p.join("junk [1].txt").exists());
        assert!(p.join("keep.txt").exists());
        assert!(p.join("ignored.log").exists());

        assert!(matches!(
            discard(p, &strings(&["../outside.txt"])),
            Err(GitError::BadPath(_))
        ));
    }

    #[test]
    fn discard_keeps_staged_content() {
        let Some(dir) = test_repo() else { return };
        let p = dir.path();
        fs::write(p.join("a.txt"), "staged\n").unwrap();
        stage(p, &strings(&["a.txt"])).unwrap();
        fs::write(p.join("a.txt"), "staged\nand more\n").unwrap();
        discard(p, &strings(&["a.txt"])).unwrap();
        assert_eq!(fs::read_to_string(p.join("a.txt")).unwrap(), "staged\n");
    }

    #[test]
    fn diffs_one_file_per_side() {
        let Some(dir) = test_repo() else { return };
        let p = dir.path();
        fs::write(p.join("a.txt"), "one\ntwo\n").unwrap();
        fs::write(p.join("new file.txt"), "hello\n").unwrap();

        let unstaged = diff(p, "a.txt", None, false).unwrap();
        assert!(unstaged.text.contains("+two") && !unstaged.truncated);
        assert!(diff(p, "a.txt", None, true).unwrap().text.is_empty());

        let untracked = diff(p, "new file.txt", None, false).unwrap();
        assert!(untracked.text.contains("+hello"), "{}", untracked.text);

        stage(p, &strings(&["a.txt"])).unwrap();
        assert!(diff(p, "a.txt", None, true).unwrap().text.contains("+two"));
    }

    #[test]
    fn diffs_a_staged_rename_as_a_rename() {
        let Some(dir) = test_repo() else { return };
        let p = dir.path();
        let body: String = (1..=20).map(|n| format!("line {n}\n")).collect();
        fs::write(p.join("old.txt"), &body).unwrap();
        stage(p, &strings(&["old.txt"])).unwrap();
        commit(p, "add old").unwrap();

        fs::rename(p.join("old.txt"), p.join("new name.txt")).unwrap();
        let edited = body.replace("line 7\n", "line seven\n");
        fs::write(p.join("new name.txt"), edited).unwrap();
        stage(p, &strings(&["old.txt", "new name.txt"])).unwrap();
        let entry = status(p).unwrap().entries.remove(0);
        assert_eq!(entry.orig_path.as_deref(), Some("old.txt"));

        let renamed = diff(p, "new name.txt", Some("old.txt"), true).unwrap().text;
        assert!(renamed.contains("rename from old.txt"), "{renamed}");
        assert!(renamed.contains("-line 7") && renamed.contains("+line seven"));
        assert!(!renamed.contains("+line 1\n"), "not shown as all new");
        assert!(matches!(
            diff(p, "new name.txt", Some("../x"), true),
            Err(GitError::BadPath(_))
        ));
    }

    #[test]
    fn push_without_a_remote_says_so() {
        let Some(dir) = test_repo() else { return };
        assert!(matches!(push(dir.path()), Err(GitError::NoRemote)));
    }

    #[test]
    fn push_publishes_and_pull_fast_forwards() {
        let Some(dir) = test_repo() else { return };
        let p = dir.path();
        let remote = tempfile::tempdir().unwrap();
        let bare = remote.path().join("r.git");
        git(
            remote.path(),
            &["init", "-q", "--bare", "-b", "main", "r.git"],
        )
        .unwrap();
        git(p, &["remote", "add", "origin", &bare.to_string_lossy()]).unwrap();

        push(p).unwrap();
        let status = status(p).unwrap();
        assert_eq!(status.upstream.as_deref(), Some("origin/main"));

        // Another clone moves the branch on; pull brings it here as a fast-forward.
        let other = tempfile::tempdir().unwrap();
        git(other.path(), &["clone", "-q", &bare.to_string_lossy(), "c"]).unwrap();
        let clone = other.path().join("c");
        git(&clone, &["config", "user.email", "t@example.invalid"]).unwrap();
        git(&clone, &["config", "user.name", "T"]).unwrap();
        git(&clone, &["config", "commit.gpgsign", "false"]).unwrap();
        git(&clone, &["config", "core.autocrlf", "false"]).unwrap();
        fs::write(clone.join("a.txt"), "from elsewhere\n").unwrap();
        git(&clone, &["commit", "-q", "-am", "elsewhere"]).unwrap();
        git(&clone, &["push", "-q"]).unwrap();

        pull(p).unwrap();
        assert_eq!(
            fs::read_to_string(p.join("a.txt")).unwrap(),
            "from elsewhere\n"
        );
    }
}

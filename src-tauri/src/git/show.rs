//! One file's text as git has it, committed or staged: the left (and for a staged change,
//! right) side of a diff tab. The working tree side is read from disk by the frontend.

use super::changes::checked;
use super::status::toplevel;
use super::{GitError, Result, failure, git, run};
use serde::Deserialize;
use std::path::{Path, PathBuf};

/// Blobs above this are refused (`[too_large]`); the diff tab is a reading view.
pub const MAX_SHOW_BYTES: u64 = 8 * 1024 * 1024;

/// A NUL byte in this many leading bytes marks a blob as binary (git's own heuristic).
const BINARY_SNIFF_BYTES: usize = 8000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Revision {
    /// The last commit.
    Head,
    /// The staged content.
    Index,
}

/// The object name of `path` at `rev`. The index side asks for stage 0 explicitly, so a
/// file named like `1:x` is not read as "stage 1 of x"; a conflicted file has no stage 0.
fn spec(rev: Revision, path: &str) -> String {
    match rev {
        Revision::Head => format!("HEAD:{path}"),
        Revision::Index => format!(":0:{path}"),
    }
}

/// Text of a blob, or `[binary]` for one with a NUL byte near the start or no valid UTF-8.
fn decode(bytes: Vec<u8>) -> Result<String> {
    let sniff = &bytes[..bytes.len().min(BINARY_SNIFF_BYTES)];
    if sniff.contains(&0) {
        return Err(GitError::Binary);
    }
    String::from_utf8(bytes).map_err(|_| GitError::Binary)
}

/// The text of `path` (relative to the repository root) in HEAD or the index; `None` when
/// the file does not exist there (added since, deleted, no commit yet). Something that is
/// not a file there (a submodule) counts as binary.
pub fn show(dir: &Path, path: &str, rev: Revision) -> Result<Option<String>> {
    show_within(dir, path, rev, MAX_SHOW_BYTES)
}

/// [`show`] with the size limit as a parameter (tests use a small one).
fn show_within(dir: &Path, path: &str, rev: Revision, max: u64) -> Result<Option<String>> {
    checked(path)?;
    let root = PathBuf::from(toplevel(dir)?);
    let spec = spec(rev, path);
    // `--verify --quiet` exits 1 without a word when the name resolves to nothing.
    let Ok(oid) = git(&root, &["rev-parse", "--verify", "--quiet", &spec]) else {
        return Ok(None);
    };
    if git(&root, &["cat-file", "-t", &oid])? != "blob" {
        return Err(GitError::Binary);
    }
    let size: u64 = git(&root, &["cat-file", "-s", &oid])?
        .parse()
        .map_err(|_| GitError::Failed(format!("git cat-file -s {oid}: not a size")))?;
    if size > max {
        return Err(GitError::TooLarge(size));
    }
    // Raw bytes: `git` would trim the trailing newline. A blob's `show` is its plain content
    // (no textconv unless asked for).
    let args = ["show", oid.as_str()];
    let out = run(&root, &args)?;
    if !out.status.success() {
        return Err(failure(&args, &out));
    }
    decode(out.stdout).map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::changes::{commit, stage};
    use crate::git::test_repo;
    use std::fs;

    fn strings(paths: &[&str]) -> Vec<String> {
        paths.iter().map(|p| (*p).to_owned()).collect()
    }

    #[test]
    fn spells_head_and_stage_zero() {
        assert_eq!(spec(Revision::Head, "a/b.txt"), "HEAD:a/b.txt");
        assert_eq!(spec(Revision::Index, "1:x"), ":0:1:x");
    }

    #[test]
    fn decodes_text_and_refuses_binary() {
        assert_eq!(decode(b"a\nb\n".to_vec()).unwrap(), "a\nb\n");
        assert!(matches!(decode(b"a\0b".to_vec()), Err(GitError::Binary)));
        assert!(matches!(
            decode(vec![0xff, 0xfe, 0x41]),
            Err(GitError::Binary)
        ));
    }

    #[test]
    fn reads_head_and_index_with_the_trailing_newline() {
        let Some(dir) = test_repo() else { return }; // no git on this machine
        let p = dir.path();
        fs::write(p.join("a.txt"), "staged\n").unwrap();
        stage(p, &strings(&["a.txt"])).unwrap();
        fs::write(p.join("a.txt"), "on disk\n").unwrap();

        assert_eq!(
            show(p, "a.txt", Revision::Head).unwrap().as_deref(),
            Some("one\n")
        );
        assert_eq!(
            show(p, "a.txt", Revision::Index).unwrap().as_deref(),
            Some("staged\n")
        );
    }

    #[test]
    fn a_file_missing_there_is_absent_not_an_error() {
        let Some(dir) = test_repo() else { return };
        let p = dir.path();
        fs::write(p.join("new file.txt"), "x\n").unwrap();
        assert_eq!(show(p, "new file.txt", Revision::Head).unwrap(), None);
        assert_eq!(show(p, "new file.txt", Revision::Index).unwrap(), None);
        stage(p, &strings(&["new file.txt"])).unwrap();
        assert_eq!(show(p, "new file.txt", Revision::Head).unwrap(), None);
        assert_eq!(
            show(p, "new file.txt", Revision::Index).unwrap().as_deref(),
            Some("x\n")
        );

        // Deleted and staged: still in HEAD, gone from the index.
        fs::remove_file(p.join("a.txt")).unwrap();
        stage(p, &strings(&["a.txt"])).unwrap();
        assert!(show(p, "a.txt", Revision::Head).unwrap().is_some());
        assert_eq!(show(p, "a.txt", Revision::Index).unwrap(), None);
    }

    #[test]
    fn before_the_first_commit_head_is_absent() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path();
        if git(p, &["init", "-q"]).is_err() {
            return;
        }
        fs::write(p.join("first.txt"), "x\n").unwrap();
        assert_eq!(show(p, "first.txt", Revision::Head).unwrap(), None);
    }

    #[test]
    fn binary_folders_and_bad_paths_are_refused() {
        let Some(dir) = test_repo() else { return };
        let p = dir.path();
        fs::write(p.join("blob.bin"), b"PK\x03\x04\0\0data").unwrap();
        fs::create_dir(p.join("sub")).unwrap();
        fs::write(p.join("sub").join("x.txt"), "x\n").unwrap();
        stage(p, &strings(&["blob.bin", "sub/x.txt"])).unwrap();
        commit(p, "add").unwrap();

        let binary = show(p, "blob.bin", Revision::Head).unwrap_err();
        assert!(binary.to_string().starts_with("[binary]"), "{binary}");
        assert!(matches!(
            show(p, "sub", Revision::Head),
            Err(GitError::Binary)
        ));
        assert_eq!(
            show(p, "sub/x.txt", Revision::Head).unwrap().as_deref(),
            Some("x\n")
        );
        assert!(matches!(
            show(p, "../outside.txt", Revision::Head),
            Err(GitError::BadPath(_))
        ));
    }

    #[test]
    fn a_blob_over_the_limit_is_too_large() {
        let Some(dir) = test_repo() else { return };
        let p = dir.path();
        let err = show_within(p, "a.txt", Revision::Head, 3).unwrap_err();
        assert!(err.to_string().starts_with("[too_large]"), "{err}");
        assert!(
            show_within(p, "a.txt", Revision::Head, 4)
                .unwrap()
                .is_some()
        );
    }
}

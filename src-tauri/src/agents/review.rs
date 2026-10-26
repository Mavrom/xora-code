//! Per-turn change tracking for the "Değişiklikler" review bar and its
//! "Geri al" action (design doc section 4.3).
//!
//! For every file an agent changes in the current turn the store keeps the
//! content from before the first change (`original`, `None` for a file that
//! did not exist) and the content the agent last wrote (`latest`). Reverting
//! restores `original` only while the disk still holds `latest`; any later
//! edit (by the user or a tool) turns the revert into a conflict instead of
//! silently discarding work.
//!
//! Sources: `fs/write_text_file` through the bridge ([`ReviewStore::record_write`])
//! and agent-side writes reported as `diff` tool-call content
//! ([`ReviewStore::record_diff`]).

pub use super::acp::RevertOutcome;
use super::fs_bridge::{self, FsBridgeError, SandboxError};
use serde::Serialize;
use std::collections::HashMap;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, thiserror::Error)]
pub enum ReviewError {
    #[error("no recorded change for this file")]
    NotTracked,
    #[error(transparent)]
    Sandbox(#[from] SandboxError),
    #[error(transparent)]
    Io(#[from] io::Error),
}

impl From<FsBridgeError> for ReviewError {
    fn from(err: FsBridgeError) -> Self {
        match err {
            FsBridgeError::Sandbox(err) => Self::Sandbox(err),
            FsBridgeError::Io(err) => Self::Io(err),
            other => Self::Io(io::Error::other(other.to_string())),
        }
    }
}

/// A file changed during the current turn.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub path: String,
    /// The file did not exist before the turn (revert deletes it).
    pub created: bool,
}

#[derive(Debug, Clone)]
struct Change {
    path: PathBuf,
    /// Bytes before the first change of the turn; `None` = file was absent.
    original: Option<Vec<u8>>,
    latest: String,
}

/// Change snapshots per session, keyed by a normalized path.
#[derive(Debug, Default)]
pub struct ReviewStore {
    sessions: Mutex<HashMap<String, HashMap<Vec<String>, Change>>>,
}

impl ReviewStore {
    /// Starts a new turn: the previous turn's list is implicitly accepted.
    pub fn begin_turn(&self, session_id: &str) {
        self.lock().remove(session_id);
    }

    /// Drops all state for a closed session.
    pub fn close_session(&self, session_id: &str) {
        self.lock().remove(session_id);
    }

    /// Records a bridge write. `original` is what was on disk right before
    /// it; only the first write of a turn keeps its original.
    pub fn record_write(
        &self,
        session_id: &str,
        path: &Path,
        original: Option<Vec<u8>>,
        written: &str,
    ) {
        self.record(session_id, path, original, written);
    }

    /// Records an agent-side write reported as ACP `diff` content
    /// (`oldText: null` = new file).
    pub fn record_diff(
        &self,
        session_id: &str,
        path: &Path,
        old_text: Option<&str>,
        new_text: &str,
    ) {
        self.record(
            session_id,
            path,
            old_text.map(|text| text.as_bytes().to_vec()),
            new_text,
        );
    }

    fn record(&self, session_id: &str, path: &Path, original: Option<Vec<u8>>, latest: &str) {
        let mut sessions = self.lock();
        let changes = sessions.entry(session_id.to_owned()).or_default();
        changes
            .entry(fs_bridge::path_key(path))
            .and_modify(|change| change.latest = latest.to_owned())
            .or_insert_with(|| Change {
                path: path.to_path_buf(),
                original,
                latest: latest.to_owned(),
            });
    }

    /// Files changed in the current turn, in path order.
    pub fn changed_files(&self, session_id: &str) -> Vec<ChangedFile> {
        let sessions = self.lock();
        let mut files: Vec<ChangedFile> = sessions
            .get(session_id)
            .into_iter()
            .flat_map(|changes| changes.values())
            .map(|change| ChangedFile {
                path: change.path.to_string_lossy().into_owned(),
                created: change.original.is_none(),
            })
            .collect();
        files.sort_by(|a, b| a.path.cmp(&b.path));
        files
    }

    /// "Kabul et": forgets one file's snapshot, or all of the session's.
    pub fn accept(&self, session_id: &str, path: Option<&Path>) {
        let mut sessions = self.lock();
        match path {
            None => {
                sessions.remove(session_id);
            }
            Some(path) => {
                if let Some(changes) = sessions.get_mut(session_id) {
                    changes.remove(&fs_bridge::path_key(path));
                }
            }
        }
    }

    /// "Geri al": restores the pre-turn content of `path` if the disk still
    /// holds what the agent wrote. `roots` are the session's canonical
    /// workspace roots; the path is re-checked against them because diff
    /// paths come straight from the agent.
    pub fn revert(
        &self,
        session_id: &str,
        path: &Path,
        roots: &[PathBuf],
    ) -> Result<RevertOutcome, ReviewError> {
        let resolved = fs_bridge::resolve_in_roots(path, roots)?;
        let key = fs_bridge::path_key(&resolved);
        let change = self
            .lock()
            .get(session_id)
            .and_then(|changes| changes.get(&key).cloned())
            .ok_or(ReviewError::NotTracked)?;

        let on_disk = match fs_bridge::read_capped(&resolved) {
            Ok(bytes) => Some(bytes),
            Err(FsBridgeError::NotFound) => None,
            Err(err) => return Err(err.into()),
        };
        let unchanged = on_disk
            .as_deref()
            .is_some_and(|bytes| same_text(bytes, &change.latest));
        if !unchanged {
            return Ok(RevertOutcome::Conflict);
        }

        match &change.original {
            Some(bytes) => fs_bridge::write_bytes_atomic(&resolved, bytes)?,
            None => std::fs::remove_file(&resolved)?,
        }
        if let Some(changes) = self.lock().get_mut(session_id) {
            changes.remove(&key);
        }
        Ok(RevertOutcome::Reverted)
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, HashMap<Vec<String>, Change>>> {
        // A panic while holding the lock leaves plain data behind; keep going.
        self.sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Disk bytes equal the agent's text, ignoring CRLF vs LF (agents report
/// diffs with normalized line endings).
fn same_text(disk: &[u8], text: &str) -> bool {
    if disk == text.as_bytes() {
        return true;
    }
    match std::str::from_utf8(disk) {
        Ok(disk) => disk.replace("\r\n", "\n") == text.replace("\r\n", "\n"),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup() -> (tempfile::TempDir, PathBuf, Vec<PathBuf>) {
        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path()).unwrap();
        let roots = fs_bridge::canonical_roots(&[root.clone()]);
        (dir, root, roots)
    }

    #[test]
    fn revert_restores_original_when_disk_unchanged() {
        let (_dir, root, roots) = setup();
        let file = root.join("a.rs");
        fs::write(&file, "old").unwrap();
        let store = ReviewStore::default();
        store.record_write("s1", &file, Some(b"old".to_vec()), "new");
        fs::write(&file, "new").unwrap();

        assert_eq!(
            store.revert("s1", &file, &roots).unwrap(),
            RevertOutcome::Reverted
        );
        assert_eq!(fs::read_to_string(&file).unwrap(), "old");
        assert!(store.changed_files("s1").is_empty());
    }

    #[test]
    fn revert_reports_conflict_when_file_changed_later() {
        let (_dir, root, roots) = setup();
        let file = root.join("a.rs");
        let store = ReviewStore::default();
        store.record_write("s1", &file, Some(b"old".to_vec()), "new");
        fs::write(&file, "new plus a user edit").unwrap();

        assert_eq!(
            store.revert("s1", &file, &roots).unwrap(),
            RevertOutcome::Conflict
        );
        assert_eq!(fs::read_to_string(&file).unwrap(), "new plus a user edit");
        assert_eq!(store.changed_files("s1").len(), 1, "kept for the diff view");
    }

    #[test]
    fn revert_conflicts_when_file_was_deleted() {
        let (_dir, root, roots) = setup();
        let file = root.join("gone.rs");
        let store = ReviewStore::default();
        store.record_write("s1", &file, Some(b"old".to_vec()), "new");

        assert_eq!(
            store.revert("s1", &file, &roots).unwrap(),
            RevertOutcome::Conflict
        );
        assert!(!file.exists());
    }

    #[test]
    fn revert_of_new_file_deletes_it() {
        let (_dir, root, roots) = setup();
        let file = root.join("created.rs");
        let store = ReviewStore::default();
        store.record_write("s1", &file, None, "fresh");
        fs::write(&file, "fresh").unwrap();
        assert!(store.changed_files("s1")[0].created);

        assert_eq!(
            store.revert("s1", &file, &roots).unwrap(),
            RevertOutcome::Reverted
        );
        assert!(!file.exists());
    }

    #[test]
    fn first_write_of_turn_keeps_its_original() {
        let (_dir, root, roots) = setup();
        let file = root.join("a.rs");
        let store = ReviewStore::default();
        store.record_write("s1", &file, Some(b"v0".to_vec()), "v1");
        store.record_write("s1", &file, Some(b"v1".to_vec()), "v2");
        fs::write(&file, "v2").unwrap();

        store.revert("s1", &file, &roots).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "v0");
    }

    #[test]
    fn diff_records_tolerate_crlf_on_disk() {
        let (_dir, root, roots) = setup();
        let file = root.join("a.rs");
        let store = ReviewStore::default();
        store.record_diff("s1", &file, Some("one\r\n"), "one\ntwo\n");
        fs::write(&file, "one\r\ntwo\r\n").unwrap();

        assert_eq!(
            store.revert("s1", &file, &roots).unwrap(),
            RevertOutcome::Reverted
        );
        assert_eq!(fs::read_to_string(&file).unwrap(), "one\r\n");
    }

    #[test]
    fn revert_refuses_untracked_and_outside_paths() {
        let (_dir, root, roots) = setup();
        let store = ReviewStore::default();
        assert!(matches!(
            store.revert("s1", &root.join("x.rs"), &roots),
            Err(ReviewError::NotTracked)
        ));

        // A diff path reported by the agent outside the workspace is never written.
        let other = tempfile::tempdir().unwrap();
        let outside = dunce::canonicalize(other.path()).unwrap().join("victim.txt");
        fs::write(&outside, "keep").unwrap();
        store.record_diff("s1", &outside, Some("before"), "keep");
        assert!(matches!(
            store.revert("s1", &outside, &roots),
            Err(ReviewError::Sandbox(SandboxError::OutsideWorkspace))
        ));
        assert_eq!(fs::read_to_string(&outside).unwrap(), "keep");
    }

    #[test]
    fn begin_turn_and_accept_clear_snapshots() {
        let (_dir, root, _roots) = setup();
        let store = ReviewStore::default();
        store.record_write("s1", &root.join("a.rs"), None, "a");
        store.record_write("s1", &root.join("b.rs"), None, "b");
        store.record_write("s2", &root.join("c.rs"), None, "c");

        store.accept("s1", Some(&root.join("a.rs")));
        assert_eq!(store.changed_files("s1").len(), 1);
        store.begin_turn("s1");
        assert!(store.changed_files("s1").is_empty());
        assert_eq!(store.changed_files("s2").len(), 1, "other sessions untouched");
        store.accept("s2", None);
        assert!(store.changed_files("s2").is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn paths_differing_only_in_case_are_one_change() {
        let (_dir, root, _roots) = setup();
        let store = ReviewStore::default();
        store.record_write("s1", &root.join("Main.rs"), Some(b"0".to_vec()), "1");
        store.record_write("s1", &root.join("MAIN.RS"), Some(b"1".to_vec()), "2");
        assert_eq!(store.changed_files("s1").len(), 1);
    }

    #[test]
    fn outcome_serializes_lowercase() {
        assert_eq!(
            serde_json::to_string(&RevertOutcome::Conflict).unwrap(),
            r#""conflict""#
        );
    }
}

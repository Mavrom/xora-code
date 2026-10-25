pub mod commands;

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

/// A single Inbox note. The frontend owns the list and generates ids.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub text: String,
    pub pinned: bool,
    pub done: bool,
    /// Unix epoch milliseconds.
    pub created_at: i64,
    /// Unix epoch milliseconds.
    pub updated_at: i64,
}

/// Failure of a notes file operation; converted into `AppError` at the IPC edge.
#[derive(Debug, thiserror::Error)]
pub enum NotesError {
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error("notes file is not valid JSON: {0}")]
    Json(#[from] serde_json::Error),
}

/// Reads the notes file. A missing file means an empty inbox; a corrupt file
/// is reported as an error and left untouched so no user data is discarded.
pub fn load(path: &Path) -> Result<Vec<Note>, NotesError> {
    match std::fs::read(path) {
        Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(err) => Err(err.into()),
    }
}

/// Atomically replaces the notes file: writes a synced sibling temp file, then
/// renames it over the target, so a crash never leaves a half-written file.
pub fn save(path: &Path, notes: &[Note]) -> Result<(), NotesError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_vec_pretty(notes)?;
    let tmp = temp_path(path);
    if let Err(err) = write_synced(&tmp, &json).and_then(|()| std::fs::rename(&tmp, path)) {
        // Best-effort cleanup; the original error is what matters to the caller.
        let _ = std::fs::remove_file(&tmp);
        return Err(err.into());
    }
    Ok(())
}

/// `notes.json` -> `notes.json.tmp`, in the same directory so the final
/// rename stays on one filesystem.
fn temp_path(path: &Path) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_owned();
    name.push(".tmp");
    path.with_file_name(name)
}

fn write_synced(path: &Path, contents: &[u8]) -> io::Result<()> {
    let mut file = File::create(path)?;
    file.write_all(contents)?;
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as stdfs;

    fn sample_notes() -> Vec<Note> {
        vec![
            Note {
                id: "a1".into(),
                text: "Refactor the file tree".into(),
                pinned: true,
                done: false,
                created_at: 1_700_000_000_000,
                updated_at: 1_700_000_000_500,
            },
            Note {
                id: "b2".into(),
                text: "Ship the Inbox".into(),
                pinned: false,
                done: true,
                created_at: 1_700_000_001_000,
                updated_at: 1_700_000_002_000,
            },
        ]
    }

    #[test]
    fn load_missing_file_returns_empty() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(load(&dir.path().join("notes.json")).unwrap(), vec![]);
    }

    #[test]
    fn save_then_load_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("notes.json");
        let notes = sample_notes();

        save(&file, &notes).unwrap();

        assert_eq!(load(&file).unwrap(), notes);
    }

    #[test]
    fn save_creates_missing_parent_dir() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("nested").join("deeper").join("notes.json");

        save(&file, &sample_notes()).unwrap();

        assert!(file.is_file());
    }

    #[test]
    fn save_leaves_no_temp_file_and_overwrites_previous() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("notes.json");
        let notes = sample_notes();

        save(&file, &notes).unwrap();
        save(&file, &notes[1..]).unwrap();

        assert!(!dir.path().join("notes.json.tmp").exists());
        assert_eq!(load(&file).unwrap(), &notes[1..]);
    }

    #[test]
    fn load_invalid_json_errors_and_keeps_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("notes.json");
        stdfs::write(&file, "{ not json").unwrap();

        assert!(matches!(load(&file), Err(NotesError::Json(_))));
        assert_eq!(stdfs::read_to_string(&file).unwrap(), "{ not json");
    }

    #[test]
    fn serializes_timestamps_as_camel_case() {
        let json = serde_json::to_string(&sample_notes()[0]).unwrap();
        assert!(json.contains(r#""createdAt":1700000000000"#));
        assert!(json.contains(r#""updatedAt":1700000000500"#));
    }
}

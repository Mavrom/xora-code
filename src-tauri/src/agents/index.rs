//! Local session index (design doc 3.8): `<app data>/agents/sessions.json`.
//! The only history source for Gemini; merged with `session/list` for the others.

use super::events::AgentId;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntry {
    pub agent_id: AgentId,
    pub session_id: String,
    pub cwd: String,
    pub title: Option<String>,
    /// RFC 3339 (what ACP `session_info_update.updatedAt` uses).
    pub updated_at: Option<String>,
}

/// Keeps the newest entries only, so the file stays small.
pub const MAX_ENTRIES: usize = 500;

#[derive(Clone, Default)]
pub struct SessionIndex {
    path: Arc<Mutex<Option<PathBuf>>>,
    lock: Arc<Mutex<()>>,
}

fn now_rfc3339() -> String {
    // Seconds precision is enough for ordering a history list.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default();
    rfc3339_from_unix(secs)
}

/// Formats a UTC unix timestamp as `YYYY-MM-DDTHH:MM:SSZ` (no chrono dependency).
pub fn rfc3339_from_unix(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    // Civil-from-days (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        rem / 3_600,
        (rem % 3_600) / 60,
        rem % 60
    )
}

pub fn load(path: &Path) -> Vec<SessionEntry> {
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn save(path: &Path, entries: &[SessionEntry]) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let bytes = serde_json::to_vec_pretty(entries).map_err(std::io::Error::other)?;
    super::fs_bridge::write_bytes_atomic(path, &bytes)
}

/// Inserts or updates one entry (newest first), keeping `title` unless replaced.
pub fn upsert(entries: &mut Vec<SessionEntry>, mut entry: SessionEntry) {
    if let Some(pos) = entries
        .iter()
        .position(|e| e.agent_id == entry.agent_id && e.session_id == entry.session_id)
    {
        let old = entries.remove(pos);
        if entry.title.is_none() {
            entry.title = old.title;
        }
    }
    entries.insert(0, entry);
    entries.truncate(MAX_ENTRIES);
}

impl SessionIndex {
    pub fn set_path(&self, path: PathBuf) {
        *self.path.lock().unwrap_or_else(PoisonError::into_inner) = Some(path);
    }

    fn path(&self) -> Option<PathBuf> {
        self.path
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    /// Records activity on a session. IO errors are ignored: history is a convenience.
    pub fn touch(&self, agent_id: AgentId, session_id: &str, cwd: &str, title: Option<String>) {
        let Some(path) = self.path() else { return };
        let _guard = self.lock.lock().unwrap_or_else(PoisonError::into_inner);
        let mut entries = load(&path);
        upsert(
            &mut entries,
            SessionEntry {
                agent_id,
                session_id: session_id.to_owned(),
                cwd: cwd.to_owned(),
                title,
                updated_at: Some(now_rfc3339()),
            },
        );
        let _ = save(&path, &entries);
    }

    /// Entries of one agent in one folder (case-insensitive path match on Windows).
    pub fn list(&self, agent_id: AgentId, cwd: &str) -> Vec<SessionEntry> {
        let Some(path) = self.path() else {
            return Vec::new();
        };
        let key = normalize(cwd);
        load(&path)
            .into_iter()
            .filter(|e| e.agent_id == agent_id && normalize(&e.cwd) == key)
            .collect()
    }
}

fn normalize(path: &str) -> String {
    let trimmed = path.trim_end_matches(['\\', '/']);
    if cfg!(windows) {
        trimmed.replace('/', "\\").to_lowercase()
    } else {
        trimmed.to_owned()
    }
}

/// Agent-reported sessions first (they include sessions started from the CLI),
/// then index-only ones; titles fall back to the index.
pub fn merge(agent: Vec<SessionEntry>, local: Vec<SessionEntry>) -> Vec<SessionEntry> {
    let mut out = agent;
    for entry in local {
        match out.iter_mut().find(|e| e.session_id == entry.session_id) {
            Some(existing) => {
                if existing.title.is_none() {
                    existing.title = entry.title;
                }
                if existing.updated_at.is_none() {
                    existing.updated_at = entry.updated_at;
                }
            }
            None => out.push(entry),
        }
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, title: Option<&str>, at: &str) -> SessionEntry {
        SessionEntry {
            agent_id: AgentId::Gemini,
            session_id: id.into(),
            cwd: "C:\\proj".into(),
            title: title.map(Into::into),
            updated_at: Some(at.into()),
        }
    }

    #[test]
    fn formats_unix_time_as_rfc3339() {
        assert_eq!(rfc3339_from_unix(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339_from_unix(1_761_400_000), "2025-10-25T13:46:40Z");
    }

    #[test]
    fn upsert_moves_to_front_and_keeps_title() {
        let mut entries = vec![entry("a", Some("first"), "1"), entry("b", None, "2")];
        upsert(&mut entries, entry("a", None, "3"));
        assert_eq!(entries[0].session_id, "a");
        assert_eq!(entries[0].title.as_deref(), Some("first"));
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn merge_prefers_agent_entries_and_sorts_newest_first() {
        let agent = vec![entry("a", None, "2025-01-02")];
        let local = vec![
            entry("a", Some("from index"), "2025-01-01"),
            entry("b", None, "2025-01-03"),
        ];
        let merged = merge(agent, local);
        assert_eq!(merged[0].session_id, "b");
        assert_eq!(merged[1].title.as_deref(), Some("from index"));
    }

    #[test]
    fn touch_and_list_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let index = SessionIndex::default();
        index.set_path(dir.path().join("agents").join("sessions.json"));
        index.touch(AgentId::Gemini, "s1", "C:\\Proj\\", Some("Başlık".into()));
        index.touch(AgentId::Claude, "s2", "C:\\Proj", None);
        let gemini = index.list(AgentId::Gemini, "c:/proj");
        if cfg!(windows) {
            assert_eq!(gemini.len(), 1);
            assert_eq!(gemini[0].title.as_deref(), Some("Başlık"));
        }
        assert!(index.list(AgentId::Codex, "C:\\Proj").is_empty());
    }
}

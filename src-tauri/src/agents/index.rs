//! Local session index: `<app data>/agents/sessions.json`.
//! The only history source for Gemini; merged with `session/list` for the others.

use super::events::AgentId;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
    /// Moved out of the sidebar list by the user; still openable from the archive.
    #[serde(default, skip_serializing_if = "is_false")]
    pub archived: bool,
    /// Deleted by the user. Kept as a tombstone so an agent that cannot delete (or was not
    /// running) does not bring it back through `session/list`.
    #[serde(default, skip_serializing_if = "is_false")]
    pub deleted: bool,
    /// Kept at the top of the sidebar list.
    #[serde(default, skip_serializing_if = "is_false")]
    pub pinned: bool,
    /// The user's own name for it; shown instead of the agent's title, which keeps updating.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_title: Option<String>,
}

fn is_false(value: &bool) -> bool {
    !value
}

/// A user action on one history entry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Mark {
    Archived(bool),
    Deleted,
    Pinned(bool),
    /// `None` gives the agent's title back.
    Renamed(Option<String>),
}

/// Keeps the newest entries only, so the file stays small.
pub const MAX_ENTRIES: usize = 500;

/// Agent titles waiting for [`SessionIndex::flush_title`]: the newest per session, with its cwd.
type QueuedTitles = HashMap<(AgentId, String), (String, String)>;

/// Every method that writes `sessions.json` does blocking IO (write and sync): call it on
/// the blocking pool, never on a tokio worker or the adapter's reader task.
#[derive(Clone, Default)]
pub struct SessionIndex {
    path: Arc<Mutex<Option<PathBuf>>>,
    /// Serializes read-modify-write of the file. Taken before `titles`, never after.
    lock: Arc<Mutex<()>>,
    titles: Arc<Mutex<QueuedTitles>>,
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
        // Activity never undoes what the user decided about the conversation.
        entry.archived = old.archived;
        entry.pinned = old.pinned;
        entry.custom_title = old.custom_title;
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
        write_touch(&path, agent_id, session_id, cwd, title);
    }

    /// Remembers the agent's newest title for a session without touching the disk, so the
    /// adapter's reader task never blocks on it; [`Self::flush_title`] writes it.
    pub fn queue_title(&self, agent_id: AgentId, session_id: &str, cwd: &str, title: String) {
        self.titles
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .insert((agent_id, session_id.to_owned()), (cwd.to_owned(), title));
    }

    /// Writes the session's queued title, if one is still queued. The queue is read under
    /// the file lock, so flushes that overlap or run out of order still end with the
    /// newest title on disk: a title queued after this flush took it waits for the lock.
    pub fn flush_title(&self, agent_id: AgentId, session_id: &str) {
        let Some(path) = self.path() else { return };
        let _guard = self.lock.lock().unwrap_or_else(PoisonError::into_inner);
        let queued = self
            .titles
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .remove(&(agent_id, session_id.to_owned()));
        if let Some((cwd, title)) = queued {
            write_touch(&path, agent_id, session_id, &cwd, Some(title));
        }
    }

    /// Archives, unarchives or deletes an entry, adding it (without a timestamp, so its
    /// place in the list does not move) when only the agent knew about it.
    pub fn mark(
        &self,
        agent_id: AgentId,
        session_id: &str,
        cwd: &str,
        mark: Mark,
    ) -> std::io::Result<()> {
        let Some(path) = self.path() else {
            return Ok(());
        };
        let _guard = self.lock.lock().unwrap_or_else(PoisonError::into_inner);
        let mut entries = load(&path);
        apply_mark(&mut entries, agent_id, session_id, cwd, mark);
        save(&path, &entries)
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

/// The body of a touch; the caller holds the file lock. IO errors are ignored.
fn write_touch(path: &Path, agent_id: AgentId, session_id: &str, cwd: &str, title: Option<String>) {
    let mut entries = load(path);
    upsert(
        &mut entries,
        SessionEntry {
            agent_id,
            session_id: session_id.to_owned(),
            cwd: cwd.to_owned(),
            title,
            updated_at: Some(now_rfc3339()),
            archived: false,
            deleted: false,
            pinned: false,
            custom_title: None,
        },
    );
    let _ = save(path, &entries);
}

fn normalize(path: &str) -> String {
    let trimmed = path.trim_end_matches(['\\', '/']);
    if cfg!(windows) {
        trimmed.replace('/', "\\").to_lowercase()
    } else {
        trimmed.to_owned()
    }
}

pub fn apply_mark(
    entries: &mut Vec<SessionEntry>,
    agent_id: AgentId,
    session_id: &str,
    cwd: &str,
    mark: Mark,
) {
    let pos = entries
        .iter()
        .position(|e| e.agent_id == agent_id && e.session_id == session_id);
    let entry = match pos {
        Some(pos) => &mut entries[pos],
        None => {
            entries.push(SessionEntry {
                agent_id,
                session_id: session_id.to_owned(),
                cwd: cwd.to_owned(),
                title: None,
                updated_at: None,
                archived: false,
                deleted: false,
                pinned: false,
                custom_title: None,
            });
            entries.last_mut().expect("just pushed")
        }
    };
    match mark {
        Mark::Archived(archived) => entry.archived = archived,
        Mark::Deleted => entry.deleted = true,
        Mark::Pinned(pinned) => entry.pinned = pinned,
        Mark::Renamed(title) => {
            entry.custom_title = title.map(|t| t.trim().to_owned()).filter(|t| !t.is_empty());
        }
    }
}

/// Agent-reported sessions first (they include sessions started from the CLI),
/// then index-only ones; titles fall back to the index, the user's archive and
/// delete marks always come from it, and deleted sessions are left out.
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
                existing.archived = entry.archived;
                existing.deleted = entry.deleted;
                existing.pinned = entry.pinned;
                existing.custom_title = entry.custom_title;
            }
            None => out.push(entry),
        }
    }
    out.retain(|e| !e.deleted);
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
            archived: false,
            deleted: false,
            pinned: false,
            custom_title: None,
        }
    }

    #[test]
    fn marks_follow_the_index_into_the_merged_list() {
        let mut local = vec![entry("a", Some("kept"), "2025-01-01")];
        apply_mark(
            &mut local,
            AgentId::Gemini,
            "a",
            "C:/proj",
            Mark::Archived(true),
        );
        // Known only to the agent: added without a timestamp, then hidden as deleted.
        apply_mark(&mut local, AgentId::Gemini, "b", "C:/proj", Mark::Deleted);
        assert_eq!(local.len(), 2);
        assert_eq!(local[1].updated_at, None);

        let agent = vec![
            entry("a", None, "2025-01-02"),
            entry("b", None, "2025-01-03"),
        ];
        let merged = merge(agent, local);
        assert_eq!(merged.len(), 1, "deleted sessions are dropped");
        assert!(merged[0].archived);
        assert_eq!(merged[0].title.as_deref(), Some("kept"));
    }

    #[test]
    fn unarchive_and_old_files_without_flags() {
        let mut local = vec![entry("a", None, "1")];
        apply_mark(
            &mut local,
            AgentId::Gemini,
            "a",
            "C:/proj",
            Mark::Archived(true),
        );
        apply_mark(
            &mut local,
            AgentId::Gemini,
            "a",
            "C:/proj",
            Mark::Archived(false),
        );
        assert!(!local[0].archived);
        let old: SessionEntry = serde_json::from_str(
            r#"{"agentId":"gemini","sessionId":"x","cwd":"C:/p","title":null,"updatedAt":null}"#,
        )
        .unwrap();
        assert!(!old.archived && !old.deleted);
    }

    #[test]
    fn formats_unix_time_as_rfc3339() {
        assert_eq!(rfc3339_from_unix(0), "1970-01-01T00:00:00Z");
        assert_eq!(rfc3339_from_unix(1_761_400_000), "2025-10-25T13:46:40Z");
    }

    #[test]
    fn activity_keeps_the_users_marks() {
        let mut entries = vec![entry("a", Some("agent"), "1")];
        apply_mark(
            &mut entries,
            AgentId::Gemini,
            "a",
            "C:\\proj",
            Mark::Archived(true),
        );
        apply_mark(
            &mut entries,
            AgentId::Gemini,
            "a",
            "C:\\proj",
            Mark::Pinned(true),
        );
        apply_mark(
            &mut entries,
            AgentId::Gemini,
            "a",
            "C:\\proj",
            Mark::Renamed(Some("  Benim adım ".into())),
        );
        upsert(&mut entries, entry("a", Some("newer agent title"), "2"));
        let e = &entries[0];
        assert!(e.archived && e.pinned);
        assert_eq!(e.custom_title.as_deref(), Some("Benim adım"));
        assert_eq!(e.title.as_deref(), Some("newer agent title"));
        apply_mark(
            &mut entries,
            AgentId::Gemini,
            "a",
            "C:\\proj",
            Mark::Renamed(Some(" ".into())),
        );
        assert_eq!(entries[0].custom_title, None);
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
    fn concurrent_marks_do_not_lose_each_other() {
        // The commands run marks on the blocking pool, so several can overlap.
        let dir = tempfile::tempdir().unwrap();
        let index = SessionIndex::default();
        index.set_path(dir.path().join("sessions.json"));
        let threads: Vec<_> = (0..16)
            .map(|i| {
                let index = index.clone();
                std::thread::spawn(move || {
                    let id = format!("s{i}");
                    index
                        .mark(AgentId::Gemini, &id, "C:\\p", Mark::Pinned(true))
                        .unwrap();
                    index
                        .mark(
                            AgentId::Gemini,
                            &id,
                            "C:\\p",
                            Mark::Renamed(Some(id.clone())),
                        )
                        .unwrap();
                })
            })
            .collect();
        for thread in threads {
            thread.join().unwrap();
        }
        let entries = load(&dir.path().join("sessions.json"));
        assert_eq!(entries.len(), 16);
        assert!(
            entries
                .iter()
                .all(|e| e.pinned && e.custom_title.as_deref() == Some(e.session_id.as_str()))
        );
    }

    #[test]
    fn title_flushes_in_any_order_keep_the_newest_title() {
        // Titles are queued in order on the reader task, then flushed on the blocking pool,
        // where the flushes can run in any order, alongside a delete mark.
        let dir = tempfile::tempdir().unwrap();
        let index = SessionIndex::default();
        index.set_path(dir.path().join("sessions.json"));
        let mut threads = Vec::new();
        for i in 0..16 {
            index.queue_title(AgentId::Claude, "s", "C:\\p", format!("t{i}"));
            let index = index.clone();
            threads.push(std::thread::spawn(move || {
                index.flush_title(AgentId::Claude, "s");
            }));
        }
        let marker = index.clone();
        threads.push(std::thread::spawn(move || {
            marker
                .mark(AgentId::Claude, "other", "C:\\p", Mark::Deleted)
                .unwrap();
        }));
        for thread in threads {
            thread.join().unwrap();
        }
        let entries = load(&dir.path().join("sessions.json"));
        let s = entries.iter().find(|e| e.session_id == "s").unwrap();
        assert_eq!(s.title.as_deref(), Some("t15"));
        assert!(entries.iter().any(|e| e.session_id == "other" && e.deleted));
        // Nothing is left queued: a later flush writes nothing.
        index.flush_title(AgentId::Claude, "s");
        assert_eq!(load(&dir.path().join("sessions.json")), entries);
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

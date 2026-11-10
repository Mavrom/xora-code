//! Working tree status for the Changes panel: `git status --porcelain=v2 --branch -z`,
//! parsed into the branch line and one entry per changed path.

use super::{Result, git};
use serde::Serialize;
use std::path::Path;

/// Entries beyond this are dropped (`truncated` is set): a tree with an unignored build
/// folder can list hundreds of thousands of files, and the panel is not the place for them.
pub const MAX_ENTRIES: usize = 5_000;

/// The arguments every status read uses. `--no-optional-locks`: reading must never take
/// `index.lock` from under an agent that is committing at the same moment.
pub(super) const STATUS_ARGS: &[&str] = &[
    "--no-optional-locks",
    "status",
    "--porcelain=v2",
    "--branch",
    "-z",
    "--untracked-files=all",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Modified,
    Added,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
}

impl ChangeKind {
    /// One side of porcelain's `XY` field; `.` (unchanged) and anything unknown are none.
    fn from_code(code: u8) -> Option<Self> {
        match code {
            b'M' => Some(Self::Modified),
            b'A' => Some(Self::Added),
            b'D' => Some(Self::Deleted),
            b'R' => Some(Self::Renamed),
            b'C' => Some(Self::Copied),
            b'T' => Some(Self::TypeChanged),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusEntry {
    /// Relative to the repository root, with forward slashes.
    pub path: String,
    /// The old path of a rename or copy.
    pub orig_path: Option<String>,
    /// Change between HEAD and the index.
    pub staged: Option<ChangeKind>,
    /// Change between the index and the working tree.
    pub unstaged: Option<ChangeKind>,
    pub untracked: bool,
    /// Unmerged (a merge, rebase or cherry-pick stopped on it).
    pub conflicted: bool,
}

impl StatusEntry {
    fn new(path: &str) -> Self {
        Self {
            path: path.to_owned(),
            orig_path: None,
            staged: None,
            unstaged: None,
            untracked: false,
            conflicted: false,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    /// Repository root as git spells it, for turning entry paths into file paths.
    pub root: String,
    /// Current branch; none when HEAD is detached.
    pub branch: Option<String>,
    /// Short id of the HEAD commit; none before the first commit.
    pub head: Option<String>,
    pub upstream: Option<String>,
    /// Commits the branch has that its upstream does not, and the other way round.
    pub ahead: u32,
    pub behind: u32,
    pub entries: Vec<StatusEntry>,
    /// More than [`MAX_ENTRIES`] paths changed; only the first ones are listed.
    pub truncated: bool,
}

fn header(status: &mut Status, line: &str) {
    let (key, value) = line.split_once(' ').unwrap_or((line, ""));
    match key {
        "branch.oid" if value != "(initial)" => {
            status.head = Some(value.chars().take(7).collect());
        }
        "branch.head" if value != "(detached)" => status.branch = Some(value.to_owned()),
        "branch.upstream" => status.upstream = Some(value.to_owned()),
        "branch.ab" => {
            for part in value.split(' ') {
                if let Some(n) = part.strip_prefix('+') {
                    status.ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = part.strip_prefix('-') {
                    status.behind = n.parse().unwrap_or(0);
                }
            }
        }
        _ => {}
    }
}

/// The entry for a changed record (`1`/`2`/`u`): `fields` space-separated fields, the last
/// of which is the path (it may itself contain spaces).
fn changed(record: &str, fields: usize) -> Option<StatusEntry> {
    let parts: Vec<&str> = record.splitn(fields, ' ').collect();
    let (xy, path) = (parts.get(1)?.as_bytes(), *parts.get(fields - 1)?);
    if xy.len() != 2 || path.is_empty() {
        return None;
    }
    let mut entry = StatusEntry::new(path);
    if record.starts_with('u') {
        entry.conflicted = true;
    } else {
        entry.staged = ChangeKind::from_code(xy[0]);
        entry.unstaged = ChangeKind::from_code(xy[1]);
    }
    Some(entry)
}

/// Parses `git status --porcelain=v2 --branch -z` (every entry, uncapped).
pub fn parse_status(text: &str) -> Status {
    let mut status = Status::default();
    let mut records = text.split('\0');
    while let Some(record) = records.next() {
        let entry = match record.as_bytes().first() {
            Some(b'#') => {
                header(&mut status, record.trim_start_matches("# "));
                None
            }
            // `1 XY sub mH mI mW hH hI path`
            Some(b'1') => changed(record, 9),
            // `2 XY sub mH mI mW hH hI Xscore path`, then the old path as its own record.
            Some(b'2') => {
                let orig = records.next().filter(|p| !p.is_empty()).map(str::to_owned);
                changed(record, 10).map(|e| StatusEntry {
                    orig_path: orig,
                    ..e
                })
            }
            // `u XY sub m1 m2 m3 mW h1 h2 h3 path`
            Some(b'u') => changed(record, 11),
            Some(b'?') => record
                .strip_prefix("? ")
                .filter(|p| !p.is_empty())
                .map(|p| StatusEntry {
                    untracked: true,
                    ..StatusEntry::new(p)
                }),
            _ => None,
        };
        status.entries.extend(entry);
    }
    status
}

/// Root of the repository `dir` belongs to; `[not_repo]` when it belongs to none.
pub(super) fn toplevel(dir: &Path) -> Result<String> {
    git(dir, &["rev-parse", "--show-toplevel"])
}

/// Status of the repository `dir` belongs to, at most [`MAX_ENTRIES`] entries.
pub fn status(dir: &Path) -> Result<Status> {
    let root = toplevel(dir)?;
    let mut status = parse_status(&git(Path::new(&root), STATUS_ARGS)?);
    if status.entries.len() > MAX_ENTRIES {
        status.entries.truncate(MAX_ENTRIES);
        status.truncated = true;
    }
    status.root = root;
    Ok(status)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::{GitError, test_repo};

    const SHA: &str = "0123456789abcdef0123456789abcdef01234567";

    fn records(parts: &[&str]) -> String {
        parts.iter().map(|p| format!("{p}\0")).collect()
    }

    fn ordinary(xy: &str, path: &str) -> String {
        format!("1 {xy} N... 100644 100644 100644 {SHA} {SHA} {path}")
    }

    #[test]
    fn parses_branch_headers() {
        let text = records(&[
            &format!("# branch.oid {SHA}"),
            "# branch.head feature/x",
            "# branch.upstream origin/feature/x",
            "# branch.ab +2 -5",
        ]);
        let status = parse_status(&text);
        assert_eq!(status.branch.as_deref(), Some("feature/x"));
        assert_eq!(status.head.as_deref(), Some("0123456"));
        assert_eq!(status.upstream.as_deref(), Some("origin/feature/x"));
        assert_eq!((status.ahead, status.behind), (2, 5));
        assert!(status.entries.is_empty());
    }

    #[test]
    fn no_upstream_and_unborn_branch() {
        let status = parse_status(&records(&["# branch.oid (initial)", "# branch.head main"]));
        assert_eq!(status.branch.as_deref(), Some("main"));
        assert_eq!(status.head, None);
        assert_eq!(status.upstream, None);
        assert_eq!((status.ahead, status.behind), (0, 0));
    }

    #[test]
    fn detached_head_has_no_branch() {
        let status = parse_status(&records(&[
            &format!("# branch.oid {SHA}"),
            "# branch.head (detached)",
        ]));
        assert_eq!(status.branch, None);
        assert_eq!(status.head.as_deref(), Some("0123456"));
    }

    #[test]
    fn parses_each_kind_of_entry() {
        let text = records(&[
            &ordinary(".M", "src/modified.rs"),
            &ordinary("A.", "added.txt"),
            &ordinary(".D", "gone.txt"),
            &ordinary("MM", "both.txt"),
            &format!("2 R. N... 100644 100644 100644 {SHA} {SHA} R100 new name.txt"),
            "old name.txt",
            &format!("u UU N... 100644 100644 100644 100644 {SHA} {SHA} {SHA} clash.txt"),
            "? notes/yeni dosya ğüş.md",
        ]);
        let entries = parse_status(&text).entries;
        assert_eq!(entries.len(), 7);

        let kinds: Vec<_> = entries.iter().map(|e| (e.staged, e.unstaged)).collect();
        use ChangeKind::*;
        assert_eq!(kinds[0], (None, Some(Modified)));
        assert_eq!(kinds[1], (Some(Added), None));
        assert_eq!(kinds[2], (None, Some(Deleted)));
        assert_eq!(kinds[3], (Some(Modified), Some(Modified)));

        assert_eq!(entries[4].path, "new name.txt");
        assert_eq!(entries[4].orig_path.as_deref(), Some("old name.txt"));
        assert_eq!(entries[4].staged, Some(Renamed));

        assert!(entries[5].conflicted);
        assert_eq!((entries[5].staged, entries[5].unstaged), (None, None));
        assert_eq!(entries[5].path, "clash.txt");

        assert!(entries[6].untracked);
        assert_eq!(entries[6].path, "notes/yeni dosya ğüş.md");
    }

    #[test]
    fn ignores_malformed_records() {
        let text = records(&["1 M", "? ", "! ignored.log", ""]);
        assert!(parse_status(&text).entries.is_empty());
    }

    #[test]
    fn reads_a_real_repository() {
        let Some(dir) = test_repo() else { return }; // no git on this machine
        let p = dir.path();
        std::fs::write(p.join("a.txt"), "changed\n").unwrap();
        std::fs::write(p.join("yeni dosya ş.txt"), "new\n").unwrap();
        std::fs::create_dir(p.join("sub")).unwrap();

        // Asked from a subfolder, it still reports the whole repository from its root.
        let status = status(&p.join("sub")).unwrap();
        assert_eq!(status.branch.as_deref(), Some("main"));
        assert!(status.head.is_some());
        let paths: Vec<_> = status.entries.iter().map(|e| e.path.as_str()).collect();
        assert_eq!(paths, ["a.txt", "yeni dosya ş.txt"]);
        assert!(status.entries[1].untracked);
    }

    #[test]
    fn not_a_repository_has_its_own_code() {
        let dir = tempfile::tempdir().unwrap();
        if git(dir.path(), &["--version"]).is_err() {
            return;
        }
        assert!(matches!(status(dir.path()), Err(GitError::NotRepo)));
    }
}

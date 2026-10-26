//! Client-side file system bridge for ACP agents (design doc section 3.5):
//! `fs/read_text_file` and `fs/write_text_file`, confined to the session's
//! workspace roots.
//!
//! Every path an agent sends goes through [`resolve_in_roots`] before any IO.
//! The sandbox rejects relative paths and `..`, resolves symlinks and
//! junctions with `dunce::canonicalize` (also for not-yet-existing files, via
//! their nearest existing ancestor), refuses dangling links, Windows device
//! names and alternate data streams, and compares against the roots
//! case-insensitively on Windows.

use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf, Prefix};

/// Largest file an agent may read or write through the bridge.
pub const MAX_TEXT_FILE_BYTES: u64 = 16 * 1024 * 1024;

// JSON-RPC error codes used by the bridges (ACP schema `ErrorCode`).
pub const INVALID_PARAMS: i32 = -32602;
pub const INTERNAL_ERROR: i32 = -32603;
pub const RESOURCE_NOT_FOUND: i32 = -32002;

/// Why a path was refused by the workspace sandbox.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SandboxError {
    #[error("path must be absolute")]
    Relative,
    #[error("path must not contain '..'")]
    ParentComponent,
    #[error("path contains an invalid or reserved name")]
    InvalidName,
    #[error("path cannot be resolved: {0}")]
    Unresolvable(String),
    #[error("outside workspace")]
    OutsideWorkspace,
}

/// Canonicalizes workspace roots once, when a session registers them. Roots
/// that do not exist (or cannot be resolved) are dropped: a missing root can
/// never contain anything.
pub fn canonical_roots<P: AsRef<Path>>(roots: &[P]) -> Vec<PathBuf> {
    roots
        .iter()
        .filter_map(|root| dunce::canonicalize(root.as_ref()).ok())
        .collect()
}

/// Resolves `path` and checks that it lies inside one of `roots` (which must
/// already be canonical, see [`canonical_roots`]). Returns the canonical path
/// that all subsequent IO must use.
pub fn resolve_in_roots(path: &Path, roots: &[PathBuf]) -> Result<PathBuf, SandboxError> {
    if !path.is_absolute() {
        return Err(SandboxError::Relative);
    }
    for component in path.components() {
        match component {
            Component::ParentDir => return Err(SandboxError::ParentComponent),
            Component::Normal(name) => validate_name(name)?,
            _ => {}
        }
    }
    let resolved = canonicalize_lenient(path)?;
    if roots.iter().any(|root| is_within(&resolved, root)) {
        Ok(resolved)
    } else {
        Err(SandboxError::OutsideWorkspace)
    }
}

/// `dunce::canonicalize` that also accepts paths whose tail does not exist
/// yet: the nearest existing ancestor is canonicalized (resolving every link
/// on the way) and the missing names are appended. A missing name that is in
/// fact a dangling symlink or junction is refused, because writing through it
/// would create its target, which may lie anywhere.
fn canonicalize_lenient(path: &Path) -> Result<PathBuf, SandboxError> {
    let mut missing = Vec::new();
    let mut current = path.to_path_buf();
    loop {
        match dunce::canonicalize(&current) {
            Ok(mut base) => {
                base.extend(missing.iter().rev());
                return Ok(base);
            }
            Err(err) if err.kind() == io::ErrorKind::NotFound => {
                match fs::symlink_metadata(&current) {
                    Err(err) if err.kind() == io::ErrorKind::NotFound => {}
                    Ok(_) => {
                        return Err(SandboxError::Unresolvable(
                            "dangling link or unreadable entry".into(),
                        ));
                    }
                    Err(err) => return Err(SandboxError::Unresolvable(err.to_string())),
                }
                let name = current
                    .file_name()
                    .ok_or_else(|| SandboxError::Unresolvable("no existing ancestor".into()))?
                    .to_owned();
                missing.push(name);
                current.pop();
            }
            Err(err) => return Err(SandboxError::Unresolvable(err.to_string())),
        }
    }
}

/// Whether canonical `path` is `root` or lies below it.
pub(crate) fn is_within(path: &Path, root: &Path) -> bool {
    let path = path_key(path);
    let root = path_key(root);
    path.len() >= root.len() && path[..root.len()] == root[..]
}

/// Comparable form of a canonical path: one key per component, with the
/// drive / UNC prefix normalized (`\\?\C:` == `C:`) and names case-folded on
/// Windows.
pub(crate) fn path_key(path: &Path) -> Vec<String> {
    path.components()
        .filter_map(|component| match component {
            Component::Prefix(prefix) => Some(prefix_key(prefix.kind())),
            Component::Normal(name) => Some(name_key(name)),
            Component::ParentDir => Some("..".into()),
            Component::RootDir | Component::CurDir => None,
        })
        .collect()
}

fn prefix_key(prefix: Prefix<'_>) -> String {
    match prefix {
        Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) => {
            format!("{}:", drive.to_ascii_uppercase() as char)
        }
        Prefix::UNC(server, share) | Prefix::VerbatimUNC(server, share) => {
            format!(r"\\{}\{}", name_key(server), name_key(share))
        }
        Prefix::Verbatim(name) => format!(r"\\?\{}", name_key(name)),
        Prefix::DeviceNS(name) => format!(r"\\.\{}", name_key(name)),
    }
}

fn name_key(name: &OsStr) -> String {
    match name.to_str() {
        Some(name) => fold_case(name),
        // Never merge two distinct non-Unicode names into one key.
        None => format!("\u{0}{name:?}"),
    }
}

/// NTFS compares names with a 1:1 upcase table, so each character is folded
/// to its uppercase form only when that form is a single character (`ß`
/// stays `ß`, the Kelvin sign stays distinct from `K`).
#[cfg(windows)]
fn fold_case(name: &str) -> String {
    name.chars()
        .map(|c| {
            let mut upper = c.to_uppercase();
            match (upper.next(), upper.next()) {
                (Some(u), None) => u,
                _ => c,
            }
        })
        .collect()
}

#[cfg(not(windows))]
fn fold_case(name: &str) -> String {
    name.to_owned()
}

/// Refuses names Windows would interpret specially: separators or wildcards
/// smuggled into one component, `name:stream` alternate data streams and
/// legacy device names (`NUL`, `COM1.txt`, ...).
#[cfg(windows)]
fn validate_name(name: &OsStr) -> Result<(), SandboxError> {
    let Some(name) = name.to_str() else {
        return Ok(());
    };
    let forbidden = |c: char| matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*');
    if name.chars().any(|c| forbidden(c) || c.is_control()) {
        return Err(SandboxError::InvalidName);
    }
    let stem = name.split('.').next().unwrap_or("").trim_end_matches(' ');
    let stem = stem.to_ascii_uppercase();
    let numbered = |base: &str| {
        stem.strip_prefix(base).is_some_and(|rest| {
            let mut chars = rest.chars();
            matches!((chars.next(), chars.next()), (Some(d), None) if d.is_ascii_digit() || matches!(d, '¹' | '²' | '³'))
        })
    };
    if matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) || numbered("COM")
        || numbered("LPT")
    {
        return Err(SandboxError::InvalidName);
    }
    Ok(())
}

#[cfg(not(windows))]
fn validate_name(name: &OsStr) -> Result<(), SandboxError> {
    if name.as_encoded_bytes().contains(&0) {
        return Err(SandboxError::InvalidName);
    }
    Ok(())
}

/// Failure of a bridge file operation, mapped to a JSON-RPC error for the agent.
#[derive(Debug, thiserror::Error)]
pub enum FsBridgeError {
    #[error(transparent)]
    Sandbox(#[from] SandboxError),
    #[error("file not found")]
    NotFound,
    #[error("file is larger than {} MiB", MAX_TEXT_FILE_BYTES / 1024 / 1024)]
    TooLarge,
    #[error("file is not valid UTF-8 text")]
    NotUtf8,
    #[error("unknown session")]
    UnknownSession,
    #[error(transparent)]
    Io(#[from] io::Error),
}

impl FsBridgeError {
    /// JSON-RPC error code for the agent.
    pub fn rpc_code(&self) -> i32 {
        match self {
            Self::Sandbox(_) | Self::TooLarge | Self::UnknownSession => INVALID_PARAMS,
            Self::NotFound => RESOURCE_NOT_FOUND,
            Self::Io(err) if err.kind() == io::ErrorKind::NotFound => RESOURCE_NOT_FOUND,
            Self::NotUtf8 | Self::Io(_) => INTERNAL_ERROR,
        }
    }
}

/// Reads a whole file as bytes, refusing anything over the size cap.
pub(crate) fn read_capped(path: &Path) -> Result<Vec<u8>, FsBridgeError> {
    let meta = fs::metadata(path).map_err(|err| match err.kind() {
        io::ErrorKind::NotFound => FsBridgeError::NotFound,
        _ => FsBridgeError::Io(err),
    })?;
    if meta.len() > MAX_TEXT_FILE_BYTES {
        return Err(FsBridgeError::TooLarge);
    }
    Ok(fs::read(path)?)
}

/// `fs/read_text_file` on an already resolved path.
pub fn read_text(
    path: &Path,
    line: Option<u32>,
    limit: Option<u32>,
) -> Result<String, FsBridgeError> {
    let bytes = read_capped(path)?;
    let text = String::from_utf8(bytes).map_err(|_| FsBridgeError::NotUtf8)?;
    Ok(slice_lines(&text, line, limit))
}

/// Applies ACP's `line` (1-based start) and `limit` (line count) to `text`,
/// keeping the original line endings.
pub fn slice_lines(text: &str, line: Option<u32>, limit: Option<u32>) -> String {
    if line.is_none() && limit.is_none() {
        return text.to_owned();
    }
    let skip = line.unwrap_or(1).saturating_sub(1) as usize;
    let take = limit.map_or(usize::MAX, |n| n as usize);
    text.split_inclusive('\n').skip(skip).take(take).collect()
}

/// Atomically replaces `path` (already resolved): writes a synced sibling
/// temp file, re-checks that the parent directory still resolves inside
/// `roots` (closing most of the window for a directory being swapped for a
/// junction meanwhile), then renames over the target. Missing parent
/// directories are created; they are inside the workspace by construction.
pub fn write_text_atomic(
    path: &Path,
    content: &str,
    roots: &[PathBuf],
) -> Result<(), FsBridgeError> {
    if content.len() as u64 > MAX_TEXT_FILE_BYTES {
        return Err(FsBridgeError::TooLarge);
    }
    let parent = path
        .parent()
        .ok_or(FsBridgeError::Sandbox(SandboxError::OutsideWorkspace))?;
    fs::create_dir_all(parent)?;
    let tmp = temp_path(path);
    let result = write_new_synced(&tmp, content.as_bytes())
        .map_err(FsBridgeError::from)
        .and_then(|()| {
            let parent_now = dunce::canonicalize(parent)?;
            if !roots.iter().any(|root| is_within(&parent_now, root)) {
                return Err(SandboxError::OutsideWorkspace.into());
            }
            Ok(fs::rename(&tmp, path)?)
        });
    if result.is_err() {
        // Best-effort cleanup; the original error is what matters.
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// Writes raw bytes atomically (used by review revert to restore originals).
pub(crate) fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let tmp = temp_path(path);
    let result = write_new_synced(&tmp, bytes).and_then(|()| fs::rename(&tmp, path));
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// `main.rs` -> `.main.rs.<uuid>.xora-tmp` in the same directory, so the
/// final rename stays on one volume and never collides.
fn temp_path(path: &Path) -> PathBuf {
    let mut name = std::ffi::OsString::from(".");
    name.push(path.file_name().unwrap_or_default());
    name.push(format!(".{}.xora-tmp", uuid::Uuid::new_v4().simple()));
    path.with_file_name(name)
}

/// `create_new` refuses to follow anything already sitting at the temp name.
fn write_new_synced(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let mut file: File = OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Ws {
        _dir: tempfile::TempDir,
        root: PathBuf,
        outside: PathBuf,
    }

    /// `<tmp>/ws` is the workspace root, `<tmp>/outside` a sibling.
    fn workspace() -> Ws {
        let dir = tempfile::tempdir().unwrap();
        let base = dunce::canonicalize(dir.path()).unwrap();
        let root = base.join("ws");
        let outside = base.join("outside");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(root.join("src").join("main.rs"), "fn main() {}\n").unwrap();
        fs::write(outside.join("secret.txt"), "secret").unwrap();
        Ws {
            _dir: dir,
            root,
            outside,
        }
    }

    fn roots(ws: &Ws) -> Vec<PathBuf> {
        canonical_roots(&[ws.root.clone()])
    }

    #[test]
    fn accepts_existing_file_inside_root() {
        let ws = workspace();
        let file = ws.root.join("src").join("main.rs");
        assert_eq!(resolve_in_roots(&file, &roots(&ws)).unwrap(), file);
    }

    #[test]
    fn accepts_the_root_itself() {
        let ws = workspace();
        assert_eq!(resolve_in_roots(&ws.root, &roots(&ws)).unwrap(), ws.root);
    }

    #[test]
    fn rejects_relative_paths() {
        let ws = workspace();
        let err = resolve_in_roots(Path::new("src/main.rs"), &roots(&ws)).unwrap_err();
        assert_eq!(err, SandboxError::Relative);
    }

    #[test]
    fn rejects_parent_components_even_when_they_stay_inside() {
        let ws = workspace();
        let sneaky = ws.root.join("src").join("..").join("src").join("main.rs");
        assert_eq!(
            resolve_in_roots(&sneaky, &roots(&ws)).unwrap_err(),
            SandboxError::ParentComponent
        );
        let escape = ws.root.join("..").join("outside").join("secret.txt");
        assert_eq!(
            resolve_in_roots(&escape, &roots(&ws)).unwrap_err(),
            SandboxError::ParentComponent
        );
    }

    #[test]
    fn rejects_sibling_with_shared_name_prefix() {
        let ws = workspace();
        let sibling = ws.root.with_file_name("ws-evil");
        fs::create_dir_all(&sibling).unwrap();
        assert_eq!(
            resolve_in_roots(&sibling.join("x.txt"), &roots(&ws)).unwrap_err(),
            SandboxError::OutsideWorkspace
        );
    }

    #[test]
    fn rejects_files_outside_every_root() {
        let ws = workspace();
        let err = resolve_in_roots(&ws.outside.join("secret.txt"), &roots(&ws)).unwrap_err();
        assert_eq!(err, SandboxError::OutsideWorkspace);
    }

    #[test]
    fn accepts_any_of_several_roots() {
        let ws = workspace();
        let both = canonical_roots(&[ws.root.clone(), ws.outside.clone()]);
        assert!(resolve_in_roots(&ws.outside.join("secret.txt"), &both).is_ok());
    }

    #[test]
    fn missing_roots_are_dropped() {
        let ws = workspace();
        assert!(canonical_roots(&[ws.root.join("nope")]).is_empty());
        let err = resolve_in_roots(&ws.root.join("a.txt"), &[]).unwrap_err();
        assert_eq!(err, SandboxError::OutsideWorkspace);
    }

    #[test]
    fn accepts_new_file_in_new_directories() {
        let ws = workspace();
        let new_file = ws.root.join("new").join("deeper").join("lib.rs");
        assert_eq!(resolve_in_roots(&new_file, &roots(&ws)).unwrap(), new_file);
    }

    #[test]
    fn rejects_new_file_outside() {
        let ws = workspace();
        let err = resolve_in_roots(&ws.outside.join("new.txt"), &roots(&ws)).unwrap_err();
        assert_eq!(err, SandboxError::OutsideWorkspace);
    }

    #[cfg(windows)]
    #[test]
    fn windows_comparison_is_case_insensitive() {
        let ws = workspace();
        let shouting = PathBuf::from(ws.root.to_string_lossy().to_uppercase())
            .join("SRC")
            .join("NEW_FILE.RS");
        assert!(resolve_in_roots(&shouting, &roots(&ws)).is_ok());
        // Roots given in another case match too.
        let upper_root = vec![PathBuf::from(ws.root.to_string_lossy().to_uppercase())];
        assert!(resolve_in_roots(&ws.root.join("src").join("main.rs"), &upper_root).is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn windows_verbatim_prefix_matches_plain_root() {
        let ws = workspace();
        let verbatim = PathBuf::from(format!(r"\\?\{}", ws.root.display()))
            .join("src")
            .join("main.rs");
        assert!(resolve_in_roots(&verbatim, &roots(&ws)).is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn windows_rejects_device_names_and_streams() {
        let ws = workspace();
        for name in ["NUL", "con.txt", "COM1", "lpt9.log", "aux ", "CONOUT$"] {
            assert_eq!(
                resolve_in_roots(&ws.root.join(name), &roots(&ws)).unwrap_err(),
                SandboxError::InvalidName,
                "{name}"
            );
        }
        let stream = ws.root.join("src").join("main.rs:hidden");
        assert_eq!(
            resolve_in_roots(&stream, &roots(&ws)).unwrap_err(),
            SandboxError::InvalidName
        );
        // Lookalikes that are ordinary names stay allowed.
        assert!(resolve_in_roots(&ws.root.join("console.txt"), &roots(&ws)).is_ok());
        assert!(resolve_in_roots(&ws.root.join("COM10"), &roots(&ws)).is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn windows_case_fold_keeps_kelvin_sign_distinct() {
        assert_ne!(fold_case("\u{212A}"), fold_case("k"));
        assert_eq!(fold_case("Straße"), "STRAßE");
    }

    /// Creates a directory junction (no admin rights needed on Windows).
    #[cfg(windows)]
    fn link_dir(target: &Path, link: &Path) -> bool {
        std::process::Command::new("cmd")
            .args(["/C", "mklink", "/J"])
            .arg(link)
            .arg(target)
            .output()
            .map(|out| out.status.success())
            .unwrap_or(false)
    }

    #[cfg(unix)]
    fn link_dir(target: &Path, link: &Path) -> bool {
        std::os::unix::fs::symlink(target, link).is_ok()
    }

    #[test]
    fn rejects_junction_or_symlink_pointing_outside() {
        let ws = workspace();
        let link = ws.root.join("escape");
        assert!(link_dir(&ws.outside, &link), "could not create link");
        let r = roots(&ws);
        assert_eq!(
            resolve_in_roots(&link.join("secret.txt"), &r).unwrap_err(),
            SandboxError::OutsideWorkspace
        );
        // Also for files that do not exist yet behind the link.
        assert_eq!(
            resolve_in_roots(&link.join("new.txt"), &r).unwrap_err(),
            SandboxError::OutsideWorkspace
        );
    }

    #[test]
    fn accepts_link_inside_root_pointing_inside_root() {
        let ws = workspace();
        let link = ws.root.join("alias");
        assert!(
            link_dir(&ws.root.join("src"), &link),
            "could not create link"
        );
        let resolved = resolve_in_roots(&link.join("main.rs"), &roots(&ws)).unwrap();
        assert_eq!(resolved, ws.root.join("src").join("main.rs"));
    }

    #[test]
    fn rejects_dangling_link() {
        let ws = workspace();
        let target = ws.outside.join("later");
        fs::create_dir_all(&target).unwrap();
        let link = ws.root.join("dangling");
        assert!(link_dir(&target, &link), "could not create link");
        fs::remove_dir(&target).unwrap();
        let err = resolve_in_roots(&link.join("x.txt"), &roots(&ws)).unwrap_err();
        assert!(matches!(err, SandboxError::Unresolvable(_)), "{err:?}");
        let err = resolve_in_roots(&link, &roots(&ws)).unwrap_err();
        assert!(matches!(err, SandboxError::Unresolvable(_)), "{err:?}");
    }

    #[test]
    fn slice_lines_applies_line_and_limit() {
        let text = "a\nb\r\nc\nd";
        assert_eq!(slice_lines(text, None, None), text);
        assert_eq!(slice_lines(text, Some(2), None), "b\r\nc\nd");
        assert_eq!(slice_lines(text, Some(2), Some(2)), "b\r\nc\n");
        assert_eq!(slice_lines(text, None, Some(1)), "a\n");
        assert_eq!(slice_lines(text, Some(0), Some(1)), "a\n");
        assert_eq!(slice_lines(text, Some(9), None), "");
        assert_eq!(slice_lines(text, Some(4), Some(5)), "d");
    }

    #[test]
    fn read_text_errors_are_classified() {
        let ws = workspace();
        let missing = read_text(&ws.root.join("nope.txt"), None, None).unwrap_err();
        assert_eq!(missing.rpc_code(), RESOURCE_NOT_FOUND);
        let binary = ws.root.join("bin.dat");
        fs::write(&binary, [0xff, 0xfe, 0x00]).unwrap();
        assert!(matches!(
            read_text(&binary, None, None).unwrap_err(),
            FsBridgeError::NotUtf8
        ));
    }

    #[test]
    fn atomic_write_creates_parents_and_replaces() {
        let ws = workspace();
        let r = roots(&ws);
        let file = resolve_in_roots(&ws.root.join("a").join("b.txt"), &r).unwrap();
        write_text_atomic(&file, "one", &r).unwrap();
        write_text_atomic(&file, "two", &r).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "two");
        let leftovers: Vec<_> = fs::read_dir(file.parent().unwrap())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(leftovers, vec![std::ffi::OsString::from("b.txt")]);
    }

    #[test]
    fn atomic_write_refuses_oversized_content() {
        let ws = workspace();
        let r = roots(&ws);
        let big = "x".repeat(MAX_TEXT_FILE_BYTES as usize + 1);
        let err = write_text_atomic(&ws.root.join("big.txt"), &big, &r).unwrap_err();
        assert!(matches!(err, FsBridgeError::TooLarge));
        assert!(!ws.root.join("big.txt").exists());
    }
}

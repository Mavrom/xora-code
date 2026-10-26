pub mod commands;
pub mod watch;

use serde::Serialize;
use std::io;
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime};

/// Entries hidden from directory listings.
const HIDDEN: &[&str] = &[".git"];

/// Files above this size are refused instead of freezing the editor.
pub const MAX_READ_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// Stable machine-readable code for the error kinds the UI explains in its own words.
pub fn error_code(kind: io::ErrorKind) -> Option<&'static str> {
    match kind {
        io::ErrorKind::NotFound => Some("not_found"),
        io::ErrorKind::PermissionDenied => Some("permission_denied"),
        // `read_to_string` on a non UTF-8 file.
        io::ErrorKind::InvalidData => Some("binary"),
        io::ErrorKind::FileTooLarge => Some("too_large"),
        io::ErrorKind::IsADirectory => Some("is_dir"),
        _ => None,
    }
}

/// Prefixes the message with `[code] ` (when the kind has one), keeping the OS text after it.
pub fn coded(err: io::Error) -> io::Error {
    match error_code(err.kind()) {
        Some(code) => io::Error::new(err.kind(), format!("[{code}] {err}")),
        None => err,
    }
}

pub fn list_dir(path: &Path) -> io::Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if HIDDEN.contains(&name.as_str()) {
            continue;
        }
        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().into_owned(),
            is_dir: entry.file_type()?.is_dir(),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

pub fn read_file(path: &Path) -> io::Result<String> {
    let meta = std::fs::metadata(path)?;
    if meta.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::IsADirectory,
            "is a directory",
        ));
    }
    if meta.len() > MAX_READ_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::FileTooLarge,
            format!("file is {} bytes", meta.len()),
        ));
    }
    std::fs::read_to_string(path)
}

pub fn write_file(path: &Path, contents: &str) -> io::Result<()> {
    std::fs::write(path, contents)
}

/// Brings the main window to the front (used when a second instance is launched).
pub fn focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    // Each step is best effort; a failure must never crash the running instance.
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as stdfs;

    #[test]
    fn list_dir_puts_dirs_first_sorted_case_insensitive_and_hides_git() {
        let dir = tempfile::tempdir().unwrap();
        stdfs::create_dir(dir.path().join("src")).unwrap();
        stdfs::create_dir(dir.path().join(".git")).unwrap();
        stdfs::write(dir.path().join("b.txt"), "").unwrap();
        stdfs::write(dir.path().join("A.md"), "").unwrap();

        let entries = list_dir(dir.path()).unwrap();
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();

        assert_eq!(names, vec!["src", "A.md", "b.txt"]);
        assert!(entries[0].is_dir);
        assert!(!entries[1].is_dir);
        assert_eq!(entries[0].path, dir.path().join("src").to_string_lossy());
    }

    #[test]
    fn write_then_read_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("hello.ts");

        write_file(&file, "export const x = 1;\n").unwrap();

        assert_eq!(read_file(&file).unwrap(), "export const x = 1;\n");
    }

    #[test]
    fn read_missing_file_errors() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read_file(&dir.path().join("nope.txt")).is_err());
    }

    #[test]
    fn missing_file_error_is_coded() {
        let dir = tempfile::tempdir().unwrap();
        let err = coded(read_file(&dir.path().join("nope.txt")).unwrap_err());
        assert!(err.to_string().starts_with("[not_found] "), "{err}");
    }

    #[test]
    fn non_utf8_file_is_reported_as_binary() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("image.bin");
        stdfs::write(&file, [0xff, 0xfe, 0x00, 0x9f]).unwrap();
        let err = coded(read_file(&file).unwrap_err());
        assert!(err.to_string().starts_with("[binary] "), "{err}");
    }

    #[test]
    fn reading_a_directory_is_refused_with_a_code() {
        let dir = tempfile::tempdir().unwrap();
        let err = coded(read_file(dir.path()).unwrap_err());
        assert!(err.to_string().starts_with("[is_dir] "), "{err}");
    }

    #[test]
    fn uncoded_kinds_keep_their_message() {
        let err = coded(io::Error::other("boom"));
        assert_eq!(err.to_string(), "boom");
        assert_eq!(
            error_code(io::ErrorKind::PermissionDenied),
            Some("permission_denied")
        );
        assert_eq!(error_code(io::ErrorKind::FileTooLarge), Some("too_large"));
    }

    #[test]
    fn serializes_is_dir_as_camel_case() {
        let e = DirEntry {
            name: "a".into(),
            path: "p".into(),
            is_dir: true,
        };
        let json = serde_json::to_string(&e).unwrap();
        assert_eq!(json, r#"{"name":"a","path":"p","isDir":true}"#);
    }
}

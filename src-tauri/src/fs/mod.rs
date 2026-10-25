// Temporary: removed once the fs commands consume this module.
#![cfg_attr(not(test), expect(dead_code))]

pub mod commands;

use serde::Serialize;
use std::io;
use std::path::Path;

/// Entries hidden from directory listings.
const HIDDEN: &[&str] = &[".git"];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
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
    std::fs::read_to_string(path)
}

pub fn write_file(path: &Path, contents: &str) -> io::Result<()> {
    std::fs::write(path, contents)
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

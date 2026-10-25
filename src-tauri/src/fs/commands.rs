use super::DirEntry;
use crate::error::AppResult;
use std::path::PathBuf;

// Commands are async so file IO never blocks the main (UI) thread.

#[tauri::command]
pub async fn fs_list_dir(path: String) -> AppResult<Vec<DirEntry>> {
    Ok(super::list_dir(&PathBuf::from(path))?)
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> AppResult<String> {
    Ok(super::read_file(&PathBuf::from(path))?)
}

#[tauri::command]
pub async fn fs_write_file(path: String, contents: String) -> AppResult<()> {
    Ok(super::write_file(&PathBuf::from(path), &contents)?)
}

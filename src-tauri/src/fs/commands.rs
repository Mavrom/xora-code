use super::DirEntry;
use super::watch::WatchState;
use crate::error::AppResult;
use std::path::PathBuf;
use tauri::{AppHandle, State};

// Commands are async so file IO never blocks the main (UI) thread. Errors carry a
// `[code]` prefix (see `super::coded`) so the frontend can show a human message.

#[tauri::command]
pub async fn fs_list_dir(path: String) -> AppResult<Vec<DirEntry>> {
    Ok(super::list_dir(&PathBuf::from(path)).map_err(super::coded)?)
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> AppResult<String> {
    Ok(super::read_file(&PathBuf::from(path)).map_err(super::coded)?)
}

/// Largest file sent to the chat as raw bytes (an attached image).
const MAX_BYTES: u64 = 20 * 1024 * 1024;

/// A file's raw bytes (an ArrayBuffer on the JS side), for images attached to a message.
#[tauri::command]
pub async fn fs_read_bytes(path: String) -> AppResult<tauri::ipc::Response> {
    let path = PathBuf::from(path);
    let size = std::fs::metadata(&path).map_err(super::coded)?.len();
    if size > MAX_BYTES {
        return Err(std::io::Error::other(format!(
            "[too_large] {} MB is over the {} MB limit",
            size / (1024 * 1024),
            MAX_BYTES / (1024 * 1024)
        ))
        .into());
    }
    let bytes = std::fs::read(&path).map_err(super::coded)?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub async fn fs_write_file(path: String, contents: String) -> AppResult<()> {
    Ok(super::write_file(&PathBuf::from(path), &contents).map_err(super::coded)?)
}

/// Watches `root` recursively (replacing any previous watch) and emits `fs://changed`.
#[tauri::command]
pub async fn fs_watch(app: AppHandle, state: State<'_, WatchState>, root: String) -> AppResult<()> {
    state
        .watch(app, PathBuf::from(root))
        .map_err(|e| std::io::Error::other(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn fs_unwatch(state: State<'_, WatchState>) -> AppResult<()> {
    state.unwatch();
    Ok(())
}

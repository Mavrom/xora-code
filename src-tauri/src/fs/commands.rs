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

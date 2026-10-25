use super::Note;
use crate::error::AppResult;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};
use tauri::{AppHandle, Manager, State};

const NOTES_FILE: &str = "notes.json";

/// Serializes access to the notes file so concurrent saves never interleave.
/// The `Arc` lets the guard be taken inside the blocking task, which must be
/// `'static` and therefore cannot borrow from `State`.
#[derive(Default)]
pub struct NotesLock(Arc<Mutex<()>>);

fn notes_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join(NOTES_FILE))
}

/// Runs `op` on the blocking pool while holding the notes lock, keeping the
/// async runtime free during disk IO and `sync_all`. The lock guards no data,
/// so a poisoned lock is safe to reuse.
async fn with_lock<T: Send + 'static>(
    lock: &NotesLock,
    op: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    let lock = Arc::clone(&lock.0);
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
        op()
    })
    .await?
}

#[tauri::command]
pub async fn notes_list(app: AppHandle, state: State<'_, NotesLock>) -> AppResult<Vec<Note>> {
    let path = notes_path(&app)?;
    with_lock(&state, move || Ok(super::load(&path)?)).await
}

/// Replaces the whole stored list; the frontend owns the inbox state.
#[tauri::command]
pub async fn notes_save(
    app: AppHandle,
    state: State<'_, NotesLock>,
    notes: Vec<Note>,
) -> AppResult<()> {
    let path = notes_path(&app)?;
    with_lock(&state, move || Ok(super::save(&path, &notes)?)).await
}

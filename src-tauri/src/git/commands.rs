use super::Worktree;
use crate::error::AppResult;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// Git runs as a child process; the blocking work goes to a worker thread so the UI
// thread never waits on it.

async fn blocking<T: Send + 'static>(
    job: impl FnOnce() -> Result<T, super::GitError> + Send + 'static,
) -> AppResult<T> {
    Ok(tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|e| std::io::Error::other(e.to_string()))??)
}

/// Where new worktrees go: `<app data>/worktrees/<repo>/<name>`.
fn base_dir(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join("worktrees"))
}

#[tauri::command]
pub async fn git_worktrees(repo: PathBuf) -> AppResult<Vec<Worktree>> {
    blocking(move || super::list(&repo)).await
}

#[tauri::command]
pub async fn git_worktree_create(
    app: AppHandle,
    repo: PathBuf,
    name: String,
) -> AppResult<Worktree> {
    let base = base_dir(&app)?;
    blocking(move || super::create(&repo, &base, &name)).await
}

#[tauri::command]
pub async fn git_worktree_merge(
    repo: PathBuf,
    path: PathBuf,
    message: String,
) -> AppResult<String> {
    blocking(move || super::merge(&repo, &path, &message)).await
}

#[tauri::command]
pub async fn git_worktree_remove(repo: PathBuf, path: PathBuf, force: bool) -> AppResult<()> {
    blocking(move || super::remove(&repo, &path, force)).await
}

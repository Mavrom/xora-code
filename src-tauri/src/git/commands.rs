use super::Worktree;
use super::changes::Diff;
use super::status::Status;
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

#[tauri::command]
pub async fn git_status(dir: PathBuf) -> AppResult<Status> {
    blocking(move || super::status::status(&dir)).await
}

#[tauri::command]
pub async fn git_stage(dir: PathBuf, paths: Vec<String>) -> AppResult<()> {
    blocking(move || super::changes::stage(&dir, &paths)).await
}

#[tauri::command]
pub async fn git_unstage(dir: PathBuf, paths: Vec<String>) -> AppResult<()> {
    blocking(move || super::changes::unstage(&dir, &paths)).await
}

#[tauri::command]
pub async fn git_discard(dir: PathBuf, paths: Vec<String>) -> AppResult<()> {
    blocking(move || super::changes::discard(&dir, &paths)).await
}

#[tauri::command]
pub async fn git_diff(dir: PathBuf, path: String, staged: bool) -> AppResult<Diff> {
    blocking(move || super::changes::diff(&dir, &path, staged)).await
}

#[tauri::command]
pub async fn git_commit(dir: PathBuf, message: String) -> AppResult<String> {
    blocking(move || super::changes::commit(&dir, &message)).await
}

#[tauri::command]
pub async fn git_push(dir: PathBuf) -> AppResult<()> {
    blocking(move || super::changes::push(&dir)).await
}

#[tauri::command]
pub async fn git_pull(dir: PathBuf) -> AppResult<()> {
    blocking(move || super::changes::pull(&dir)).await
}

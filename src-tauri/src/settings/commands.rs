use super::{Settings, wallpaper};
use crate::error::AppResult;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, PoisonError};
use tauri::{AppHandle, Manager, State};

const SETTINGS_FILE: &str = "settings.json";

/// Serializes read-modify-write cycles on the settings file so two quick
/// patches never lose each other's changes.
#[derive(Default)]
pub struct SettingsLock(Arc<Mutex<()>>);

fn settings_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join(SETTINGS_FILE))
}

fn wallpaper_dir(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join(wallpaper::WALLPAPER_DIR))
}

/// Runs `op` on the blocking pool while holding the settings lock.
async fn with_lock<T: Send + 'static>(
    lock: &SettingsLock,
    op: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    let lock = Arc::clone(&lock.0);
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().unwrap_or_else(PoisonError::into_inner);
        op()
    })
    .await?
}

/// Current settings for other Rust modules (e.g. agents reading
/// `agent.claudeIgnoreApiKey` at spawn time). Defaults if the file is unreadable.
#[allow(dead_code)] // first callers arrive with the agents module (phase 2)
pub async fn read(app: &AppHandle) -> Settings {
    let Ok(path) = settings_path(app) else {
        return Settings::default();
    };
    let lock = app.state::<SettingsLock>();
    with_lock(&lock, move || Ok(super::load(&path)?))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn settings_get(app: AppHandle, state: State<'_, SettingsLock>) -> AppResult<Settings> {
    let path = settings_path(&app)?;
    with_lock(&state, move || Ok(super::load(&path)?)).await
}

/// Deep-merges `patch` into the stored settings, saves atomically and returns
/// the sanitized result (invalid values in the patch are ignored).
#[tauri::command]
pub async fn settings_update(
    app: AppHandle,
    state: State<'_, SettingsLock>,
    patch: Value,
) -> AppResult<Settings> {
    let path = settings_path(&app)?;
    with_lock(&state, move || {
        let current = super::load(&path)?;
        let next = super::apply_patch(&current, &patch)?;
        if next != current {
            super::save(&path, &next)?;
        }
        Ok(next)
    })
    .await
}

/// Copies the chosen picture into the wallpapers folder (replacing the previous
/// one) and returns the copy's absolute path for `appearance.wallpaper`.
#[tauri::command]
pub async fn settings_wallpaper_import(app: AppHandle, source: String) -> AppResult<String> {
    let dir = wallpaper_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let dest = wallpaper::import(&dir, std::path::Path::new(&source))?;
        Ok(dest.to_string_lossy().into_owned())
    })
    .await?
}

/// Deletes the stored wallpaper files. The frontend clears `appearance.wallpaper`.
#[tauri::command]
pub async fn settings_wallpaper_remove(app: AppHandle) -> AppResult<()> {
    let dir = wallpaper_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || Ok(wallpaper::clear(&dir, None)?)).await?
}

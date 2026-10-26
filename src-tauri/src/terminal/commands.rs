use super::{TerminalError, TerminalManager, configured_shell, home_dir, resolve_cwd};
use std::path::PathBuf;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{Manager, State};

type TermResult<T> = Result<T, TerminalError>;

/// What the frontend learns about a new session.
#[derive(serde::Serialize)]
pub struct SpawnInfo {
    id: u32,
    /// Display name of the shell, e.g. `pwsh` or `zsh`.
    shell: String,
}

/// Starts a shell in a new PTY and returns the session id and shell name. `shell` is the
/// Settings > Terminal choice (`auto` when absent).
///
/// `on_data` streams raw output bytes (an `ArrayBuffer` in JS); `on_exit` fires once with
/// the exit code (`null` if unknown) after the last output chunk. `cwd` falls back to home.
/// Async so spawning never blocks the main thread.
#[tauri::command]
pub async fn term_spawn(
    state: State<'_, TerminalManager>,
    cols: u16,
    rows: u16,
    cwd: Option<String>,
    shell: Option<String>,
    on_data: Channel<InvokeResponseBody>,
    on_exit: Channel<Option<u32>>,
) -> TermResult<SpawnInfo> {
    let shell = configured_shell(shell.as_deref().unwrap_or("auto"));
    let cwd = resolve_cwd(cwd.map(PathBuf::from).as_deref(), home_dir());
    let id = state.spawn(
        &shell,
        cwd.as_deref(),
        cols,
        rows,
        move |chunk| {
            // The webview may be gone during shutdown; nothing left to tell.
            let _ = on_data.send(InvokeResponseBody::Raw(chunk));
        },
        move |code| {
            let _ = on_exit.send(code);
        },
    )?;
    Ok(SpawnInfo {
        id,
        shell: shell.display_name(),
    })
}

#[tauri::command]
pub async fn term_write(
    state: State<'_, TerminalManager>,
    id: u32,
    data: String,
) -> TermResult<()> {
    state.write(id, data.as_bytes())
}

#[tauri::command]
pub async fn term_resize(
    state: State<'_, TerminalManager>,
    id: u32,
    cols: u16,
    rows: u16,
) -> TermResult<()> {
    state.resize(id, cols, rows)
}

#[tauri::command]
pub async fn term_kill(state: State<'_, TerminalManager>, id: u32) -> TermResult<()> {
    state.kill(id);
    Ok(())
}

/// No shell outlives the window: kill every session once it is destroyed. The frontend
/// close guard kills its sessions earlier; this is the backstop if the page could not.
pub fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::Destroyed = event {
        window.state::<TerminalManager>().kill_all();
    }
}

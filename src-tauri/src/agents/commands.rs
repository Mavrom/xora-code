//! Tauri commands for the agent core (design doc 5.2). Thin wrappers around
//! `AgentManager`; errors cross IPC as strings (`auth_required:` prefix for -32000).

use super::acp::RevertOutcome;
use super::events::{AgentEvent, AgentId, SessionSetup};
use super::index::SessionEntry;
use super::manager::{AgentError, AgentInfo, AgentManager, LaunchPrefs};
use serde_json::Value;
use std::path::PathBuf;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};

type CmdResult<T> = Result<T, String>;

fn ipc(err: AgentError) -> String {
    err.ipc_message()
}

async fn prefs(app: &AppHandle) -> LaunchPrefs {
    let settings = crate::settings::commands::read(app).await;
    LaunchPrefs {
        claude_ignore_api_key: settings.agent.claude_ignore_api_key,
        debug_logs: settings.agent.debug_logs,
    }
}

fn home_dir(app: &AppHandle) -> PathBuf {
    app.path().home_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Configures paths once; safe to call repeatedly.
fn configure(app: &AppHandle, manager: &AgentManager) {
    if let Ok(dir) = app.path().app_data_dir() {
        manager.configure(&dir);
    }
}

#[tauri::command]
pub async fn agents_subscribe(
    app: AppHandle,
    manager: State<'_, AgentManager>,
    on_event: Channel<AgentEvent>,
) -> CmdResult<()> {
    configure(&app, &manager);
    manager.subscribe(move |event| {
        let _ = on_event.send(event);
    });
    Ok(())
}

#[tauri::command]
pub async fn agents_list(app: AppHandle, manager: State<'_, AgentManager>) -> CmdResult<Vec<AgentInfo>> {
    configure(&app, &manager);
    Ok(manager.list().await)
}

#[tauri::command]
pub async fn agent_install(app: AppHandle, manager: State<'_, AgentManager>, agent_id: AgentId) -> CmdResult<()> {
    configure(&app, &manager);
    manager.install(agent_id).map_err(ipc)
}

#[tauri::command]
pub async fn agent_authenticate(
    app: AppHandle,
    manager: State<'_, AgentManager>,
    agent_id: AgentId,
    method_id: String,
) -> CmdResult<()> {
    configure(&app, &manager);
    let prefs = prefs(&app).await;
    manager.authenticate(agent_id, &method_id, home_dir(&app), prefs).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_auth_terminal(
    app: AppHandle,
    manager: State<'_, AgentManager>,
    agent_id: AgentId,
    method_id: String,
) -> CmdResult<()> {
    configure(&app, &manager);
    let prefs = prefs(&app).await;
    manager.auth_terminal(agent_id, &method_id, home_dir(&app), prefs).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_session_new(
    app: AppHandle,
    manager: State<'_, AgentManager>,
    agent_id: AgentId,
    cwd: PathBuf,
) -> CmdResult<SessionSetup> {
    configure(&app, &manager);
    let prefs = prefs(&app).await;
    manager.session_new(agent_id, cwd, prefs).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_session_load(
    app: AppHandle,
    manager: State<'_, AgentManager>,
    agent_id: AgentId,
    session_id: String,
    cwd: PathBuf,
) -> CmdResult<SessionSetup> {
    configure(&app, &manager);
    let prefs = prefs(&app).await;
    manager.session_open(agent_id, session_id, cwd, false, prefs).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_session_resume(
    app: AppHandle,
    manager: State<'_, AgentManager>,
    agent_id: AgentId,
    session_id: String,
    cwd: PathBuf,
) -> CmdResult<SessionSetup> {
    configure(&app, &manager);
    let prefs = prefs(&app).await;
    manager.session_open(agent_id, session_id, cwd, true, prefs).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_session_close(manager: State<'_, AgentManager>, session_id: String) -> CmdResult<()> {
    manager.session_close(&session_id).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_sessions_list(
    app: AppHandle,
    manager: State<'_, AgentManager>,
    agent_id: AgentId,
    cwd: PathBuf,
) -> CmdResult<Vec<SessionEntry>> {
    configure(&app, &manager);
    Ok(manager.sessions_list(agent_id, cwd).await)
}

#[tauri::command]
pub async fn agent_prompt(manager: State<'_, AgentManager>, session_id: String, blocks: Value) -> CmdResult<()> {
    manager.prompt(session_id, blocks).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_cancel(manager: State<'_, AgentManager>, session_id: String) -> CmdResult<()> {
    manager.cancel(&session_id).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_set_config_option(
    manager: State<'_, AgentManager>,
    session_id: String,
    config_id: String,
    value: Value,
) -> CmdResult<Value> {
    manager.set_config_option(&session_id, &config_id, value).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_set_mode(manager: State<'_, AgentManager>, session_id: String, mode_id: String) -> CmdResult<()> {
    manager.set_mode(&session_id, &mode_id).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_set_model(manager: State<'_, AgentManager>, session_id: String, model_id: String) -> CmdResult<()> {
    manager.set_model(&session_id, &model_id).await.map_err(ipc)
}

#[tauri::command]
pub async fn agent_permission_respond(
    manager: State<'_, AgentManager>,
    request_id: String,
    option_id: Option<String>,
) -> CmdResult<()> {
    manager.permission_respond(&request_id, option_id);
    Ok(())
}

#[tauri::command]
pub async fn agent_review_revert(
    manager: State<'_, AgentManager>,
    session_id: String,
    path: String,
) -> CmdResult<RevertOutcome> {
    manager.review_revert(&session_id, &path).await.map_err(ipc)
}

#[tauri::command]
pub async fn agents_shutdown(manager: State<'_, AgentManager>) -> CmdResult<()> {
    manager.shutdown().await;
    Ok(())
}

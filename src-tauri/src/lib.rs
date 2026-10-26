mod accounts;
mod agents;
mod error;
mod fs;
mod notes;
mod settings;
mod system;
mod terminal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be the first plugin: a second launch only focuses the running window, so
        // two instances never share (and clobber) notes.json or the WebView2 profile.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            fs::focus_main_window(app)
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(notes::commands::NotesLock::default())
        .manage(fs::watch::WatchState::default())
        .manage(terminal::TerminalManager::default())
        .on_window_event(terminal::commands::on_window_event)
        .manage(settings::commands::SettingsLock::default())
        .manage(agents::AgentManager::default())
        .invoke_handler(tauri::generate_handler![
            fs::commands::fs_list_dir,
            fs::commands::fs_read_file,
            fs::commands::fs_write_file,
            fs::commands::fs_watch,
            fs::commands::fs_unwatch,
            notes::commands::notes_list,
            notes::commands::notes_save,
            terminal::commands::term_spawn,
            terminal::commands::term_write,
            terminal::commands::term_resize,
            terminal::commands::term_kill,
            settings::commands::settings_get,
            settings::commands::settings_update,
            settings::commands::settings_wallpaper_import,
            settings::commands::settings_wallpaper_remove,
            accounts::commands::accounts_detect,
            accounts::commands::accounts_login,
            agents::commands::agents_subscribe,
            agents::commands::agents_list,
            agents::commands::agent_install,
            agents::commands::agent_authenticate,
            agents::commands::agent_auth_terminal,
            agents::commands::agent_session_new,
            agents::commands::agent_session_load,
            agents::commands::agent_session_resume,
            agents::commands::agent_session_close,
            agents::commands::agent_sessions_list,
            agents::commands::agent_session_archive,
            agents::commands::agent_session_delete,
            agents::commands::agent_prompt,
            agents::commands::agent_cancel,
            agents::commands::agent_set_config_option,
            agents::commands::agent_set_mode,
            agents::commands::agent_set_model,
            agents::commands::agent_permission_respond,
            agents::commands::agent_review_revert,
            agents::commands::agent_review_changes,
            agents::commands::agent_review_accept,
            agents::commands::agents_shutdown,
            system::system_hostname,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

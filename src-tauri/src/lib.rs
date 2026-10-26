mod error;
mod fs;
mod notes;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

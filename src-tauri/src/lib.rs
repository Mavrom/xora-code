mod error;
mod fs;
mod notes;
mod terminal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(notes::commands::NotesLock::default())
        .manage(terminal::TerminalManager::default())
        .on_window_event(terminal::commands::on_window_event)
        .invoke_handler(tauri::generate_handler![
            fs::commands::fs_list_dir,
            fs::commands::fs_read_file,
            fs::commands::fs_write_file,
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

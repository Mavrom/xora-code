mod agents;
mod error;
mod fs;
mod notes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(notes::commands::NotesLock::default())
        .invoke_handler(tauri::generate_handler![
            fs::commands::fs_list_dir,
            fs::commands::fs_read_file,
            fs::commands::fs_write_file,
            notes::commands::notes_list,
            notes::commands::notes_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

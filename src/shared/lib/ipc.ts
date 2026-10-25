import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

/** An Inbox note, mirroring `notes::Note` in Rust. Timestamps are epoch milliseconds. */
export interface Note {
  id: string;
  text: string;
  pinned: boolean;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Typed wrappers around the Rust commands. Keep names in sync with the `commands.rs` modules under `src-tauri/src`. */
export const ipc = {
  listDir: (path: string) => invoke<DirEntry[]>("fs_list_dir", { path }),
  readFile: (path: string) => invoke<string>("fs_read_file", { path }),
  writeFile: (path: string, contents: string) => invoke<void>("fs_write_file", { path, contents }),
  notesList: () => invoke<Note[]>("notes_list"),
  /** Replaces the whole stored list (atomic on disk). */
  notesSave: (notes: Note[]) => invoke<void>("notes_save", { notes }),
};

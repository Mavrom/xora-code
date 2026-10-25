import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

/** Typed wrappers around the Rust commands. Keep names in sync with the `commands.rs` modules under `src-tauri/src`. */
export const ipc = {
  listDir: (path: string) => invoke<DirEntry[]>("fs_list_dir", { path }),
  readFile: (path: string) => invoke<string>("fs_read_file", { path }),
  writeFile: (path: string, contents: string) => invoke<void>("fs_write_file", { path, contents }),
};

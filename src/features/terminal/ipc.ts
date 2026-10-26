import { invoke, type Channel } from "@tauri-apps/api/core";

/** Mirrors `terminal::commands::SpawnInfo` in Rust. */
export interface SpawnInfo {
  id: number;
  /** Shell display name, e.g. `pwsh`. */
  shell: string;
}

/** Raw output arrives as an `ArrayBuffer`; tolerate a plain byte array as well. */
export type OutputMessage = ArrayBuffer | number[];

export const toBytes = (message: OutputMessage) =>
  message instanceof ArrayBuffer ? new Uint8Array(message) : Uint8Array.from(message);

/** Typed wrappers around `src-tauri/src/terminal/commands.rs`. */
export const terminalIpc = {
  spawn: (
    cols: number,
    rows: number,
    cwd: string | null,
    onData: Channel<OutputMessage>,
    onExit: Channel<number | null>,
    /** Settings > Terminal > Kabuk; the backend falls back to `auto` if it is missing. */
    shell: string = "auto",
  ) => invoke<SpawnInfo>("term_spawn", { cols, rows, cwd, shell, onData, onExit }),
  write: (id: number, data: string) => invoke<void>("term_write", { id, data }),
  resize: (id: number, cols: number, rows: number) =>
    invoke<void>("term_resize", { id, cols, rows }),
  kill: (id: number) => invoke<void>("term_kill", { id }),
};

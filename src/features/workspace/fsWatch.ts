import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { samePath } from "./recents";

/** Payload of the Rust `fs://changed` event (see `src-tauri/src/fs/watch.rs`). */
export interface FsChange {
  root: string;
  /** Changed files and folders (absolute). Empty when `full` is set. */
  paths: string[];
  /** Too much changed (or events were lost): refresh everything that is shown. */
  full: boolean;
}

type Listener = (change: FsChange) => void;

const listeners = new Set<Listener>();

/** Subscribes to file system changes under the open root; returns the unsubscribe function. */
export function onFsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dispatch(change: FsChange) {
  for (const listener of [...listeners]) {
    try {
      listener(change);
    } catch (err) {
      console.error("fs change listener failed", err);
    }
  }
}

let watchedRoot: string | null = null;

/** Treats everything under `root` as changed (the "Yenile" button, re-picking the folder). */
export function requestRefresh(root = watchedRoot) {
  if (root) dispatch({ root, paths: [], full: true });
}

/** Reports specific paths as changed, e.g. a file that turned out to be gone on open. */
export function reportChanged(paths: string[]) {
  if (watchedRoot && paths.length) dispatch({ root: watchedRoot, paths, full: false });
}

let unlistenPromise: Promise<() => void> | null = null;

function ensureListening() {
  if (unlistenPromise || !isTauri()) return;
  unlistenPromise = listen<FsChange>("fs://changed", ({ payload }) => {
    // A late batch from the previous folder must not touch the new one.
    if (watchedRoot && samePath(payload.root, watchedRoot)) dispatch(payload);
  });
  unlistenPromise.catch((err: unknown) => {
    unlistenPromise = null;
    console.error("cannot listen for file changes", err);
  });
}

/** Starts watching `root` (replacing the previous watch), or stops with `null`. */
export async function watchRoot(root: string | null): Promise<void> {
  watchedRoot = root;
  if (!isTauri()) return;
  ensureListening();
  try {
    if (root) await invoke("fs_watch", { root });
    else await invoke("fs_unwatch");
  } catch (err) {
    // Without a watcher the tree still works; the "Yenile" button covers changes.
    console.error("cannot watch folder", err);
  }
}

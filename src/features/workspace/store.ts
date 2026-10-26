import { create } from "zustand";
import {
  addFolder,
  parseFolders,
  parseRecents,
  pushRecent,
  removeRecent,
  samePath,
} from "./recents";

const RECENTS_KEY = "xora.workspace.recent";
const FOLDERS_KEY = "xora.workspace.folders";

// localStorage can be missing or throw (private mode, tests); fall back quietly.
function readRecents(): string[] {
  try {
    return parseRecents(localStorage.getItem(RECENTS_KEY));
  } catch {
    return [];
  }
}

function readFolders(): string[] {
  try {
    return parseFolders(localStorage.getItem(FOLDERS_KEY));
  } catch {
    return [];
  }
}

function write(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Not persisted; the in-memory list still works.
  }
}

interface WorkspaceState {
  root: string | null;
  /** Recently opened folders, newest first; `recents[0]` is the folder to reopen. */
  recents: string[];
  /** Folders open side by side as tabs over the tree, in the order they were added. */
  folders: string[];
  /** Opens `root` (adding its tab) and records it as the most recent folder. */
  setRoot: (root: string) => void;
  /** Closes a folder tab; closing the open one moves to its neighbour, or to none. */
  closeFolder: (path: string) => void;
  /** Drops a folder from the recent list (e.g. it no longer exists). */
  forgetRecent: (path: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  recents: readRecents(),
  folders: readFolders(),

  setRoot: (root) => {
    const recents = pushRecent(get().recents, root);
    const folders = addFolder(get().folders, root);
    write(RECENTS_KEY, recents);
    write(FOLDERS_KEY, folders);
    // Re-picking the open folder keeps the tree as it is (no remount).
    const current = get().root;
    set({ root: current && samePath(current, root) ? current : root, recents, folders });
  },

  closeFolder: (path) => {
    const { folders, root, setRoot } = get();
    const index = folders.findIndex((p) => samePath(p, path));
    if (index === -1) return;
    const rest = removeRecent(folders, path);
    write(FOLDERS_KEY, rest);
    set({ folders: rest });
    if (root && samePath(root, path)) {
      const next = rest[Math.min(index, rest.length - 1)];
      if (next) setRoot(next);
      else set({ root: null });
    }
  },

  forgetRecent: (path) => {
    const recents = removeRecent(get().recents, path);
    write(RECENTS_KEY, recents);
    set({ recents });
  },
}));

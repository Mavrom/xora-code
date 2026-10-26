import { create } from "zustand";
import { parseRecents, pushRecent, removeRecent, samePath } from "./recents";

const RECENTS_KEY = "xora.workspace.recent";

// localStorage can be missing or throw (private mode, tests); fall back quietly.
function readRecents(): string[] {
  try {
    return parseRecents(localStorage.getItem(RECENTS_KEY));
  } catch {
    return [];
  }
}

function writeRecents(recents: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  } catch {
    // Not persisted; the in-memory list still works.
  }
}

interface WorkspaceState {
  root: string | null;
  /** Recently opened folders, newest first; `recents[0]` is the folder to reopen. */
  recents: string[];
  /** Opens `root` and records it as the most recent folder. */
  setRoot: (root: string) => void;
  /** Drops a folder from the recent list (e.g. it no longer exists). */
  forgetRecent: (path: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  root: null,
  recents: readRecents(),

  setRoot: (root) => {
    const recents = pushRecent(get().recents, root);
    writeRecents(recents);
    // Re-picking the open folder keeps the tree as it is (no remount).
    const current = get().root;
    set({ root: current && samePath(current, root) ? current : root, recents });
  },

  forgetRecent: (path) => {
    const recents = removeRecent(get().recents, path);
    writeRecents(recents);
    set({ recents });
  },
}));

import { create } from "zustand";

export type SidebarView = "sessions" | "inbox";

const VIEWS: readonly SidebarView[] = ["sessions", "inbox"];

const STORAGE_KEY = "xora.sidebarView";
const FILES_KEY = "xora.filesOpen";

// localStorage can be missing or throw (private mode, tests); fall back quietly.
function readView(): SidebarView {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VIEWS.find((v) => v === stored) ?? "sessions";
  } catch {
    return "sessions";
  }
}

function readFiles(): boolean {
  try {
    return localStorage.getItem(FILES_KEY) === "1";
  } catch {
    return false;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted; the in-memory state still works.
  }
}

interface UiState {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
  /** The file tree column on the right of the main area. */
  filesOpen: boolean;
  setFilesOpen: (open: boolean) => void;
  /** Project folder the sessions list is narrowed to; null shows every project. */
  projectFilter: string | null;
  setProjectFilter: (cwd: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarView: readView(),
  setSidebarView: (view) => {
    set({ sidebarView: view });
    write(STORAGE_KEY, view);
  },
  filesOpen: readFiles(),
  setFilesOpen: (open) => {
    set({ filesOpen: open });
    write(FILES_KEY, open ? "1" : "0");
  },
  projectFilter: null,
  setProjectFilter: (cwd) => set({ projectFilter: cwd }),
}));

export function toggleFiles() {
  const { filesOpen, setFilesOpen } = useUiStore.getState();
  setFilesOpen(!filesOpen);
}

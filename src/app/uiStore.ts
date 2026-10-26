import { create } from "zustand";

export type SidebarView = "sessions" | "explorer" | "inbox";

const VIEWS: readonly SidebarView[] = ["sessions", "explorer", "inbox"];

const STORAGE_KEY = "xora.sidebarView";

// localStorage can be missing or throw (private mode, tests); fall back quietly.
function readView(): SidebarView {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VIEWS.find((v) => v === stored) ?? "sessions";
  } catch {
    return "sessions";
  }
}

function writeView(view: SidebarView) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Not persisted; the in-memory state still works.
  }
}

interface UiState {
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarView: readView(),
  setSidebarView: (view) => {
    set({ sidebarView: view });
    writeView(view);
  },
}));

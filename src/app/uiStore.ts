import { create } from "zustand";

export type SidebarView = "explorer" | "inbox";

const STORAGE_KEY = "xora.sidebarView";

// localStorage can be missing or throw (private mode, tests); fall back quietly.
function readView(): SidebarView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "inbox" ? "inbox" : "explorer";
  } catch {
    return "explorer";
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

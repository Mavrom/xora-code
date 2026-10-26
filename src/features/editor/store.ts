import { create } from "zustand";
import { basename } from "@/shared/lib/path";

export interface Tab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  /**
   * The file changed (or vanished) on disk while this tab had unsaved edits, so it was not
   * reloaded. Cleared by saving (the user's version wins) or by a reload.
   */
  diskChanged?: boolean;
}

/** A failed save, shown in the status bar until it times out or the next save. */
export interface SaveError {
  path: string;
  message: string;
}

interface EditorState {
  tabs: Tab[];
  activePath: string | null;
  saveError: SaveError | null;
  openFile: (path: string, content: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string, content: string) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  setSaveError: (error: SaveError | null) => void;
  /**
   * New disk content for a tab: a clean tab takes it, a dirty one keeps the user's edits
   * and is flagged {@link Tab.diskChanged}. Unchanged content is a no-op (e.g. our own save).
   */
  applyDiskContent: (path: string, content: string) => void;
  /** Replaces the tab's content with disk content, dropping unsaved edits ("Diskten yükle"). */
  reloadContent: (path: string, content: string) => void;
  /** The file is gone or unreadable on disk; flags the tab, never drops edits. */
  markDiskChanged: (path: string) => void;
}

export const isDirty = (tab: Tab) => tab.content !== tab.savedContent;

const patchTab = (tabs: Tab[], path: string, patch: Partial<Tab>) =>
  tabs.map((t) => (t.path === path ? { ...t, ...patch } : t));

export const useEditorStore = create<EditorState>((set) => ({
  tabs: [],
  activePath: null,
  saveError: null,

  openFile: (path, content) =>
    set((state) => {
      if (state.tabs.some((t) => t.path === path)) return { activePath: path };
      const tab: Tab = { path, name: basename(path), content, savedContent: content };
      return { tabs: [...state.tabs, tab], activePath: path };
    }),

  updateContent: (path, content) =>
    set((state) => ({ tabs: patchTab(state.tabs, path, { content }) })),

  markSaved: (path, content) =>
    set((state) => ({
      tabs: patchTab(state.tabs, path, { savedContent: content, diskChanged: undefined }),
    })),

  closeTab: (path) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.path === path);
      if (index === -1) return {};
      const tabs = state.tabs.filter((t) => t.path !== path);
      const saveError = state.saveError?.path === path ? null : state.saveError;
      if (state.activePath !== path) return { tabs, saveError };
      const neighbour = tabs[index - 1] ?? tabs[index] ?? null;
      return { tabs, activePath: neighbour?.path ?? null, saveError };
    }),

  setActive: (path) => set({ activePath: path }),

  setSaveError: (saveError) => set({ saveError }),

  applyDiskContent: (path, content) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.path === path);
      if (!tab) return {};
      if (content === tab.savedContent) {
        // Disk matches what we last saved or loaded; at most clear a stale "missing" flag.
        return tab.diskChanged
          ? { tabs: patchTab(state.tabs, path, { diskChanged: undefined }) }
          : {};
      }
      if (isDirty(tab) && content !== tab.content) {
        return { tabs: patchTab(state.tabs, path, { diskChanged: true }) };
      }
      return {
        tabs: patchTab(state.tabs, path, {
          content,
          savedContent: content,
          diskChanged: undefined,
        }),
      };
    }),

  reloadContent: (path, content) =>
    set((state) => ({
      tabs: patchTab(state.tabs, path, { content, savedContent: content, diskChanged: undefined }),
    })),

  markDiskChanged: (path) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.path === path);
      if (!tab || tab.diskChanged) return {};
      return { tabs: patchTab(state.tabs, path, { diskChanged: true }) };
    }),
}));

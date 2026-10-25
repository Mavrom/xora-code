import { create } from "zustand";
import { basename } from "@/shared/lib/path";

export interface Tab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
}

interface EditorState {
  tabs: Tab[];
  activePath: string | null;
  openFile: (path: string, content: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string, content: string) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
}

export const isDirty = (tab: Tab) => tab.content !== tab.savedContent;

const patchTab = (tabs: Tab[], path: string, patch: Partial<Tab>) =>
  tabs.map((t) => (t.path === path ? { ...t, ...patch } : t));

export const useEditorStore = create<EditorState>((set) => ({
  tabs: [],
  activePath: null,

  openFile: (path, content) =>
    set((state) => {
      if (state.tabs.some((t) => t.path === path)) return { activePath: path };
      const tab: Tab = { path, name: basename(path), content, savedContent: content };
      return { tabs: [...state.tabs, tab], activePath: path };
    }),

  updateContent: (path, content) =>
    set((state) => ({ tabs: patchTab(state.tabs, path, { content }) })),

  markSaved: (path, content) =>
    set((state) => ({ tabs: patchTab(state.tabs, path, { savedContent: content }) })),

  closeTab: (path) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.path === path);
      if (index === -1) return {};
      const tabs = state.tabs.filter((t) => t.path !== path);
      if (state.activePath !== path) return { tabs };
      const neighbour = tabs[index - 1] ?? tabs[index] ?? null;
      return { tabs, activePath: neighbour?.path ?? null };
    }),

  setActive: (path) => set({ activePath: path }),
}));

import { create } from "zustand";
import { basename } from "@/shared/lib/path";
import { diffTabKey, isDiffKey } from "./tabKind";

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
  /**
   * Set on a read-only diff tab (key from {@link diffTabKey}). Its `content` and
   * `savedContent` stay empty, so it is never dirty and nothing ever saves it.
   */
  diff?: DiffSource;
}

/** The two sides a diff tab compares. */
export interface DiffSource {
  /** Left side; `null` when the file is new there. */
  oldText: string | null;
  /** Right side. */
  newText: string;
}

export type DiffTab = Tab & { diff: DiffSource };

/** Whether the tab is a read-only diff rather than a file. */
export const isDiffTab = (tab: Tab): tab is DiffTab => isDiffKey(tab.path) && !!tab.diff;

/** A failed save, shown in the status bar until it times out or the next save. */
export interface SaveError {
  path: string;
  message: string;
}

/** A range in Monaco's terms: 1-based lines, 1-based UTF-16 columns, end exclusive. */
export interface EditorRange {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

/** A selection to show once `path` is the active tab (search results, tool call links). */
export interface PendingReveal {
  path: string;
  range: EditorRange;
}

interface EditorState {
  tabs: Tab[];
  activePath: string | null;
  saveError: SaveError | null;
  /** Applied and cleared by the editor panel when it shows `reveal.path`. */
  reveal: PendingReveal | null;
  setReveal: (reveal: PendingReveal | null) => void;
  openFile: (path: string, content: string) => void;
  /**
   * Opens (or refreshes and focuses) the read-only diff tab of `file`; it sits beside the
   * file's own tab. The content-changing actions below ignore diff tabs.
   */
  openDiff: (file: string, oldText: string | null, newText: string) => void;
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
  reveal: null,

  setReveal: (reveal) => set({ reveal }),

  openFile: (path, content) =>
    set((state) => {
      if (state.tabs.some((t) => t.path === path)) return { activePath: path };
      const tab: Tab = { path, name: basename(path), content, savedContent: content };
      return { tabs: [...state.tabs, tab], activePath: path };
    }),

  openDiff: (file, oldText, newText) =>
    set((state) => {
      const path = diffTabKey(file);
      const diff: DiffSource = { oldText, newText };
      if (state.tabs.some((t) => t.path === path)) {
        return { tabs: patchTab(state.tabs, path, { diff }), activePath: path };
      }
      const tab: DiffTab = { path, name: basename(file), content: "", savedContent: "", diff };
      return { tabs: [...state.tabs, tab], activePath: path };
    }),

  updateContent: (path, content) =>
    set((state) => (isDiffKey(path) ? {} : { tabs: patchTab(state.tabs, path, { content }) })),

  markSaved: (path, content) =>
    set((state) =>
      isDiffKey(path)
        ? {}
        : { tabs: patchTab(state.tabs, path, { savedContent: content, diskChanged: undefined }) },
    ),

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
      if (!tab || isDiffTab(tab)) return {};
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
    set((state) =>
      isDiffKey(path)
        ? {}
        : {
            tabs: patchTab(state.tabs, path, {
              content,
              savedContent: content,
              diskChanged: undefined,
            }),
          },
    ),

  markDiskChanged: (path) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.path === path);
      if (!tab || tab.diskChanged || isDiffTab(tab)) return {};
      return { tabs: patchTab(state.tabs, path, { diskChanged: true }) };
    }),
}));

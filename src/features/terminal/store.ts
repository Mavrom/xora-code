import { create } from "zustand";
import { activeAfterClose, nextSeq, type TerminalTab } from "./tabs";

interface TerminalState {
  tabs: TerminalTab[];
  activeKey: number | null;
  /** Mirrors the bottom panel: true while it is expanded. */
  open: boolean;
  /** Set when the active terminal should take focus as soon as it can (e.g. after opening). */
  focusPending: boolean;
  /** Adds a tab, makes it active and returns its key. The view spawns the shell. */
  addTab: () => number;
  removeTab: (key: number) => void;
  setActive: (key: number) => void;
  update: (key: number, patch: Partial<Pick<TerminalTab, "shell" | "status" | "exitCode">>) => void;
  setOpen: (open: boolean) => void;
  requestFocus: () => void;
  clearFocusRequest: () => void;
}

let lastKey = 0;

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeKey: null,
  open: false,
  focusPending: false,

  addTab: () => {
    const key = ++lastKey;
    const tab: TerminalTab = { key, seq: nextSeq(get().tabs), shell: null, status: "starting" };
    set((s) => ({ tabs: [...s.tabs, tab], activeKey: key }));
    return key;
  },

  removeTab: (key) =>
    set((s) => ({
      tabs: s.tabs.filter((t) => t.key !== key),
      activeKey: activeAfterClose(s.tabs, key, s.activeKey),
    })),

  setActive: (key) => {
    if (get().tabs.some((t) => t.key === key)) set({ activeKey: key });
  },

  update: (key, patch) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.key === key ? { ...t, ...patch } : t)) })),

  setOpen: (open) => {
    if (get().open !== open) set({ open });
  },

  requestFocus: () => set({ focusPending: true }),
  clearFocusRequest: () => set({ focusPending: false }),
}));

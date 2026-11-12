import { create } from "zustand";

export const SETTINGS_SECTIONS = [
  "accounts",
  "agent",
  "editor",
  "general",
  "appearance",
  "terminal",
  "shortcuts",
  "about",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

interface SettingsViewState {
  open: boolean;
  section: SettingsSection;
  /** A row (its `data-setting` path) to scroll to once the section shows; then cleared. */
  target: string | null;
  /** Opens the view, optionally on a given section (keeps the last one otherwise) and row. */
  openSettings: (section?: SettingsSection, target?: string) => void;
  clearTarget: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  setSection: (section: SettingsSection) => void;
}

export const useSettingsView = create<SettingsViewState>((set, get) => ({
  open: false,
  section: "accounts",
  target: null,
  openSettings: (section, target) =>
    set({ open: true, section: section ?? get().section, target: target ?? null }),
  clearTarget: () => set({ target: null }),
  closeSettings: () => set({ open: false }),
  toggleSettings: () => set({ open: !get().open }),
  setSection: (section) => set({ section }),
}));

export const openSettings = (section?: SettingsSection, target?: string) =>
  useSettingsView.getState().openSettings(section, target);
export const closeSettings = () => useSettingsView.getState().closeSettings();

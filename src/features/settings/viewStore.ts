import { create } from "zustand";

export const SETTINGS_SECTIONS = [
  "accounts",
  "agent",
  "editor",
  "general",
  "appearance",
  "shortcuts",
  "about",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

interface SettingsViewState {
  open: boolean;
  section: SettingsSection;
  /** Opens the view, optionally on a given section (keeps the last one otherwise). */
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  setSection: (section: SettingsSection) => void;
}

export const useSettingsView = create<SettingsViewState>((set, get) => ({
  open: false,
  section: "accounts",
  openSettings: (section) => set({ open: true, section: section ?? get().section }),
  closeSettings: () => set({ open: false }),
  toggleSettings: () => set({ open: !get().open }),
  setSection: (section) => set({ section }),
}));

export const openSettings = (section?: SettingsSection) =>
  useSettingsView.getState().openSettings(section);
export const closeSettings = () => useSettingsView.getState().closeSettings();

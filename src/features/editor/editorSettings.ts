// The editor reads every user preference through this file only (Settings > Editör and
// Settings > Genel).
import { useSettingsStore } from "@/features/settings/store";

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  ligatures: boolean;
  renderWhitespace: "none" | "boundary" | "all";
  formatOnSave: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: false,
  minimap: false,
  ligatures: true,
  renderWhitespace: "none",
  formatOnSave: false,
};

/** Live editor preferences. */
export function useEditorSettings(): EditorSettings {
  return useSettingsStore((s) => s.settings.editor);
}

/** Whether closing a tab with unsaved changes asks first. */
export function confirmDirtyClose(): boolean {
  return useSettingsStore.getState().settings.general.confirmDirtyClose;
}

/** Whether saving formats the document first (when the language has a formatter). */
export function formatOnSave(): boolean {
  return useSettingsStore.getState().settings.editor.formatOnSave;
}

/** Line height that keeps the 13px / 20px rhythm at other font sizes. */
export const lineHeightFor = (fontSize: number) => Math.round(fontSize * 1.54);

// Integration seam with the Settings feature (package S). The editor reads every user
// preference through this file only, so wiring the real settings is a change here alone:
//
//   useEditorSettings  -> `import { useEditorSettings } from "@/features/settings/useEditorSettings"`
//   confirmDirtyClose  -> `useSettingsStore.getState().settings.general.confirmDirtyClose`
//
// Until then the defaults below (identical to the Settings defaults) apply.

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

/** Live editor preferences (a hook so it can subscribe to the settings store later). */
export function useEditorSettings(): EditorSettings {
  return DEFAULT_EDITOR_SETTINGS;
}

/** Whether closing a tab with unsaved changes asks first. */
export function confirmDirtyClose(): boolean {
  return true;
}

/** Line height that keeps the 13px / 20px rhythm at other font sizes. */
export const lineHeightFor = (fontSize: number) => Math.round(fontSize * 1.54);

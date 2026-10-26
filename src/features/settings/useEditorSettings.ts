import { useSettingsStore } from "./store";
import type { EditorSettings } from "./types";

export type { EditorSettings };

/**
 * Live editor preferences for Monaco. Returns the defaults until the stored
 * settings have loaded; the object identity only changes when a value does.
 */
export function useEditorSettings(): EditorSettings {
  return useSettingsStore((s) => s.settings.editor);
}

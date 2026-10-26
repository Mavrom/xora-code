// Settings > Editör > Otomatik kaydet: "delay" saves a file a moment after typing stops,
// "focusChange" saves every dirty file when the window loses focus (and the editor its
// focus, see EditorPanel). A file that changed on disk under the edits is never saved
// automatically: that would silently overwrite someone else's change.
import { useSettingsStore } from "@/features/settings/store";
import { saveTab } from "./saveActiveTab";
import { isDirty, useEditorStore, type Tab } from "./store";

/** Quiet time after the last keystroke before a "delay" save. */
export const AUTO_SAVE_DELAY_MS = 1000;

const mode = () => useSettingsStore.getState().settings.editor.autoSave;

/** Tabs an automatic save may write. */
export const autoSavable = (tabs: readonly Tab[]) =>
  tabs.filter((t) => isDirty(t) && !t.diskChanged);

/** Saves every dirty tab that is safe to save (focus change, window blur). */
export function saveAllAutomatically() {
  for (const tab of autoSavable(useEditorStore.getState().tabs)) void saveTab(tab.path);
}

/** Saves on focus change when that mode is on. */
export function saveOnFocusChange() {
  if (mode() === "focusChange") saveAllAutomatically();
}

export function installAutoSave(store = useEditorStore) {
  const timers = new Map<string, number>();

  const off = store.subscribe((state, prev) => {
    if (state.tabs === prev.tabs || mode() !== "delay") return;
    for (const tab of state.tabs) {
      const before = prev.tabs.find((t) => t.path === tab.path);
      if (!before || before.content === tab.content || !isDirty(tab) || tab.diskChanged) continue;
      window.clearTimeout(timers.get(tab.path));
      timers.set(
        tab.path,
        window.setTimeout(() => {
          timers.delete(tab.path);
          const current = store.getState().tabs.find((t) => t.path === tab.path);
          if (current && autoSavable([current]).length > 0) void saveTab(current.path);
        }, AUTO_SAVE_DELAY_MS),
      );
    }
  });

  window.addEventListener("blur", saveOnFocusChange);
  return () => {
    off();
    window.removeEventListener("blur", saveOnFocusChange);
    for (const timer of timers.values()) window.clearTimeout(timer);
  };
}

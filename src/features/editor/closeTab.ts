import { confirm } from "@tauri-apps/plugin-dialog";
import { isDirty, useEditorStore, type Tab } from "./store";

let confirming = false;

/**
 * Closes a tab, asking first when it has unsaved changes. Uses the dialog plugin directly:
 * the plugin replaces `window.confirm` with an async version that always returns a Promise.
 * Only one confirm is shown at a time (e.g. a held Ctrl+W).
 */
export async function requestCloseTab(tab: Tab) {
  if (isDirty(tab)) {
    if (confirming) return;
    confirming = true;
    try {
      const discard = await confirm(`${tab.name} kaydedilmedi. Yine de kapatılsın mı?`, {
        title: "Kaydedilmemiş değişiklikler",
        kind: "warning",
        okLabel: "Kapat",
        cancelLabel: "İptal",
      });
      if (!discard) return;
    } finally {
      confirming = false;
    }
  }
  useEditorStore.getState().closeTab(tab.path);
}

/** Closes the active tab (same dirty confirm); a no-op without one. */
export function closeActiveTab() {
  const { tabs, activePath } = useEditorStore.getState();
  const tab = tabs.find((t) => t.path === activePath);
  if (tab) void requestCloseTab(tab);
}

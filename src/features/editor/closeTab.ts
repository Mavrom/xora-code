import { confirm } from "@tauri-apps/plugin-dialog";
import { EDITOR_EMPTY_ID, isShown } from "./editorKeys";
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
  if (useEditorStore.getState().tabs.length === 0) requestAnimationFrame(refocusAfterLastTab);
}

/**
 * Closing the last tab unmounts whatever had focus (Monaco, the tab strip), dropping it to
 * `body`. Land on the explorer tree instead, so the next file is an arrow key away, or on
 * the editor's empty state when the tree is not shown. Leaves focus alone if it already
 * moved somewhere on its own.
 */
function refocusAfterLastTab() {
  const current = document.activeElement;
  if (current && current !== document.body) return;
  const treeStop = document.querySelector('[role="tree"] [role="treeitem"][tabindex="0"]');
  const target = isShown(treeStop) ? treeStop : document.getElementById(EDITOR_EMPTY_ID);
  if (isShown(target)) target.focus({ preventScroll: true });
}

/** Closes the active tab (same dirty confirm); a no-op without one. */
export function closeActiveTab() {
  const { tabs, activePath } = useEditorStore.getState();
  const tab = tabs.find((t) => t.path === activePath);
  if (tab) void requestCloseTab(tab);
}

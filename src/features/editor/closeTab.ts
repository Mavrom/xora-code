import { confirmDialog } from "@/shared/ui/confirm";
import { EDITOR_EMPTY_ID, isShown } from "./editorKeys";
import { confirmDirtyClose } from "./editorSettings";
import { saveTab } from "./saveActiveTab";
import { isDirty, useEditorStore, type Tab } from "./store";
import { t } from "@/shared/i18n";

/**
 * Closes a tab. With unsaved changes it asks first (in-app dialog): Kaydet writes the file
 * and closes (a failed write keeps the tab open, its error in the status bar), Kaydetme
 * drops the edits, İptal keeps the tab. Only one dialog is shown at a time.
 */
export async function requestCloseTab(tab: Tab) {
  if (isDirty(tab) && confirmDirtyClose()) {
    const choice = await confirmDialog({
      title: t("Unsaved changes"),
      message: t("{name} has unsaved changes. Save before closing?", { name: tab.name }),
    });
    if (choice === "cancel") return;
    if (choice === "save") {
      const result = await saveTab(tab.path);
      if (!result.ok) {
        useEditorStore.getState().setActive(tab.path);
        return;
      }
    }
  }
  useEditorStore.getState().closeTab(tab.path);
  if (useEditorStore.getState().tabs.length === 0) refocusAfterLastTab();
}

/**
 * Closing the last tab unmounts whatever had focus (Monaco, the tab strip), dropping it to
 * `body`. Land on the explorer tree instead, so the next file is an arrow key away, or on
 * the editor's empty state when the tree is not shown. Leaves focus alone if it already
 * moved somewhere visible on its own. Two frames: React commits the empty editor and the
 * lazy Monaco panel finishes unmounting before we look.
 */
function refocusAfterLastTab() {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const current = document.activeElement;
      if (current && current !== document.body && isShown(current)) return;
      const treeStop = document.querySelector('[role="tree"] [role="treeitem"][tabindex="0"]');
      const target = isShown(treeStop) ? treeStop : document.getElementById(EDITOR_EMPTY_ID);
      if (isShown(target)) target.focus({ preventScroll: true });
    }),
  );
}

/** Closes the active tab (same dirty confirm); a no-op without one. */
export function closeActiveTab() {
  const { tabs, activePath } = useEditorStore.getState();
  const tab = tabs.find((item) => item.path === activePath);
  if (tab) void requestCloseTab(tab);
}

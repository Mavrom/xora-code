import { ipc } from "@/shared/lib/ipc";
import { describeFsError } from "@/features/files/fsErrors";
import { isDiffTab, isDirty, useEditorStore } from "./store";

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Saves the tab for `path` if it has unsaved changes (a read-only diff tab never has). Reads store state at call time and
 * records a failure as the store's `saveError` (cleared again by the next good save).
 */
export async function saveTab(path: string | null): Promise<SaveResult> {
  const { tabs, markSaved, setSaveError } = useEditorStore.getState();
  const tab = tabs.find((t) => t.path === path);
  if (!tab || isDiffTab(tab) || !isDirty(tab)) return { ok: true };
  try {
    await ipc.writeFile(tab.path, tab.content);
    markSaved(tab.path, tab.content);
    if (useEditorStore.getState().saveError?.path === tab.path) setSaveError(null);
    return { ok: true };
  } catch (e) {
    const error = describeFsError(e);
    setSaveError({ path: tab.path, message: error });
    return { ok: false, error };
  }
}

/** Saves the active tab if it has unsaved changes. */
export function saveActiveTab(): Promise<SaveResult> {
  return saveTab(useEditorStore.getState().activePath);
}

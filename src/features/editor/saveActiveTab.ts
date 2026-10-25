import { ipc } from "@/shared/lib/ipc";
import { isDirty, useEditorStore } from "./store";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Saves the active tab if it has unsaved changes. Reads store state at call time. */
export async function saveActiveTab(): Promise<SaveResult> {
  const { tabs, activePath, markSaved } = useEditorStore.getState();
  const tab = tabs.find((t) => t.path === activePath);
  if (!tab || !isDirty(tab)) return { ok: true };
  try {
    await ipc.writeFile(tab.path, tab.content);
    markSaved(tab.path, tab.content);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

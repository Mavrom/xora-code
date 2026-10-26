import { open } from "@tauri-apps/plugin-dialog";
import { ipc } from "@/shared/lib/ipc";
import { requestRefresh } from "./fsWatch";
import { samePath } from "./recents";
import { useWorkspaceStore } from "./store";

/** Makes `path` the workspace root; re-picking the open folder refreshes it instead. */
export function openFolderPath(path: string) {
  const { root, setRoot } = useWorkspaceStore.getState();
  if (root && samePath(root, path)) requestRefresh(root);
  setRoot(path);
}

/** Shows the native folder picker and makes the choice the workspace root. */
export async function openFolder() {
  try {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") openFolderPath(selected);
  } catch (error) {
    console.error("Failed to open folder dialog", error);
  }
}

/**
 * Opens a folder from "Son açılanlar". Returns false (and forgets it) when the folder is
 * gone, so the list never keeps offering a dead entry.
 */
export async function openRecent(path: string): Promise<boolean> {
  try {
    await ipc.listDir(path);
  } catch {
    useWorkspaceStore.getState().forgetRecent(path);
    return false;
  }
  openFolderPath(path);
  return true;
}

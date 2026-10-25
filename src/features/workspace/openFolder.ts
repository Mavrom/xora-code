import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "./store";

/** Shows the native folder picker and makes the choice the workspace root. */
export async function openFolder() {
  try {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") useWorkspaceStore.getState().setRoot(selected);
  } catch (error) {
    console.error("Failed to open folder dialog", error);
  }
}

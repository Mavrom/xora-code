import { useEffect } from "react";
import { ipc } from "@/shared/lib/ipc";
import { parseFsError } from "@/features/files/fsErrors";
import { onFsChange, type FsChange } from "@/features/workspace/fsWatch";
import { pathKey } from "@/features/workspace/recents";
import { useEditorStore } from "./store";

/**
 * Open tabs a file system change may concern: a changed path equal to the tab's file, or a
 * folder containing it (renamed / deleted folders report only themselves). `full` means all.
 */
export function tabsAffected(
  tabPaths: readonly string[],
  change: Pick<FsChange, "paths" | "full">,
) {
  if (change.full) return [...tabPaths];
  const changed = change.paths.map(pathKey);
  return tabPaths.filter((tab) => {
    const key = pathKey(tab);
    return changed.some((c) => key === c || key.startsWith(`${c}/`));
  });
}

/** Re-reads one tab's file: clean tabs reload, dirty or vanished ones get flagged. */
export async function syncTabFromDisk(path: string): Promise<void> {
  try {
    const content = await ipc.readFile(path);
    useEditorStore.getState().applyDiskContent(path, content);
  } catch (err) {
    // A transient lock (e.g. an editor mid-save) is not worth a marker; a gone file is.
    if (parseFsError(err).code === "not_found") useEditorStore.getState().markDiskChanged(path);
  }
}

/** Keeps open tabs in step with the disk while mounted (EditorArea is always mounted). */
export function useDiskSync() {
  useEffect(
    () =>
      onFsChange((change) => {
        const paths = useEditorStore.getState().tabs.map((t) => t.path);
        for (const path of tabsAffected(paths, change)) void syncTabFromDisk(path);
      }),
    [],
  );
}

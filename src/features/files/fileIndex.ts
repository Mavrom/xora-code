// The open folder's file list, fetched once and kept until the folder changes on disk.
// Quick open and `@` mentions read it; a stale list is served at once and refreshed behind.
import { invoke } from "@tauri-apps/api/core";
import { onFsChange } from "@/features/workspace/fsWatch";
import { samePath } from "@/features/workspace/recents";
import { indexFiles, type IndexedFile } from "./fileSearch";

interface Entry {
  root: string;
  files: IndexedFile[];
  stale: boolean;
  loading: Promise<IndexedFile[]> | null;
}

let entry: Entry | null = null;

// Files added or removed under the root make the list stale; the next read refreshes it.
onFsChange((change) => {
  if (entry && samePath(change.root, entry.root)) entry.stale = true;
});

function fetchFiles(root: string): Promise<IndexedFile[]> {
  return invoke<string[]>("fs_list_files", { root }).then(indexFiles);
}

/**
 * The files of `root`. Resolves at once with a cached (possibly stale) list and refreshes it
 * in the background; `onFresh` gets the new list when that finishes.
 */
export function loadFileIndex(
  root: string,
  onFresh?: (files: IndexedFile[]) => void,
): Promise<IndexedFile[]> {
  if (!entry || !samePath(entry.root, root)) {
    entry = { root, files: [], stale: true, loading: null };
  }
  const current = entry;
  if (current.stale && !current.loading) {
    current.stale = false;
    current.loading = fetchFiles(root)
      .then((files) => {
        current.files = files;
        onFresh?.(files);
        return files;
      })
      .catch((err: unknown) => {
        current.stale = true;
        console.warn("files: could not list", root, err);
        return current.files;
      })
      .finally(() => {
        current.loading = null;
      });
    // Nothing cached yet: wait for the first list.
    if (current.files.length === 0) return current.loading;
  }
  return Promise.resolve(current.files);
}

/** Absolute path of a workspace-relative one. */
export function absolutePath(root: string, relative: string): string {
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root.replace(/[\\/]+$/, "")}${sep}${relative.split("/").join(sep)}`;
}

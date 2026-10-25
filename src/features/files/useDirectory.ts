import { useEffect, useState } from "react";
import { ipc, type DirEntry } from "@/shared/lib/ipc";

interface DirectoryState {
  path: string | null;
  entries: DirEntry[] | null;
  error: string | null;
}

/**
 * Lists `path` while `enabled` is true. Re-fetches each time it becomes enabled again,
 * keeping the previous entries visible until the fresh listing arrives.
 */
export function useDirectory(path: string, enabled: boolean) {
  const [state, setState] = useState<DirectoryState>({ path: null, entries: null, error: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    ipc.listDir(path).then(
      (entries) => {
        if (!cancelled) setState({ path, entries, error: null });
      },
      (error: unknown) => {
        if (!cancelled) setState({ path, entries: null, error: String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path, enabled]);

  // Ignore results that belong to a previous path.
  const current = state.path === path;
  return { entries: current ? state.entries : null, error: current ? state.error : null };
}

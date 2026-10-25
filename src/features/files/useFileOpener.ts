import { useCallback, useEffect, useState } from "react";
import { ipc } from "@/shared/lib/ipc";
import { useEditorStore } from "@/features/editor/store";
import { createLatestGate } from "./latestGate";

/**
 * Opens files from the tree. The last click wins: a slow read that finishes after a newer
 * request is dropped, so it can never steal the active tab. Read failures are kept per path.
 */
export function useFileOpener() {
  const [gate] = useState(createLatestGate);
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => () => gate.cancelAll(), [gate]);

  const setError = useCallback((path: string, message: string | null) => {
    setErrors((prev) => {
      if (message === null && !prev.has(path)) return prev;
      const next = new Map(prev);
      if (message === null) next.delete(path);
      else next.set(path, message);
      return next;
    });
  }, []);

  const open = useCallback(
    (path: string) => {
      const token = gate.begin();
      const { tabs, setActive, openFile } = useEditorStore.getState();
      // Already open: switch to it (the store would ignore re-read content anyway).
      if (tabs.some((t) => t.path === path)) {
        setError(path, null);
        setActive(path);
        return;
      }
      ipc.readFile(path).then(
        (content) => {
          if (!gate.isLatest(token)) return;
          setError(path, null);
          openFile(path, content);
        },
        (err: unknown) => {
          if (gate.isLatest(token)) setError(path, String(err));
        },
      );
    },
    [gate, setError],
  );

  return { open, errors };
}

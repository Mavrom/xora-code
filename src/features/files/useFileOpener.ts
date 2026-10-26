import { useCallback, useEffect, useRef, useState } from "react";
import { ipc } from "@/shared/lib/ipc";
import { basename } from "@/shared/lib/path";
import { useEditorStore } from "@/features/editor/store";
import { reportChanged } from "@/features/workspace/fsWatch";
import { describeFsError, parseFsError } from "./fsErrors";
import { createLatestGate } from "./latestGate";

/** How long the "file is gone" notice stays above the tree. */
const NOTICE_MS = 5_000;

/**
 * Opens files from the tree. The last click wins: a slow read that finishes after a newer
 * request is dropped, so it can never steal the active tab. Read failures are kept per path
 * (as a human message) until that file is retried or any file opens successfully. A file
 * that no longer exists is not kept as an error row: its folder is re-listed (the row goes
 * away) and a short notice says what happened.
 */
export function useFileOpener() {
  const [gate] = useState(createLatestGate);
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      gate.cancelAll();
      clearTimeout(noticeTimer.current);
    },
    [gate],
  );

  const showNotice = useCallback((text: string) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const setError = useCallback((path: string, message: string | null) => {
    setErrors((prev) => {
      if (message === null && !prev.has(path)) return prev;
      const next = new Map(prev);
      if (message === null) next.delete(path);
      else next.set(path, message);
      return next;
    });
  }, []);

  // Any successful open makes every inline error stale.
  const clearErrors = useCallback(() => setErrors((prev) => (prev.size ? new Map() : prev)), []);

  const open = useCallback(
    (path: string) => {
      const token = gate.begin();
      const { tabs, setActive, openFile } = useEditorStore.getState();
      // Already open: switch to it (the store would ignore re-read content anyway).
      if (tabs.some((t) => t.path === path)) {
        clearErrors();
        setActive(path);
        return;
      }
      // A retry drops the old message first, so a repeated failure is announced again.
      setError(path, null);
      ipc.readFile(path).then(
        (content) => {
          if (!gate.isLatest(token)) return;
          clearErrors();
          openFile(path, content);
        },
        (err: unknown) => {
          if (!gate.isLatest(token)) return;
          if (parseFsError(err).code === "not_found") {
            showNotice(`“${basename(path)}” artık yok; liste yenilendi.`);
            reportChanged([path]);
          } else {
            setError(path, describeFsError(err));
          }
        },
      );
    },
    [gate, setError, clearErrors, showNotice],
  );

  return { open, errors, notice };
}

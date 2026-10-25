import { useCallback, useEffect, useState } from "react";
import { ipc } from "@/shared/lib/ipc";
import { createLatestGate } from "./latestGate";
import type { DirListing } from "./treeModel";

const LOADING: DirListing = { entries: null, error: null, loading: true };

/**
 * Folder listings and expanded state for one workspace root. Listings are cached, so
 * re-expanding a folder shows its last entries at once while a fresh listing loads.
 */
export function useTreeState(root: string) {
  const [listings, setListings] = useState<ReadonlyMap<string, DirListing>>(
    () => new Map([[root, LOADING]]),
  );
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [gate] = useState(createLatestGate);

  const fetchListing = useCallback(
    (path: string) => {
      const token = gate.begin(path);
      const apply = (listing: DirListing) => {
        if (!gate.isLatest(token, path)) return;
        setListings((prev) => new Map(prev).set(path, listing));
      };
      ipc.listDir(path).then(
        (entries) => apply({ entries, error: null, loading: false }),
        (error: unknown) => apply({ entries: null, error: String(error), loading: false }),
      );
    },
    [gate],
  );

  useEffect(() => {
    fetchListing(root);
    return () => gate.cancelAll();
  }, [root, fetchListing, gate]);

  const setOpen = useCallback(
    (path: string, open: boolean) => {
      setExpanded((prev) => {
        if (prev.has(path) === open) return prev;
        const next = new Set(prev);
        if (open) next.add(path);
        else next.delete(path);
        return next;
      });
      if (!open) return;
      setListings((prev) => {
        const cached = prev.get(path)?.entries ?? null;
        return new Map(prev).set(path, { entries: cached, error: null, loading: true });
      });
      fetchListing(path);
    },
    [fetchListing],
  );

  return { listings, expanded, setOpen };
}

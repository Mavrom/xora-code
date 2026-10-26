import { samePath } from "./recents";

/** What reopens with a folder: its open tabs (paths only; content is re-read) and the active one. */
export interface WorkspaceSession {
  root: string;
  tabs: string[];
  active: string | null;
}

/** Tabs worth restoring are capped so a huge session never floods startup with reads. */
export const MAX_SESSION_TABS = 20;

/** True when `path` lies inside `root` (any separator style or letter case). */
export function isInsideRoot(path: string, root: string): boolean {
  const p = path.replace(/\\/g, "/").toLowerCase();
  const r = root.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return p.length > r.length + 1 && p.startsWith(`${r}/`);
}

/** Builds the session for `root` from open tabs, keeping only files inside that folder. */
export function makeSession(
  root: string,
  tabPaths: readonly string[],
  active: string | null,
): WorkspaceSession {
  const tabs = tabPaths.filter((p) => isInsideRoot(p, root)).slice(0, MAX_SESSION_TABS);
  return {
    root,
    tabs,
    active: active && tabs.includes(active) ? active : (tabs[tabs.length - 1] ?? null),
  };
}

/** Parses a stored session; anything malformed (or for another folder) gives `null`. */
export function parseSession(raw: string | null, root: string): WorkspaceSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WorkspaceSession> | null;
    if (!value || typeof value.root !== "string" || !samePath(value.root, root)) return null;
    const tabs = Array.isArray(value.tabs)
      ? value.tabs.filter((p): p is string => typeof p === "string")
      : [];
    const active = typeof value.active === "string" ? value.active : null;
    return makeSession(root, tabs, active);
  } catch {
    return null;
  }
}

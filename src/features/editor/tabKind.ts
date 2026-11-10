// Tabs are keyed by `Tab.path`. A file tab's key is its absolute path; a diff tab's key is
// that path behind a prefix no absolute path can start with ("C:\…", "\\server\…", "/…"),
// so a file and its diff can be open side by side. Every "is this a real file?" check goes
// through this module.
import type { Tab } from "./store";

/** Marks a diff tab's key. A drive letter is one character, so "diff:" is never a path. */
const DIFF_PREFIX = "diff:";

/** The tab key of the diff view for `file`: one diff tab per file. */
export const diffTabKey = (file: string) => `${DIFF_PREFIX}${file}`;

/** Whether a tab key (e.g. `activePath`) belongs to a read-only diff tab. */
export const isDiffKey = (key: string | null | undefined): boolean =>
  !!key && key.startsWith(DIFF_PREFIX);

/** The file a tab key shows: the key itself for a file tab, the compared file for a diff. */
export const tabFile = (key: string) => (isDiffKey(key) ? key.slice(DIFF_PREFIX.length) : key);

/** A tab key that is a file on disk (save, reload, disk sync, session), else `null`. */
export const fileKey = (key: string | null | undefined): string | null =>
  key && !isDiffKey(key) ? key : null;

/** Paths of the open tabs that are files on disk (diff tabs have nothing to save or sync). */
export const fileTabPaths = (tabs: readonly Pick<Tab, "path">[]) =>
  tabs.flatMap((t) => fileKey(t.path) ?? []);

/**
 * The file tab the code editor holds: the active tab, or while a diff tab is active the
 * nearest file tab (left first). The code editor stays mounted, hidden, behind a diff tab
 * so its models keep their undo history; `null` when no file tab is open.
 */
export function editorFileTab<T extends Pick<Tab, "path">>(
  tabs: readonly T[],
  activePath: string | null,
): T | null {
  const index = tabs.findIndex((t) => t.path === activePath);
  const isFile = (t: T | undefined) => !!t && !isDiffKey(t.path);
  if (index === -1) return tabs.find(isFile) ?? null;
  if (isFile(tabs[index])) return tabs[index];
  for (let i = index - 1; i >= 0; i--) if (isFile(tabs[i])) return tabs[i];
  return tabs.slice(index + 1).find(isFile) ?? null;
}

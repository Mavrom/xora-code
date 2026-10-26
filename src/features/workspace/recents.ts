/** How many folders "Son açılanlar" remembers. */
export const MAX_RECENTS = 8;

/** Comparison key for a path: forward slashes, no trailing slash, case-folded (Windows). */
export function pathKey(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/** Same file or folder, ignoring separator style, a trailing slash and letter case. */
export const samePath = (a: string, b: string) => pathKey(a) === pathKey(b);

/** Moves (or adds) `path` to the front, dropping duplicates and anything past `max`. */
export function pushRecent(list: readonly string[], path: string, max = MAX_RECENTS): string[] {
  return [path, ...list.filter((p) => !samePath(p, path))].slice(0, max);
}

export function removeRecent(list: readonly string[], path: string): string[] {
  return list.filter((p) => !samePath(p, path));
}

/** Parses the stored list, ignoring anything malformed. */
export function parseRecents(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const paths = value.filter((p): p is string => typeof p === "string" && p.length > 0);
    return paths.reduceRight<string[]>((acc, p) => pushRecent(acc, p), []).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/** Parent folder of `path` for display ("C:/code" for "C:\code\xora"), or "" at a root. */
export function parentLabel(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const cut = normalized.lastIndexOf("/");
  return cut > 0 ? normalized.slice(0, cut) : "";
}

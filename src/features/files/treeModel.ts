import type { DirEntry } from "@/shared/lib/ipc";
import { fold } from "@/features/commands/fuzzy";

/** Listing state of one folder. `entries` stays populated while a refresh is loading. */
export interface DirListing {
  entries: readonly DirEntry[] | null;
  error: string | null;
  loading: boolean;
}

/** A row the user can currently see and focus, in render order. */
export interface VisibleNode {
  entry: DirEntry;
  /** 0 for direct children of the workspace root. */
  depth: number;
  /** `null` for direct children of the workspace root. */
  parentPath: string | null;
  setSize: number;
  /** 1-based position among its siblings. */
  posInSet: number;
}

export type TreeAction =
  | { type: "focus"; path: string }
  | { type: "expand"; path: string }
  | { type: "collapse"; path: string }
  | { type: "open"; path: string };

/** Depth-first list of visible nodes: children of a folder appear only once it is expanded and listed. */
export function flattenVisible(
  root: string,
  listings: ReadonlyMap<string, DirListing>,
  expanded: ReadonlySet<string>,
): VisibleNode[] {
  const out: VisibleNode[] = [];
  const walk = (path: string, depth: number, parentPath: string | null) => {
    const entries = listings.get(path)?.entries;
    if (!entries) return;
    entries.forEach((entry, i) => {
      out.push({ entry, depth, parentPath, setSize: entries.length, posInSet: i + 1 });
      if (entry.isDir && expanded.has(entry.path)) walk(entry.path, depth + 1, entry.path);
    });
  };
  walk(root, 0, null);
  return out;
}

/** Maps a key press on the focused node to a tree action (WAI-ARIA tree view pattern). */
export function keyAction(
  nodes: readonly VisibleNode[],
  focusedPath: string | null,
  key: string,
  expanded: ReadonlySet<string>,
): TreeAction | null {
  if (nodes.length === 0) return null;
  const index = nodes.findIndex((n) => n.entry.path === focusedPath);
  const focus = (i: number): TreeAction => ({ type: "focus", path: nodes[i].entry.path });

  if (key === "Home") return focus(0);
  if (key === "End") return focus(nodes.length - 1);
  if (index === -1) return key === "ArrowDown" || key === "ArrowUp" ? focus(0) : null;

  const node = nodes[index];
  const { path, isDir } = node.entry;
  const isOpen = isDir && expanded.has(path);

  switch (key) {
    case "ArrowDown":
      return index < nodes.length - 1 ? focus(index + 1) : null;
    case "ArrowUp":
      return index > 0 ? focus(index - 1) : null;
    case "ArrowRight": {
      if (!isDir) return null;
      if (!isOpen) return { type: "expand", path };
      const child = nodes[index + 1];
      return child?.parentPath === path ? focus(index + 1) : null;
    }
    case "ArrowLeft":
      if (isOpen) return { type: "collapse", path };
      return node.parentPath ? { type: "focus", path: node.parentPath } : null;
    case "Enter":
    case " ":
      if (!isDir) return { type: "open", path };
      return { type: isOpen ? "collapse" : "expand", path };
    default:
      return null;
  }
}

/** Type-ahead: first node from `fromIndex` (inclusive, wrapping) whose name starts with `query`. */
export function findByPrefix(
  nodes: readonly VisibleNode[],
  fromIndex: number,
  query: string,
): string | null {
  // Folded like the palette: "u" finds "Ünicode.md", "sik" finds "Şikayet.txt".
  const q = fold(query);
  for (let step = 0; step < nodes.length; step++) {
    const node = nodes[(Math.max(fromIndex, 0) + step) % nodes.length];
    if (fold(node.entry.name).startsWith(q)) return node.entry.path;
  }
  return null;
}

// --- Rows for the virtualised tree -------------------------------------------------------

/** One fixed-height (24px) line of the rendered tree. */
export type TreeRow =
  | { kind: "node"; key: string; node: VisibleNode; ancestors: readonly string[] }
  | {
      kind: "status";
      key: string;
      depth: number;
      ancestors: readonly string[];
      tone: "muted" | "danger";
      text: string;
      /** File or folder the message is about. */
      about: string;
      /** Extra inset so a file's message lines up with its name. */
      underName: boolean;
    }
  | { kind: "loading"; key: string; depth: number; ancestors: readonly string[] };

/**
 * Flattens the tree into rows: visible nodes plus the lines that belong to them (a folder's
 * "Boş klasör", loading placeholder or listing error, a file's read error). Same order and
 * rules as {@link flattenVisible}, which stays the source for keyboard navigation.
 */
export function buildTreeRows(
  root: string,
  listings: ReadonlyMap<string, DirListing>,
  expanded: ReadonlySet<string>,
  readErrors: ReadonlyMap<string, string>,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const children = (path: string, depth: number, ancestors: readonly string[]) => {
    const listing = listings.get(path);
    if (!listing) return;
    // The root's error is shown above the tree, not as a row.
    if (listing.error) {
      if (path !== root) {
        rows.push({
          kind: "status",
          key: `${path}::error`,
          depth,
          ancestors,
          tone: "danger",
          text: listing.error,
          about: path,
          underName: false,
        });
      }
      return;
    }
    const { entries } = listing;
    if (!entries) {
      if (listing.loading)
        rows.push({ kind: "loading", key: `${path}::loading`, depth, ancestors });
      return;
    }
    if (entries.length === 0) {
      rows.push({
        kind: "status",
        key: `${path}::empty`,
        depth,
        ancestors,
        tone: "muted",
        text: "Boş klasör",
        about: path,
        underName: false,
      });
      return;
    }
    entries.forEach((entry, i) => {
      const node: VisibleNode = {
        entry,
        depth,
        parentPath: path === root ? null : path,
        setSize: entries.length,
        posInSet: i + 1,
      };
      rows.push({ kind: "node", key: entry.path, node, ancestors });
      if (!entry.isDir) {
        const error = readErrors.get(entry.path);
        if (error) {
          rows.push({
            kind: "status",
            key: `${entry.path}::read-error`,
            depth,
            ancestors,
            tone: "danger",
            text: error,
            about: entry.path,
            underName: true,
          });
        }
      } else if (expanded.has(entry.path)) {
        children(entry.path, depth + 1, [...ancestors, entry.path]);
      }
    });
  };
  children(root, 0, []);
  return rows;
}

/** Parent folder of `path` (either separator), or null at a drive / file system root. */
export function parentDir(path: string): string | null {
  const trimmed = path.replace(/[\\/]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (cut <= 0) return null;
  const parent = trimmed.slice(0, cut);
  // "C:" alone is not a folder path; keep the separator of a drive root.
  return /^[a-zA-Z]:$/.test(parent) ? `${parent}${trimmed[cut]}` : parent;
}

const keyOf = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/**
 * Listed folders whose contents may have changed, given changed paths from the watcher:
 * a changed path's parent (something was added, removed or renamed in it) and the path
 * itself when it is a listed folder (e.g. it was deleted). `full` means every listed folder.
 */
export function affectedDirs(
  changed: readonly string[],
  listed: Iterable<string>,
  full: boolean,
): string[] {
  const byKey = new Map<string, string>();
  for (const dir of listed) byKey.set(keyOf(dir), dir);
  if (full) return [...byKey.values()];
  const out = new Set<string>();
  for (const path of changed) {
    const self = byKey.get(keyOf(path));
    if (self) out.add(self);
    const parent = parentDir(path);
    const listedParent = parent === null ? undefined : byKey.get(keyOf(parent));
    if (listedParent) out.add(listedParent);
  }
  return [...out];
}

/** Number of leading `ancestors` that contain `activePath` (they draw a brighter guide). */
export function activeGuideDepth(ancestors: readonly string[], activePath: string | null): number {
  if (activePath === null) return 0;
  let depth = 0;
  while (depth < ancestors.length && isInsideDir(activePath, ancestors[depth])) depth++;
  return depth;
}

/** True when `path` lies inside folder `dir` (either separator). */
export const isInsideDir = (path: string | null, dir: string) =>
  path !== null &&
  path.length > dir.length &&
  path.startsWith(dir) &&
  (path[dir.length] === "/" || path[dir.length] === "\\");

/** The single row that carries `tabIndex=0` (roving tabindex). */
export function resolveTabStop(
  nodes: readonly VisibleNode[],
  focusedPath: string | null,
  activePath: string | null,
): string | null {
  const visible = (p: string | null) => p !== null && nodes.some((n) => n.entry.path === p);
  if (visible(focusedPath)) return focusedPath;
  if (visible(activePath)) return activePath;
  return nodes[0]?.entry.path ?? null;
}

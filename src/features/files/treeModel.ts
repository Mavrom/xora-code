import type { DirEntry } from "@/shared/lib/ipc";

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
  const q = query.toLowerCase();
  for (let step = 0; step < nodes.length; step++) {
    const node = nodes[(Math.max(fromIndex, 0) + step) % nodes.length];
    if (node.entry.name.toLowerCase().startsWith(q)) return node.entry.path;
  }
  return null;
}

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

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { basename } from "@/shared/lib/path";
import { useUiStore } from "@/app/uiStore";
import { useEditorStore } from "@/features/editor/store";
import { isShown } from "@/features/editor/editorKeys";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useWorkspaceLifecycle } from "@/features/workspace/useWorkspaceLifecycle";
import { cn } from "@/shared/ui/cn";
import { ExplorerEmpty } from "./ExplorerEmpty";
import { FolderTabs } from "./FolderTabs";
import { indentOf, isDimmed, NAME_OFFSET, ROW_HEIGHT } from "./treeLayout";
import {
  activeGuideDepth,
  buildTreeRows,
  findByPrefix,
  keyAction,
  resolveTabStop,
  type TreeRow,
  type VisibleNode,
} from "./treeModel";
import { LoadingRow, StatusRow, TreeItem, type RowActions } from "./TreeRows";
import { useFileOpener } from "./useFileOpener";
import { useScrollViewport } from "./useScrollViewport";
import { useTreeState } from "./useTreeState";
import { scrollToReveal, visibleRange } from "./virtualRange";

/** Rows rendered above and below the viewport so fast scrolling never shows a gap. */
const OVERSCAN = 12;
/** Space under the last row (matches the old `pb-3`). */
const LIST_PADDING_BOTTOM = 12;
const TYPEAHEAD_RESET_MS = 600;

interface FileTreeProps {
  onOpenFolder: () => void;
}

export function FileTree({ onOpenFolder }: FileTreeProps) {
  const root = useWorkspaceStore((s) => s.root);
  const panel = useRef<HTMLDivElement>(null);
  useWorkspaceLifecycle();
  useFocusOnShow(panel);

  return (
    <div ref={panel} className="flex h-full flex-col">
      <FolderTabs onAdd={onOpenFolder} />
      {root ? (
        // Re-mount on root change so expanded state never leaks between folders.
        <TreeRoot key={root} root={root} />
      ) : (
        <ExplorerEmpty onOpenFolder={onOpenFolder} />
      )}
    </div>
  );
}

/**
 * Showing the files column (title bar button, Ctrl+Shift+E, palette) lands on the tree's
 * tab stop (or the empty state's first control) when focus has nowhere visible to be;
 * never steals focus from a visible element such as the button that was just clicked.
 */
function useFocusOnShow(panel: RefObject<HTMLDivElement | null>) {
  const open = useUiStore((s) => s.filesOpen);
  const previous = useRef(open);
  useEffect(() => {
    const was = previous.current;
    previous.current = open;
    if (!open || was) return;
    const id = requestAnimationFrame(() => {
      const current = document.activeElement;
      if (current && current !== document.body && isShown(current)) return;
      const target =
        panel.current?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]') ??
        panel.current?.querySelector<HTMLElement>("button:not([disabled])");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open, panel]);
}

const isNode = (row: TreeRow): row is Extract<TreeRow, { kind: "node" }> => row.kind === "node";

function TreeRoot({ root }: { root: string }) {
  const { listings, expanded, setOpen } = useTreeState(root);
  const { open, errors: readErrors, notice } = useFileOpener();
  const activePath = useEditorStore((s) => s.activePath);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const scroller = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const typeAhead = useRef({ query: "", at: 0 });
  const viewport = useScrollViewport(scroller);
  const baseId = useId();

  const rows = useMemo(
    () => buildTreeRows(root, listings, expanded, readErrors),
    [root, listings, expanded, readErrors],
  );
  const nodes = useMemo<VisibleNode[]>(() => rows.filter(isNode).map((r) => r.node), [rows]);
  const indexOf = useMemo(() => new Map(rows.map((r, i) => [r.key, i])), [rows]);
  const tabStop = resolveTabStop(nodes, focusedPath, activePath);

  // Read through a ref so `activate` (and with it every row) stays stable across expands.
  const expandedRef = useRef(expanded);
  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  const actions = useMemo<RowActions>(
    () => ({
      activate: (entry) => {
        if (entry.isDir) setOpen(entry.path, !expandedRef.current.has(entry.path));
        else open(entry.path);
      },
      onRowFocus: setFocusedPath,
      registerRow: (path, el) => {
        if (el) rowEls.current.set(path, el);
        else rowEls.current.delete(path);
      },
    }),
    [open, setOpen],
  );

  // Keyboard focus may target a row that is only rendered after the next commit.
  useLayoutEffect(() => {
    const path = pendingFocus.current;
    if (path === null) return;
    const el = rowEls.current.get(path);
    if (!el) return;
    pendingFocus.current = null;
    el.focus({ preventScroll: true });
  });

  // A re-list can remove the focused row, which drops DOM focus to <body>. Hand it to the
  // resolved tab stop, but only when focus was really lost (never steal it from elsewhere).
  useEffect(() => {
    if (focusedPath === null || nodes.some((n) => n.entry.path === focusedPath)) return;
    const current = document.activeElement;
    if (current && current !== document.body) return;
    if (tabStop) rowEls.current.get(tabStop)?.focus({ preventScroll: true });
  }, [nodes, focusedPath, tabStop]);

  const focusRow = (path: string) => {
    const el = scroller.current;
    const index = indexOf.get(path);
    if (el && index !== undefined) {
      const next = scrollToReveal(index, el.scrollTop, el.clientHeight, ROW_HEIGHT);
      if (next !== null) el.scrollTop = next;
    }
    setFocusedPath(path);
    const row = rowEls.current.get(path);
    if (row) row.focus({ preventScroll: true });
    else pendingFocus.current = path;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    // Type-ahead: printable characters jump to the next matching name.
    if (e.key.length === 1 && (e.key !== " " || typeAhead.current.query !== "")) {
      const ta = typeAhead.current;
      const fresh = e.timeStamp - ta.at > TYPEAHEAD_RESET_MS;
      ta.query = fresh ? e.key : ta.query + e.key;
      ta.at = e.timeStamp;
      const index = nodes.findIndex((n) => n.entry.path === focusedPath);
      // A new single letter moves past the current row; a longer query may stay on it.
      const hit = findByPrefix(nodes, ta.query.length === 1 ? index + 1 : index, ta.query);
      if (hit) {
        e.preventDefault();
        focusRow(hit);
      }
      return;
    }

    const action = keyAction(nodes, focusedPath, e.key, expanded);
    if (!action) return;
    e.preventDefault();
    if (action.type === "focus") focusRow(action.path);
    else if (action.type === "expand") setOpen(action.path, true);
    else if (action.type === "collapse") setOpen(action.path, false);
    else open(action.path);
  };

  const rootListing = listings.get(root);

  // Rows on screen, plus the focused row and the tab stop wherever they are: the first
  // must keep DOM focus while scrolled away, the second lets Tab enter the tree.
  const range = visibleRange(viewport.top, viewport.height, ROW_HEIGHT, rows.length, OVERSCAN);
  const rendered: number[] = [];
  for (let i = range.start; i < range.end; i++) rendered.push(i);
  for (const path of [focusedPath, tabStop]) {
    const i = path === null ? undefined : indexOf.get(path);
    if (i !== undefined && (i < range.start || i >= range.end) && !rendered.includes(i)) {
      rendered.push(i);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {rootListing?.error && (
        <div
          role="alert"
          className="mx-3 mb-2 rounded-md border border-border bg-elevated px-3 py-2 text-xs leading-snug break-words text-danger select-text"
        >
          {rootListing.error}
        </div>
      )}
      <p role="status" className={cn("px-4 text-2xs text-fg-subtle", notice && "pb-1.5")}>
        {notice}
      </p>
      <div
        ref={scroller}
        role="tree"
        aria-label={basename(root)}
        aria-busy={rootListing?.loading && !rootListing.entries ? true : undefined}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1.5"
      >
        <div
          className="relative"
          style={{ height: rows.length * ROW_HEIGHT + LIST_PADDING_BOTTOM }}
        >
          {rendered.map((i) => {
            const row = rows[i];
            const top = i * ROW_HEIGHT;
            const guides = activeGuideDepth(row.ancestors, activePath);
            const dimmed = isDimmed(row);
            if (row.kind === "node") {
              const { entry } = row.node;
              const listing = entry.isDir ? listings.get(entry.path) : undefined;
              const next = rows[i + 1];
              const hasError =
                next?.kind === "status" && next.tone === "danger" && next.about === entry.path;
              return (
                <TreeItem
                  key={row.key}
                  node={row.node}
                  top={top}
                  depth={row.ancestors.length}
                  brightGuides={guides}
                  dimmed={dimmed}
                  actions={actions}
                  isTabStop={tabStop === entry.path}
                  isActive={activePath === entry.path}
                  isExpanded={entry.isDir && expanded.has(entry.path)}
                  isLoading={!!listing?.loading && !listing.entries}
                  errorId={hasError ? `${baseId}-row-${i + 1}` : undefined}
                />
              );
            }
            if (row.kind === "loading") {
              return <LoadingRow key={row.key} top={top} depth={row.depth} brightGuides={guides} />;
            }
            return (
              <StatusRow
                key={row.key}
                id={`${baseId}-row-${i}`}
                top={top}
                depth={row.depth}
                brightGuides={guides}
                inset={indentOf(row.depth) + (row.underName ? NAME_OFFSET : 0)}
                tone={row.tone}
                text={row.text}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

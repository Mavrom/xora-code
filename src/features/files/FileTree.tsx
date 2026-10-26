import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ChevronRight, Folder, FolderOpen, FolderSearch } from "lucide-react";
import type { DirEntry } from "@/shared/lib/ipc";
import { basename } from "@/shared/lib/path";
import { useUiStore } from "@/app/uiStore";
import { useEditorStore } from "@/features/editor/store";
import { isShown } from "@/features/editor/editorKeys";
import { openRecent } from "@/features/workspace/openFolder";
import { parentLabel } from "@/features/workspace/recents";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useWorkspaceLifecycle } from "@/features/workspace/useWorkspaceLifecycle";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { cn } from "@/shared/ui/cn";
import { FileIcon } from "./FileIcon";
import { FolderTabs } from "./FolderTabs";
import {
  activeGuideDepth,
  buildTreeRows,
  findByPrefix,
  keyAction,
  resolveTabStop,
  type TreeRow,
  type VisibleNode,
} from "./treeModel";
import { useFileOpener } from "./useFileOpener";
import { useTreeState } from "./useTreeState";
import { scrollToReveal, visibleRange } from "./virtualRange";

const ROW_PADDING = 8;
const INDENT = 14;
/** Width of the leading chevron / file icon slot. */
const SLOT = 14;
/** Slot plus the gap before the name, so status text lines up with names. */
const NAME_OFFSET = SLOT + 6;
/** Every tree line is exactly this tall, which is what makes windowing cheap. */
const ROW_HEIGHT = 24;
/** Rows rendered above and below the viewport so fast scrolling never shows a gap. */
const OVERSCAN = 12;
/** Space under the last row (matches the old `pb-3`). */
const LIST_PADDING_BOTTOM = 12;
/** Loading placeholders appear only if a listing takes longer than this. */
const SHIMMER_DELAY_MS = 150;
const TYPEAHEAD_RESET_MS = 600;

/** Build output and dependency folders: dimmed (with everything inside), never hidden. */
const NOISY = new Set(["node_modules", "dist", "target", ".claude"]);

const indentOf = (depth: number) => ROW_PADDING + depth * INDENT;

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

/** "Klasör açılmadı" plus the recently opened folders, newest first. */
function ExplorerEmpty({ onOpenFolder }: { onOpenFolder: () => void }) {
  const recents = useWorkspaceStore((s) => s.recents);
  const [gone, setGone] = useState<string | null>(null);
  const headingId = useId();

  const reopen = async (path: string) => {
    setGone(null);
    if (!(await openRecent(path))) setGone(basename(path));
  };

  return (
    <EmptyState
      icon={FolderSearch}
      title="Klasör açılmadı"
      description={
        recents.length > 0
          ? "Bir klasör aç ya da kaldığın yerden devam et."
          : "Başlamak için bir klasör aç."
      }
      action={
        <>
          <Button icon={FolderOpen} onClick={onOpenFolder}>
            Klasör aç
          </Button>
          {recents.length > 0 && (
            <section aria-labelledby={headingId} className="mt-7 w-full max-w-64 text-left">
              <h3
                id={headingId}
                className="px-2 pb-1.5 text-2xs font-medium tracking-wide text-fg-subtle uppercase"
              >
                Son açılanlar
              </h3>
              <ul className="flex flex-col">
                {recents.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      title={path}
                      onClick={() => void reopen(path)}
                      className="group flex h-7 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-xs transition-colors duration-fast hover:bg-hover"
                    >
                      <Folder
                        size={13}
                        strokeWidth={1.75}
                        aria-hidden
                        className="shrink-0 text-fg-subtle"
                      />
                      <span className="shrink-0 truncate text-fg-muted group-hover:text-fg">
                        {basename(path)}
                      </span>
                      <span className="min-w-0 truncate text-2xs text-fg-subtle">
                        {parentLabel(path)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p role="status" className="min-h-5 px-2 pt-1 text-2xs text-fg-subtle">
                {gone && `“${gone}” bulunamadı; listeden çıkarıldı.`}
              </p>
            </section>
          )}
        </>
      }
    />
  );
}

/** Callbacks shared by every row. Stable for the lifetime of the tree, so memoised rows never re-render because of them. */
interface RowActions {
  activate: (entry: DirEntry) => void;
  onRowFocus: (path: string) => void;
  registerRow: (path: string, el: HTMLElement | null) => void;
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
  const [viewport, setViewport] = useState({ top: 0, height: 0 });
  const baseId = useId();

  const rows = useMemo(
    () => buildTreeRows(root, listings, expanded, readErrors),
    [root, listings, expanded, readErrors],
  );
  const nodes = useMemo<VisibleNode[]>(() => rows.filter(isNode).map((r) => r.node), [rows]);
  const indexOf = useMemo(() => new Map(rows.map((r, i) => [r.key, i])), [rows]);
  const tabStop = resolveTabStop(nodes, focusedPath, activePath);

  // Track the scroll position and height; scroll events are coalesced per frame.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setViewport((prev) =>
        prev.top === el.scrollTop && prev.height === el.clientHeight
          ? prev
          : { top: el.scrollTop, height: el.clientHeight },
      );
    };
    read();
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(read);
    observer.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

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

/** Rows inside (or naming) a noisy folder such as node_modules are drawn dimmed. */
function isDimmed(row: TreeRow): boolean {
  if (row.ancestors.some((a) => NOISY.has(basename(a)))) return true;
  return row.kind === "node" && NOISY.has(row.node.entry.name);
}

/** Vertical indent guides under each ancestor's chevron; brighter on the active file's chain. */
function Guides({ depth, bright }: { depth: number; bright: number }) {
  if (depth === 0) return null;
  return Array.from({ length: depth }, (_, level) => (
    <span
      key={level}
      aria-hidden
      style={{ left: indentOf(level) + SLOT / 2 }}
      className={cn(
        "pointer-events-none absolute inset-y-0 w-px",
        level < bright ? "bg-border-strong" : "bg-border",
      )}
    />
  ));
}

interface TreeItemProps {
  node: VisibleNode;
  top: number;
  depth: number;
  brightGuides: number;
  dimmed: boolean;
  actions: RowActions;
  isTabStop: boolean;
  isActive: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  /** Id of the error line under this row, if any. */
  errorId?: string;
}

/**
 * One treeitem (flat APG tree: level, set size and position carry the structure).
 * Memoised on primitives, so moving focus re-renders just the two rows involved.
 */
const TreeItem = memo(function TreeItem({
  node,
  top,
  depth,
  brightGuides,
  dimmed,
  actions,
  isTabStop,
  isActive,
  isExpanded,
  isLoading,
  errorId,
}: TreeItemProps) {
  const { entry, setSize, posInSet } = node;
  const { path, isDir } = entry;
  const { registerRow, onRowFocus, activate } = actions;

  // Stable ref callback: registers once per mount instead of detaching on every render.
  const rowRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      registerRow(path, el);
      return () => registerRow(path, null);
    },
    [registerRow, path],
  );

  return (
    <div
      ref={rowRef}
      role="treeitem"
      tabIndex={isTabStop ? 0 : -1}
      aria-level={depth + 1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-expanded={isDir ? isExpanded : undefined}
      aria-selected={isDir ? undefined : isActive}
      aria-busy={isExpanded && isLoading ? true : undefined}
      aria-describedby={errorId}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onRowFocus(path);
      }}
      style={{ top, height: ROW_HEIGHT }}
      className="absolute inset-x-0 outline-none [&:focus-visible>[data-row]]:outline [&:focus-visible>[data-row]]:outline-1 [&:focus-visible>[data-row]]:-outline-offset-1 [&:focus-visible>[data-row]]:outline-fg-subtle"
    >
      <Guides depth={depth} bright={brightGuides} />
      <div
        data-row
        title={path}
        onClick={() => activate(entry)}
        style={{ paddingLeft: indentOf(depth) }}
        className={cn(
          "relative flex h-full items-center gap-1.5 rounded-sm pr-2 transition-colors duration-100",
          isActive
            ? "bg-hover text-fg before:absolute before:inset-y-1 before:left-0 before:w-px before:rounded-full before:bg-accent"
            : cn(
                "hover:bg-elevated",
                dimmed ? "text-fg-subtle hover:text-fg-muted" : "text-fg-muted hover:text-fg",
              ),
        )}
      >
        {isDir ? (
          <ChevronRight
            size={SLOT}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              "shrink-0 text-fg-subtle transition-transform duration-150 ease-out-quint",
              isExpanded && "rotate-90",
            )}
          />
        ) : (
          <FileIcon name={entry.name} />
        )}
        <span className="truncate">{entry.name}</span>
      </div>
    </div>
  );
});

interface LineProps {
  top: number;
  depth: number;
  brightGuides: number;
}

/**
 * Non-item text inside the tree (empty folder, errors): `role="none"` so the tree owns only
 * treeitems (APG). One line, truncated; the full text is in the tooltip.
 */
const StatusRow = memo(function StatusRow({
  id,
  top,
  depth,
  brightGuides,
  inset,
  tone,
  text,
}: LineProps & { id: string; inset: number; tone: "muted" | "danger"; text: string }) {
  return (
    <div
      id={id}
      role="none"
      title={text}
      style={{ top, height: ROW_HEIGHT, paddingLeft: inset }}
      className={cn(
        "absolute inset-x-0 flex items-center pr-2 text-xs",
        tone === "danger" ? "text-danger select-text" : "text-fg-subtle",
      )}
    >
      <Guides depth={depth} bright={brightGuides} />
      <span className="truncate">{text}</span>
    </div>
  );
});

/** Placeholder line for a slow listing; stays blank for fast loads to avoid a flash. */
function LoadingRow({ top, depth, brightGuides }: LineProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHIMMER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      aria-hidden
      style={{ top, height: ROW_HEIGHT, paddingLeft: indentOf(depth) }}
      className="absolute inset-x-0 flex items-center gap-1.5 pr-2"
    >
      <Guides depth={depth} bright={brightGuides} />
      {visible && (
        <>
          <span className="skeleton size-3 shrink-0 animate-skeleton rounded-sm transition-opacity duration-300 ease-out-quint starting:opacity-0" />
          <span className="skeleton h-2 w-1/2 animate-skeleton rounded-full transition-opacity duration-300 ease-out-quint starting:opacity-0" />
        </>
      )}
    </div>
  );
}

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronRight, FolderOpen, FolderSearch } from "lucide-react";
import type { DirEntry } from "@/shared/lib/ipc";
import { basename } from "@/shared/lib/path";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useEditorStore } from "@/features/editor/store";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PanelHeader } from "@/shared/ui/PanelHeader";
import { cn } from "@/shared/ui/cn";
import { FileIcon } from "./FileIcon";
import {
  findByPrefix,
  flattenVisible,
  keyAction,
  resolveTabStop,
  type DirListing,
} from "./treeModel";
import { useFileOpener } from "./useFileOpener";
import { useTreeState } from "./useTreeState";

const ROW_PADDING = 8;
const INDENT = 14;
/** Width of the leading chevron / file icon slot. */
const SLOT = 14;
/** Slot plus the gap before the name, so status text lines up with names. */
const NAME_OFFSET = SLOT + 6;
/** Loading placeholders appear only if a listing takes longer than this. */
const SHIMMER_DELAY_MS = 150;
const TYPEAHEAD_RESET_MS = 600;

/** Build output and dependency folders: dimmed (with everything inside), never hidden. */
const NOISY = new Set(["node_modules", "dist", "target", ".claude"]);

const indentOf = (depth: number) => ROW_PADDING + depth * INDENT;

/** True when `path` lies inside folder `dir` (either separator). */
const isInside = (path: string | null, dir: string) =>
  path !== null &&
  path.length > dir.length &&
  path.startsWith(dir) &&
  (path[dir.length] === "/" || path[dir.length] === "\\");

interface FileTreeProps {
  onOpenFolder: () => void;
}

export function FileTree({ onOpenFolder }: FileTreeProps) {
  const root = useWorkspaceStore((s) => s.root);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={root ? basename(root) : "Explorer"} />
      {root ? (
        // Re-mount on root change so expanded state never leaks between folders.
        <TreeRoot key={root} root={root} />
      ) : (
        <EmptyState
          icon={FolderSearch}
          title="Klasör açılmadı"
          description="Başlamak için üst bardan bir klasör aç."
          action={{ label: "Klasör aç", onClick: onOpenFolder, icon: FolderOpen }}
        />
      )}
    </div>
  );
}

/** Callbacks shared by every row. Stable for the lifetime of the tree, so memoised rows never re-render because of them. */
interface RowActions {
  activate: (entry: DirEntry) => void;
  onRowFocus: (path: string) => void;
  registerRow: (path: string, el: HTMLElement | null) => void;
}

/**
 * What a listing needs to render its rows. `tabStop` and `activePath` are scoped to the
 * subtree being rendered (null when they lie outside it), so a folder's props only change
 * when something inside it does.
 */
interface TreeView {
  listings: ReadonlyMap<string, DirListing>;
  expanded: ReadonlySet<string>;
  readErrors: ReadonlyMap<string, string>;
  tabStop: string | null;
  activePath: string | null;
}

/** `path` when it is `dir` itself or lies inside it, otherwise null. */
const scopeTo = (path: string | null, dir: string) =>
  path === dir || isInside(path, dir) ? path : null;

function TreeRoot({ root }: { root: string }) {
  const { listings, expanded, setOpen } = useTreeState(root);
  const { open, errors: readErrors } = useFileOpener();
  const activePath = useEditorStore((s) => s.activePath);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLElement>());
  const typeAhead = useRef({ query: "", at: 0 });

  const nodes = useMemo(() => flattenVisible(root, listings, expanded), [root, listings, expanded]);
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
        if (el) rows.current.set(path, el);
        else rows.current.delete(path);
      },
    }),
    [open, setOpen],
  );

  // A re-list can remove the focused row, which drops DOM focus to <body>. Hand it to the
  // resolved tab stop, but only when focus was really lost (never steal it from elsewhere).
  useEffect(() => {
    if (focusedPath === null || nodes.some((n) => n.entry.path === focusedPath)) return;
    const current = document.activeElement;
    if (current && current !== document.body) return;
    if (tabStop) rows.current.get(tabStop)?.focus();
  }, [nodes, focusedPath, tabStop]);

  const focusRow = (path: string) => {
    setFocusedPath(path);
    rows.current.get(path)?.focus();
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

  const view: TreeView = { listings, expanded, readErrors, tabStop, activePath };
  const rootListing = listings.get(root);

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
      <div
        role="tree"
        aria-label={basename(root)}
        aria-busy={rootListing?.loading && !rootListing.entries ? true : undefined}
        onKeyDown={onKeyDown}
        className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3"
      >
        <Children view={view} actions={actions} path={root} depth={0} dimmed={false} />
      </div>
    </div>
  );
}

/**
 * Rows (or the loading / empty placeholder) for the listing of `path`. Errors render
 * elsewhere. Not memoised itself: it only turns `view` into primitive per-row props.
 */
function Children({
  view,
  actions,
  path,
  depth,
  dimmed,
}: {
  view: TreeView;
  actions: RowActions;
  path: string;
  depth: number;
  dimmed: boolean;
}) {
  const listing = view.listings.get(path);
  if (!listing || listing.error) return null;
  const { entries } = listing;
  if (!entries) return listing.loading ? <LoadingRows depth={depth} /> : null;
  if (entries.length === 0) {
    return <StatusRow inset={indentOf(depth)}>Boş klasör</StatusRow>;
  }
  return entries.map((entry, i) => {
    const open = entry.isDir && view.expanded.has(entry.path);
    return (
      <TreeNode
        key={entry.path}
        entry={entry}
        depth={depth}
        setSize={entries.length}
        posInSet={i + 1}
        dimmed={dimmed || NOISY.has(entry.name)}
        actions={actions}
        isTabStop={view.tabStop === entry.path}
        isActive={view.activePath === entry.path}
        readError={entry.isDir ? null : (view.readErrors.get(entry.path) ?? null)}
        // Only open folders render descendants, so only they receive the shared maps.
        listings={open ? view.listings : undefined}
        expanded={open ? view.expanded : undefined}
        readErrors={open ? view.readErrors : undefined}
        tabStopInside={open ? scopeTo(view.tabStop, entry.path) : null}
        activeInside={open ? scopeTo(view.activePath, entry.path) : null}
      />
    );
  });
}

interface TreeNodeProps {
  entry: DirEntry;
  depth: number;
  setSize: number;
  posInSet: number;
  dimmed: boolean;
  actions: RowActions;
  isTabStop: boolean;
  isActive: boolean;
  /** Read failure of this file; always null for folders. */
  readError: string | null;
  /** Set only while this folder is expanded (their presence means "open"). */
  listings?: ReadonlyMap<string, DirListing>;
  expanded?: ReadonlySet<string>;
  readErrors?: ReadonlyMap<string, string>;
  /** Tab stop / active file when inside this open folder, otherwise null. */
  tabStopInside: string | null;
  activeInside: string | null;
}

/**
 * One treeitem. Memoised: every prop is a primitive or a reference that only changes
 * when this row (or, for an open folder, its subtree) is affected, so moving focus
 * re-renders just the rows that gain or lose the tab stop and their ancestors.
 */
const TreeNode = memo(function TreeNode({
  entry,
  depth,
  setSize,
  posInSet,
  dimmed,
  actions,
  isTabStop,
  isActive,
  readError,
  listings,
  expanded: expandedSet,
  readErrors,
  tabStopInside,
  activeInside,
}: TreeNodeProps) {
  const errorId = useId();
  const { path, isDir } = entry;
  const { registerRow, onRowFocus, activate } = actions;
  const expanded = isDir && listings !== undefined;
  const listing = listings?.get(path);
  const error = isDir ? (listing?.error ?? null) : readError;

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
    // APG tree pattern: the focusable treeitem owns its row and, when open, its child group.
    // Only the row itself shows the focus ring.
    <div
      ref={rowRef}
      role="treeitem"
      tabIndex={isTabStop ? 0 : -1}
      aria-level={depth + 1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-expanded={isDir ? expanded : undefined}
      aria-selected={isDir ? undefined : isActive}
      aria-busy={expanded && listing?.loading && !listing.entries ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onRowFocus(path);
      }}
      className="outline-none [&:focus-visible>[data-row]]:outline [&:focus-visible>[data-row]]:outline-1 [&:focus-visible>[data-row]]:-outline-offset-1 [&:focus-visible>[data-row]]:outline-fg-subtle"
    >
      <div
        data-row
        title={path}
        onClick={() => activate(entry)}
        style={{ paddingLeft: indentOf(depth) }}
        className={cn(
          "relative flex h-6 items-center gap-1.5 rounded-sm pr-2 transition-colors duration-100",
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
              expanded && "rotate-90",
            )}
          />
        ) : (
          <FileIcon name={entry.name} />
        )}
        <span className="truncate">{entry.name}</span>
      </div>
      {!isDir && error && (
        <StatusRow id={errorId} inset={indentOf(depth) + NAME_OFFSET} tone="danger" role="alert">
          {error}
        </StatusRow>
      )}
      {listings && expandedSet && readErrors && (
        <div role="group" className="relative">
          {/* Indent guide under the chevron; brighter on the active file's ancestor chain. */}
          <span
            aria-hidden
            style={{ left: indentOf(depth) + SLOT / 2 }}
            className={cn(
              "pointer-events-none absolute inset-y-0 w-px",
              activeInside !== null && activeInside !== path ? "bg-border-strong" : "bg-border",
            )}
          />
          {error && (
            <StatusRow id={errorId} inset={indentOf(depth + 1)} tone="danger">
              {error}
            </StatusRow>
          )}
          <Children
            view={{
              listings,
              expanded: expandedSet,
              readErrors,
              tabStop: tabStopInside,
              activePath: activeInside,
            }}
            actions={actions}
            path={path}
            depth={depth + 1}
            dimmed={dimmed}
          />
        </div>
      )}
    </div>
  );
});

/**
 * Non-item text inside the tree (empty folder, errors). Defaults to `role="none"` so a
 * `tree` / `group` owns only treeitems (APG); a fresh file read error uses `alert`.
 */
function StatusRow({
  id,
  inset,
  tone = "muted",
  role = "none",
  children,
}: {
  id?: string;
  inset: number;
  tone?: "muted" | "danger";
  role?: "none" | "alert";
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      role={role}
      style={{ paddingLeft: inset }}
      className={cn(
        "pr-2 text-xs",
        tone === "danger"
          ? "py-1 leading-snug break-words text-danger select-text"
          : "flex h-6 items-center text-fg-subtle",
      )}
    >
      {children}
    </div>
  );
}

const SHIMMER_WIDTHS = ["58%", "42%", "50%"];

/** Placeholder rows for a slow listing; renders nothing for fast loads to avoid a flash. */
function LoadingRows({ depth }: { depth: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHIMMER_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div aria-hidden>
      {SHIMMER_WIDTHS.map((width) => (
        <div
          key={width}
          style={{ paddingLeft: indentOf(depth) }}
          className="flex h-6 items-center gap-1.5 pr-2 transition-opacity duration-300 ease-out-quint starting:opacity-0"
        >
          <span className="skeleton size-3 shrink-0 animate-skeleton rounded-sm" />
          <span className="skeleton h-2 animate-skeleton rounded-full" style={{ width }} />
        </div>
      ))}
    </div>
  );
}

import { memo, useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { DirEntry } from "@/shared/lib/ipc";
import { cn } from "@/shared/ui/cn";
import { FileIcon } from "./FileIcon";
import { indentOf, ROW_HEIGHT, SLOT } from "./treeLayout";
import type { VisibleNode } from "./treeModel";

/** Loading placeholders appear only if a listing takes longer than this. */
const SHIMMER_DELAY_MS = 150;

/** Callbacks shared by every row. Stable for the lifetime of the tree, so memoised rows never re-render because of them. */
export interface RowActions {
  activate: (entry: DirEntry) => void;
  onRowFocus: (path: string) => void;
  registerRow: (path: string, el: HTMLElement | null) => void;
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
export const TreeItem = memo(function TreeItem({
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
export const StatusRow = memo(function StatusRow({
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
export function LoadingRow({ top, depth, brightGuides }: LineProps) {
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

import { useState, type KeyboardEvent } from "react";
import { ChevronRight, Folder, FolderOpen, FolderSearch } from "lucide-react";
import { ipc, type DirEntry } from "@/shared/lib/ipc";
import { basename } from "@/shared/lib/path";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useEditorStore } from "@/features/editor/store";
import { EmptyState } from "@/shared/ui/EmptyState";
import { PanelHeader } from "@/shared/ui/PanelHeader";
import { cn } from "@/shared/ui/cn";
import { FileIcon } from "./FileIcon";
import { useDirectory } from "./useDirectory";

const ROW_PADDING = 8;
const INDENT = 12;

const indent = (depth: number) => ({ paddingLeft: ROW_PADDING + depth * INDENT });

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
          action={
            <button
              type="button"
              onClick={onOpenFolder}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border-strong bg-elevated px-3 text-[12px] font-medium text-fg transition-colors duration-150 hover:bg-hover"
            >
              <FolderOpen size={14} strokeWidth={1.75} aria-hidden />
              Klasör aç
            </button>
          }
        />
      )}
    </div>
  );
}

function TreeRoot({ root }: { root: string }) {
  const { entries, error } = useDirectory(root, true);

  // Up/Down move focus between visible rows; each row handles Enter/Space/Left/Right itself.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=treeitem]"));
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const next = rows[e.key === "ArrowDown" ? index + 1 : Math.max(index - 1, 0)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  return (
    <div
      role="tree"
      aria-label={basename(root)}
      onKeyDown={onKeyDown}
      className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3"
    >
      {error && <RowError message={error} depth={0} />}
      {entries?.map((entry) => (
        <TreeNode key={entry.path} entry={entry} depth={0} />
      ))}
    </div>
  );
}

function TreeNode({ entry, depth }: { entry: DirEntry; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const { entries, error: listError } = useDirectory(entry.path, entry.isDir && expanded);
  const active = useEditorStore((s) => s.activePath === entry.path);
  const openFile = useEditorStore((s) => s.openFile);

  const error = entry.isDir ? (expanded ? listError : null) : readError;
  const errorId = `tree-error-${entry.path}`;

  const activate = () => {
    if (entry.isDir) {
      setExpanded((v) => !v);
      return;
    }
    ipc.readFile(entry.path).then(
      (content) => {
        setReadError(null);
        openFile(entry.path, content);
      },
      (err: unknown) => setReadError(String(err)),
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    } else if (entry.isDir && e.key === "ArrowRight" && !expanded) {
      e.preventDefault();
      setExpanded(true);
    } else if (entry.isDir && e.key === "ArrowLeft" && expanded) {
      e.preventDefault();
      setExpanded(false);
    }
  };

  const FolderIcon = expanded ? FolderOpen : Folder;

  return (
    <>
      <div
        role="treeitem"
        tabIndex={0}
        aria-level={depth + 1}
        aria-expanded={entry.isDir ? expanded : undefined}
        aria-selected={entry.isDir ? undefined : active}
        aria-describedby={error ? errorId : undefined}
        title={entry.path}
        onClick={activate}
        onKeyDown={onKeyDown}
        style={indent(depth)}
        className={cn(
          "flex h-6 items-center gap-1.5 rounded-sm pr-2 transition-colors duration-150",
          active ? "bg-elevated text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
        )}
      >
        {entry.isDir ? (
          <ChevronRight
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              "shrink-0 text-fg-subtle transition-transform duration-150",
              expanded && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden />
        )}
        {entry.isDir ? (
          <FolderIcon
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-fg-subtle"
            aria-hidden
          />
        ) : (
          <FileIcon name={entry.name} />
        )}
        <span className="truncate">{entry.name}</span>
      </div>
      {error && <RowError id={errorId} message={error} depth={depth + 1} />}
      {entry.isDir &&
        expanded &&
        entries?.map((child) => <TreeNode key={child.path} entry={child} depth={depth + 1} />)}
    </>
  );
}

function RowError({ id, message, depth }: { id?: string; message: string; depth: number }) {
  return (
    <div
      id={id}
      role="none"
      style={indent(depth)}
      className="py-1 pr-2 text-xs leading-snug break-words text-danger select-text"
    >
      {message}
    </div>
  );
}

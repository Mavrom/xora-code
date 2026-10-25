import { CircleAlert } from "lucide-react";
import { useWorkspaceStore } from "@/features/workspace/store";
import { extname } from "@/shared/lib/path";

interface EditorStatusBarProps {
  path: string | null;
  /** Transient error (e.g. a failed save); replaces the path on the left. */
  error?: string | null;
  cursor?: { line: number; column: number } | null;
}

/** Path relative to the open folder, with forward slashes. */
function displayPath(path: string, root: string | null) {
  const normalized = path.replace(/\\/g, "/");
  if (!root) return normalized;
  const prefix = root.replace(/\\/g, "/").replace(/\/$/, "") + "/";
  return normalized.toLowerCase().startsWith(prefix.toLowerCase())
    ? normalized.slice(prefix.length)
    : normalized;
}

export function EditorStatusBar({ path, error, cursor }: EditorStatusBarProps) {
  const root = useWorkspaceStore((s) => s.root);
  const ext = path ? extname(path).toUpperCase() : "";

  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-border bg-surface px-3 text-[11px]">
      <div className="flex min-w-0 items-center" role="status" aria-live="polite">
        {error ? (
          <span className="flex min-w-0 items-center gap-1.5 text-danger">
            <CircleAlert size={12} strokeWidth={2} className="shrink-0" aria-hidden />
            <span className="truncate">{error}</span>
          </span>
        ) : (
          path && <span className="truncate text-fg-subtle">{displayPath(path, root)}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 font-mono text-[10.5px] text-fg-subtle tabular-nums">
        {cursor && (
          <span>
            Ln {cursor.line}, Col {cursor.column}
          </span>
        )}
        {ext && <span className="tracking-wide">{ext}</span>}
      </div>
    </div>
  );
}

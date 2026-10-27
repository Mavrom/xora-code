import { CircleAlert, RotateCcw } from "lucide-react";
import { ipc } from "@/shared/lib/ipc";
import { useWorkspaceStore } from "@/features/workspace/store";
import { describeFsError } from "@/features/files/fsErrors";
import { extname } from "@/shared/lib/path";
import { useEditorStore } from "./store";
import { t } from "@/shared/i18n";

interface EditorStatusBarProps {
  path: string | null;
  /** Transient save failure; replaces the path on the left. */
  error?: string | null;
  cursor?: { line: number; column: number } | null;
  /** The file changed or vanished on disk while the tab had unsaved edits. */
  diskChanged?: boolean;
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

/** Drops the tab's edits for the file's current disk content ("Diskten yükle"). */
async function reloadFromDisk(path: string) {
  try {
    const content = await ipc.readFile(path);
    useEditorStore.getState().reloadContent(path, content);
  } catch (err) {
    useEditorStore.getState().setSaveError({ path, message: describeFsError(err) });
  }
}

/** One calm line: path (or a message) on the left, `line:column` and language on the right. */
export function EditorStatusBar({ path, error, cursor, diskChanged }: EditorStatusBarProps) {
  const root = useWorkspaceStore((s) => s.root);
  const ext = path ? extname(path).toUpperCase() : "";

  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-white/[0.05] px-3 text-2xs">
      <div className="flex min-w-0 items-center gap-3" role="status" aria-live="polite">
        {error ? (
          <span className="flex min-w-0 items-center gap-1.5 text-danger">
            <CircleAlert size={12} strokeWidth={2} className="shrink-0" aria-hidden />
            <span className="truncate">Kaydedilemedi: {error}</span>
          </span>
        ) : diskChanged && path ? (
          <span className="flex min-w-0 items-center gap-1.5 text-warning">
            <CircleAlert size={12} strokeWidth={2} className="shrink-0" aria-hidden />
            <span className="truncate" title={t("Saving overwrites the version on disk.")}>
              {t("Changed on disk; saving overwrites the version on disk.")}
            </span>
            <button
              type="button"
              onClick={() => void reloadFromDisk(path)}
              className="inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-fg-muted transition-colors duration-fast hover:bg-hover hover:text-fg"
            >
              <RotateCcw size={11} strokeWidth={2} aria-hidden />
              {t("Load from disk")}
            </button>
          </span>
        ) : (
          path && <span className="truncate text-fg-subtle">{displayPath(path, root)}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-fg-subtle tabular-nums">
        {cursor && (
          <span>
            <span className="sr-only">
              {t("Line {line}, column {column}", { line: cursor.line, column: cursor.column })}
            </span>
            <span aria-hidden>
              {cursor.line}:{cursor.column}
            </span>
          </span>
        )}
        {ext && <span className="tracking-wide">{ext}</span>}
      </div>
    </div>
  );
}

// A diff tab's body: Monaco's diff editor (old text left, new text right, read-only) and a
// status line with the +/− figures, previous / next change and "open file". Part of the
// lazily loaded editor panel, like the code editor.
import { useEffect, useMemo, useRef } from "react";
import * as monaco from "monaco-editor";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { DiffStat } from "@/features/chat/DiffPreview";
import { diffLines, diffStats } from "@/features/chat/diff";
import { revealInEditor } from "@/features/chat/editorBridge";
import { isPaletteOpen } from "@/features/commands/paletteGuard";
import { useWorkspaceStore } from "@/features/workspace/store";
import { IconButton } from "@/shared/ui/IconButton";
import { displayPath } from "./displayPath";
import { registerEditorFocus, registerEditorSelection } from "./editorFocus";
import { DIFF_NEXT_SHORTCUT, DIFF_PREVIOUS_SHORTCUT, diffNavigation, isShown } from "./editorKeys";
import { diffOptionsFor } from "./editorOptions";
import { useEditorSettings } from "./editorSettings";
import { XORA_THEME } from "./monaco/theme";
import { t } from "@/shared/i18n";

interface DiffViewProps {
  /** The compared file (absolute path). */
  file: string;
  /** Left side; `null` for a new file. */
  oldText: string | null;
  newText: string;
}

/** Diff models get fresh URIs per content, so a refresh never collides with the old pair. */
let generation = 0;

/**
 * Model URI for one side of a diff. Its own scheme keeps it apart from the file's editor
 * model (and out of the panel's file model cleanup); the path keeps language detection.
 */
const diffUri = (file: string, side: "original" | "modified", n: number) =>
  monaco.Uri.file(file).with({ scheme: "xora-diff", query: `${side}-${n}` });

export function DiffView({ file, oldText, newText }: DiffViewProps) {
  const settings = useEditorSettings();
  const options = useMemo(() => diffOptionsFor(settings), [settings]);
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const root = useWorkspaceStore((s) => s.root);
  const stats = useMemo(() => diffStats(diffLines(oldText, newText)), [oldText, newText]);

  // One diff editor per mounted view. Disposing the editor first, then its models, is the
  // order Monaco expects (a model disposed under a live diff editor throws).
  useEffect(() => {
    if (!host.current) return;
    const editor = monaco.editor.createDiffEditor(host.current, {
      theme: XORA_THEME,
      automaticLayout: true,
      readOnly: true,
    });
    editorRef.current = editor;
    registerEditorFocus(() => editor.getModifiedEditor().focus());
    registerEditorSelection(null);
    return () => {
      registerEditorFocus(null);
      const model = editor.getModel();
      editor.dispose();
      model?.original.dispose();
      model?.modified.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => editorRef.current?.updateOptions(options), [options]);

  // New content (first show, or the same file's diff opened again): swap in a fresh model
  // pair, drop the previous one and land on the first change.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const previous = editor.getModel();
    const n = ++generation;
    editor.setModel({
      original: monaco.editor.createModel(oldText ?? "", undefined, diffUri(file, "original", n)),
      modified: monaco.editor.createModel(newText, undefined, diffUri(file, "modified", n)),
    });
    previous?.original.dispose();
    previous?.modified.dispose();
    editor.revealFirstDiff();
  }, [file, oldText, newText]);

  const goTo = (target: "next" | "previous") => editorRef.current?.goToDiff(target);

  // Alt+F5 / Shift+Alt+F5 while this view is on screen, wherever focus is.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = diffNavigation(e);
      if (!target || e.defaultPrevented || isPaletteOpen() || !isShown(host.current)) return;
      e.preventDefault();
      editorRef.current?.goToDiff(target);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  /** The real file, at the change the cursor is on (the first one until moved). */
  const openFile = () => {
    const line = editorRef.current?.getModifiedEditor().getPosition()?.lineNumber ?? 1;
    revealInEditor(file, line);
  };

  const unchanged = stats.added === 0 && stats.removed === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={host} className="min-h-0 flex-1" />
      <div className="flex h-7 shrink-0 items-center justify-between gap-4 border-t border-white/[0.05] pr-1 pl-3 text-2xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-fg-subtle" title={file}>
            {displayPath(file, root)}
          </span>
          {oldText === null && <span className="shrink-0 text-fg-subtle">{t("new")}</span>}
          {unchanged ? (
            <span className="shrink-0 text-fg-subtle">{t("No line changes.")}</span>
          ) : (
            <DiffStat {...stats} />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            size="sm"
            icon={ChevronUp}
            label={t("Previous change")}
            shortcut={DIFF_PREVIOUS_SHORTCUT}
            disabled={unchanged}
            onClick={() => goTo("previous")}
          />
          <IconButton
            size="sm"
            icon={ChevronDown}
            label={t("Next change")}
            shortcut={DIFF_NEXT_SHORTCUT}
            disabled={unchanged}
            onClick={() => goTo("next")}
          />
          <button
            type="button"
            onClick={openFile}
            className="ml-1 inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-fg-muted transition-colors duration-fast hover:bg-hover hover:text-fg"
          >
            <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
            {t("Open file")}
          </button>
        </div>
      </div>
    </div>
  );
}

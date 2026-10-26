// Side effect: local Monaco workers + xora-onyx theme. This module is lazy-loaded, so Monaco
// stays out of the startup bundle.
import "./monaco/setup";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Editor, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { FileCode } from "lucide-react";
import { EmptyState } from "@/shared/ui/EmptyState";
import { onCommand, SAVE_ACTIVE_FILE } from "@/features/commands/events";
import { isPaletteOpen } from "@/features/commands/paletteGuard";
import { registerEditorFocus } from "./editorFocus";
import { isSaveShortcut } from "./editorKeys";
import { lineHeightFor, useEditorSettings, type EditorSettings } from "./editorSettings";
import { XORA_THEME } from "./monaco/theme";
import { saveActiveTab } from "./saveActiveTab";
import { useEditorStore } from "./store";
import { EditorStatusBar } from "./EditorStatusBar";
import { EditorTabs } from "./EditorTabs";

/** A failed save stays in the status bar this long (or until the next save). */
const ERROR_MS = 4000;
const FONT = "JetBrains Mono Variable";

/** Fixed chrome options; the user-tunable ones come from {@link optionsFor}. */
const BASE_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontFamily: `"${FONT}", ui-monospace, monospace`,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorSmoothCaretAnimation: "on",
  padding: { top: 12 },
  renderLineHighlight: "line",
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: { useShadows: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
};

function optionsFor(s: EditorSettings): monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    ...BASE_OPTIONS,
    fontSize: s.fontSize,
    lineHeight: lineHeightFor(s.fontSize),
    fontLigatures: s.ligatures,
    minimap: { enabled: s.minimap },
    wordWrap: s.wordWrap ? "on" : "off",
    renderWhitespace: s.renderWhitespace,
    tabSize: s.tabSize,
    // Files keep their own indentation; the setting is the fallback for new lines.
    detectIndentation: true,
  };
}

/** Model URI for a file path; a proper file URI keeps Windows drive letters intact. */
const modelPath = (path: string) => monaco.Uri.file(path).toString();

type Cursor = { line: number; column: number };

export function EditorPanel() {
  const tabs = useEditorStore((s) => s.tabs);
  const active = useEditorStore((s) => s.tabs.find((t) => t.path === s.activePath) ?? null);
  const saveError = useEditorStore((s) => s.saveError);
  const updateContent = useEditorStore((s) => s.updateContent);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const settings = useEditorSettings();
  const options = useMemo(() => optionsFor(settings), [settings]);

  const save = useCallback(() => void saveActiveTab(), []);

  // A failed save is shown for a while, then the status bar returns to the path.
  useEffect(() => {
    if (!saveError) return;
    const timer = window.setTimeout(() => {
      if (useEditorStore.getState().saveError === saveError) {
        useEditorStore.getState().setSaveError(null);
      }
    }, ERROR_MS);
    return () => window.clearTimeout(timer);
  }, [saveError]);

  // "Aktif dosyayı kaydet" from the command palette.
  useEffect(() => onCommand(SAVE_ACTIVE_FILE, save), [save]);

  // Ctrl+S also works while focus is outside Monaco (tab strip, status bar).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isPaletteOpen() || !isSaveShortcut(e)) return;
      e.preventDefault();
      save();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  // Dispose models of closed tabs so reopening a file reads fresh disk content.
  useEffect(() => {
    const open = new Set(tabs.map((t) => modelPath(t.path)));
    for (const model of monaco.editor.getModels()) {
      if (model.uri.scheme === "file" && !open.has(model.uri.toString())) model.dispose();
    }
  }, [tabs]);

  useEffect(() => () => registerEditorFocus(null), []);

  const onMount: OnMount = (editor, m) => {
    editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, save);
    const syncCursor = () => {
      const position = editor.getPosition();
      setCursor(position ? { line: position.lineNumber, column: position.column } : null);
    };
    editor.onDidChangeCursorPosition(syncCursor);
    // Switching tabs swaps the model; its own saved cursor is restored, so read it again.
    editor.onDidChangeModel(syncCursor);
    syncCursor();
    registerEditorFocus(() => editor.focus());
    // Monaco measures glyphs once; re-measure after the web font actually arrives.
    void document.fonts.load(`13px "${FONT}"`).then(() => m.editor.remeasureFonts());
    editor.focus();
  };

  // Edits always belong to the active tab: the editor only ever shows its model.
  const onChange = useCallback(
    (value: string | undefined) => {
      const path = useEditorStore.getState().activePath;
      if (path) updateContent(path, value ?? "");
    },
    [updateContent],
  );

  if (!active) {
    return (
      <EmptyState icon={FileCode} title="Açık dosya yok" description="Gezgin'den bir dosya seç." />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorTabs />
      <div className="min-h-0 flex-1">
        <Editor
          theme={XORA_THEME}
          path={modelPath(active.path)}
          value={active.content}
          onChange={onChange}
          onMount={onMount}
          options={options}
          loading={null}
        />
      </div>
      <EditorStatusBar
        path={active.path}
        error={saveError?.path === active.path ? saveError.message : null}
        cursor={cursor}
        diskChanged={!!active.diskChanged}
      />
    </div>
  );
}

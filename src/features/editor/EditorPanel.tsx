// Side effect: local Monaco workers + xora-onyx theme. This module is lazy-loaded, so Monaco
// stays out of the startup bundle.
import "./monaco/setup";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { FileCode } from "lucide-react";
import { EmptyState } from "@/shared/ui/EmptyState";
import { onCommand, SAVE_ACTIVE_FILE, sendToChat } from "@/features/commands/events";
import { useWorkspaceStore } from "@/features/workspace/store";
import { chatSnippet } from "./chatSnippet";
import { isPaletteOpen } from "@/features/commands/paletteGuard";
import { registerEditorFocus, registerEditorSelection } from "./editorFocus";
import { isSaveShortcut } from "./editorKeys";
import { monacoKeybindings } from "@/features/keymap/keymap";
import { formatOnSave, useEditorSettings } from "./editorSettings";
import { EDITOR_FONT, editorOptionsFor } from "./editorOptions";
import { XORA_THEME } from "./monaco/theme";
import { saveOnFocusChange } from "./autoSave";
import { saveActiveTab } from "./saveActiveTab";
import { isDiffTab, useEditorStore } from "./store";
import { editorFileTab, fileKey, fileTabPaths, isDiffKey, tabFile } from "./tabKind";
import { DiffView } from "./DiffView";
import { EditorStatusBar } from "./EditorStatusBar";
import { EditorTabs } from "./EditorTabs";
import { t } from "@/shared/i18n";
import { cn } from "@/shared/ui/cn";

/** A failed save stays in the status bar this long (or until the next save). */
const ERROR_MS = 4000;

/** Model URI for a file path; a proper file URI keeps Windows drive letters intact. */
const modelPath = (path: string) => monaco.Uri.file(path).toString();

/** Selects the store's pending reveal once the editor shows its file, then clears it. */
function applyReveal(editor: monaco.editor.IStandaloneCodeEditor | null) {
  const { reveal, setReveal } = useEditorStore.getState();
  const model = editor?.getModel();
  if (!editor || !reveal || !model || model.uri.toString() !== modelPath(reveal.path)) return;
  const { line, column, endLine, endColumn } = reveal.range;
  // The file may have changed since the position was found; clamp it to the text.
  const range = model.validateRange(new monaco.Range(line, column, endLine, endColumn));
  editor.setSelection(range);
  editor.revealRangeInCenterIfOutsideViewport(range, monaco.editor.ScrollType.Immediate);
  editor.focus();
  setReveal(null);
}

/** The selected text when the editor has focus and the selection is one non-empty line. */
function singleLineSelection(editor: monaco.editor.IStandaloneCodeEditor): string | null {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!editor.hasTextFocus() || !model || !selection || selection.isEmpty()) return null;
  if (selection.startLineNumber !== selection.endLineNumber) return null;
  return model.getValueInRange(selection);
}

type Cursor = { line: number; column: number };

export function EditorPanel() {
  const tabs = useEditorStore((s) => s.tabs);
  const active = useEditorStore((s) => s.tabs.find((item) => item.path === s.activePath) ?? null);
  const saveError = useEditorStore((s) => s.saveError);
  const updateContent = useEditorStore((s) => s.updateContent);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const settings = useEditorSettings();
  const options = useMemo(() => editorOptionsFor(settings), [settings]);
  const activePath = active?.path ?? null;
  // A diff tab shows over the code editor, which stays mounted (hidden) with a file tab's
  // model, so switching back keeps undo history and view state.
  const diffTab = active && isDiffTab(active) ? active : null;
  const fileTab = useMemo(() => editorFileTab(tabs, activePath), [tabs, activePath]);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // Format on save (Settings > Editör): only when the shown model is the tab being saved
  // and its language has a formatter; a formatter failure never blocks the save.
  // A diff tab is read-only: nothing to format or save.
  const save = useCallback(() => {
    if (isDiffKey(useEditorStore.getState().activePath)) return;
    const editor = editorRef.current;
    const format = formatOnSave() ? editor?.getAction("editor.action.formatDocument") : null;
    const run = format?.isSupported() ? format.run().catch(() => undefined) : Promise.resolve();
    void run.then(() => saveActiveTab());
  }, []);

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

  // Dispose models of closed tabs so reopening a file reads fresh disk content. (Diff tabs
  // own their models under another scheme; DiffView disposes those.)
  useEffect(() => {
    const open = new Set(fileTabPaths(tabs).map(modelPath));
    for (const model of monaco.editor.getModels()) {
      if (model.uri.scheme === "file" && !open.has(model.uri.toString())) model.dispose();
    }
  }, [tabs]);

  useEffect(
    () => () => {
      registerEditorFocus(null);
      registerEditorSelection(null);
    },
    [],
  );

  // A search result or tool call link asked for a position: apply it once its tab shows.
  // The Editor child swaps the model in its own effect, which runs before this one.
  const reveal = useEditorStore((s) => s.reveal);
  useEffect(() => {
    if (!isDiffKey(activePath)) applyReveal(editorRef.current);
  }, [reveal, activePath]);

  // Back from a diff tab: focus requests and the selection reader go to the code editor
  // again (DiffView took them while it was shown and dropped them on unmount).
  const showingDiff = diffTab !== null;
  useEffect(() => {
    const editor = editorRef.current;
    if (showingDiff || !editor) return;
    registerEditorFocus(() => editor.focus());
    registerEditorSelection(() => singleLineSelection(editor));
  }, [showingDiff]);

  const onMount: OnMount = (editor, m) => {
    editorRef.current = editor;
    for (const keybinding of monacoKeybindings("editor.save", m))
      editor.addCommand(keybinding, save);
    const syncCursor = () => {
      const position = editor.getPosition();
      setCursor(position ? { line: position.lineNumber, column: position.column } : null);
    };
    editor.onDidChangeCursorPosition(syncCursor);
    // Switching tabs swaps the model; its own saved cursor is restored, so read it again.
    editor.onDidChangeModel(syncCursor);
    // Ctrl+L by default (also in the right-click menu): the selection, or the current line,
    // goes to the chat composer with its place, ready for a question.
    editor.addAction({
      id: "xora.addToChat",
      label: t("Add selection to chat"),
      keybindings: monacoKeybindings("editor.addToChat", m),
      contextMenuGroupId: "navigation",
      contextMenuOrder: 0,
      run: (ed) => {
        const model = ed.getModel();
        const selection = ed.getSelection();
        const path = fileKey(useEditorStore.getState().activePath);
        if (!model || !selection || !path) return;
        const whole = selection.isEmpty();
        const startLine = selection.startLineNumber;
        // A selection ending at column 1 of a line does not include that line.
        const endLine =
          !whole && selection.endColumn === 1 && selection.endLineNumber > startLine
            ? selection.endLineNumber - 1
            : selection.endLineNumber;
        const code = whole ? model.getLineContent(startLine) : model.getValueInRange(selection);
        if (!code.trim()) return;
        sendToChat(
          chatSnippet({
            path,
            root: useWorkspaceStore.getState().root,
            startLine,
            endLine,
            language: model.getLanguageId(),
            code,
          }),
          { append: true },
        );
      },
    });
    // Settings > Editör > Otomatik kaydet: "Odak değişince".
    editor.onDidBlurEditorText(saveOnFocusChange);
    syncCursor();
    // Monaco measures glyphs once; re-measure after the web font actually arrives.
    void document.fonts.load(`13px "${EDITOR_FONT}"`).then(() => m.editor.remeasureFonts());
    // Mounted hidden behind a diff tab: the diff view keeps focus and its registration.
    if (isDiffKey(useEditorStore.getState().activePath)) return;
    registerEditorFocus(() => editor.focus());
    registerEditorSelection(() => singleLineSelection(editor));
    editor.focus();
    // The first file opened from a search result: Monaco mounts after the reveal was asked.
    applyReveal(editor);
  };

  // Edits always belong to the active tab: the editor only ever shows its model (the store
  // ignores a diff tab's key, should a hidden editor ever report a change).
  const onChange = useCallback(
    (value: string | undefined) => {
      const path = useEditorStore.getState().activePath;
      if (path) updateContent(path, value ?? "");
    },
    [updateContent],
  );

  if (!active) {
    return (
      <EmptyState
        icon={FileCode}
        title={t("No open file")}
        description={t("Pick a file from the Files panel.")}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorTabs />
      {fileTab && (
        <div className={cn("flex min-h-0 flex-1 flex-col", diffTab && "hidden")}>
          <div className="min-h-0 flex-1">
            <Editor
              theme={XORA_THEME}
              path={modelPath(fileTab.path)}
              value={fileTab.content}
              onChange={onChange}
              onMount={onMount}
              options={options}
              loading={null}
            />
          </div>
          <EditorStatusBar
            path={fileTab.path}
            error={saveError?.path === fileTab.path ? saveError.message : null}
            cursor={cursor}
            diskChanged={!!fileTab.diskChanged}
          />
        </div>
      )}
      {diffTab && (
        <DiffView
          key={diffTab.path}
          file={tabFile(diffTab.path)}
          oldText={diffTab.diff.oldText}
          newText={diffTab.diff.newText}
        />
      )}
    </div>
  );
}

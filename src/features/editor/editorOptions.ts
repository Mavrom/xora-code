// Monaco options for the code editor and the diff tab, from the user's editor settings.
// Type-only Monaco import: this stays loadable in tests and outside the lazy panel.
import type * as monaco from "monaco-editor";
import { lineHeightFor, type EditorSettings } from "./editorSettings";

export const EDITOR_FONT = "JetBrains Mono Variable";

/** Fixed chrome options; the user-tunable ones come from {@link editorOptionsFor}. */
const BASE_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontFamily: `"${EDITOR_FONT}", ui-monospace, monospace`,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorSmoothCaretAnimation: "on",
  padding: { top: 12 },
  renderLineHighlight: "line",
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: { useShadows: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  // "Ambiguous character" boxes flag ordinary Turkish letters (ı, İ) in strings and comments.
  unicodeHighlight: { ambiguousCharacters: false },
};

export function editorOptionsFor(
  s: EditorSettings,
): monaco.editor.IStandaloneEditorConstructionOptions {
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
    lineNumbers: s.lineNumbers,
    cursorStyle: s.cursorStyle === "underline" ? "underline" : s.cursorStyle,
    stickyScroll: { enabled: s.stickyScroll },
    bracketPairColorization: { enabled: s.bracketColors },
    guides: { bracketPairs: s.bracketColors ? "active" : false },
  };
}

/**
 * The diff tab: same font and display settings, but read-only on both sides, side by side
 * until the card is narrower than Monaco's breakpoint (then inline), unchanged stretches
 * folded away, and no minimap.
 */
export function diffOptionsFor(s: EditorSettings): monaco.editor.IDiffEditorOptions {
  return {
    ...editorOptionsFor(s),
    readOnly: true,
    originalEditable: false,
    renderSideBySide: true,
    useInlineViewWhenSpaceIsLimited: true,
    hideUnchangedRegions: { enabled: true },
    minimap: { enabled: false },
    // Whitespace edits count, as in the chat's +/− figures for the same change.
    ignoreTrimWhitespace: false,
    // Nothing to revert or stage from here; keep the gutter plain.
    renderMarginRevertIcon: false,
    renderGutterMenu: false,
    renderOverviewRuler: true,
    diffWordWrap: "inherit",
  };
}

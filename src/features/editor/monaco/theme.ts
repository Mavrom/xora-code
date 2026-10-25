import type * as Monaco from "monaco-editor";

export const XORA_THEME = "xora-onyx";

/** Registers the monochrome "xora-onyx" theme; colours mirror the design tokens. */
export function defineXoraTheme(m: typeof Monaco) {
  m.editor.defineTheme(XORA_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b6b6b", fontStyle: "italic" },
      { token: "keyword", foreground: "c8c8c8" },
      { token: "string", foreground: "a5c9a1" },
      { token: "number", foreground: "d7b98c" },
      { token: "type", foreground: "9fb8d6" },
      { token: "function", foreground: "e6e6e6" },
    ],
    colors: {
      "editor.background": "#000000",
      "editor.lineHighlightBackground": "#0a0a0a",
      "editorLineNumber.foreground": "#3a3a3a",
      "editorLineNumber.activeForeground": "#a1a1a1",
      "editor.selectionBackground": "#ffffff1f",
      "editorCursor.foreground": "#ededed",
      "editorIndentGuide.background1": "#1c1c1c",
      "editorWidget.background": "#0a0a0a",
      "editorWidget.border": "#2a2a2a",
      "scrollbarSlider.background": "#2a2a2a80",
    },
  });
}

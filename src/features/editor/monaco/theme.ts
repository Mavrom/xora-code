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
      // Override vs-dark's saturated defaults so every language stays on the calm palette.
      { token: "keyword.flow", foreground: "c8c8c8" },
      { token: "variable", foreground: "d4d4d4" },
      { token: "variable.parameter", foreground: "d4d4d4" },
      { token: "variable.predefined", foreground: "9fb8d6" },
      { token: "constant", foreground: "d7b98c" },
      { token: "number.hex", foreground: "d7b98c" },
      { token: "regexp", foreground: "d7b98c" },
      { token: "annotation", foreground: "9fb8d6" },
      { token: "delimiter", foreground: "a1a1a1" },
      { token: "tag", foreground: "9fb8d6" },
      { token: "metatag", foreground: "9fb8d6" },
      { token: "attribute.name", foreground: "c8c8c8" },
      { token: "attribute.value", foreground: "a5c9a1" },
      { token: "key", foreground: "c8c8c8" },
      { token: "string.key.json", foreground: "c8c8c8" },
      { token: "string.value.json", foreground: "a5c9a1" },
      { token: "keyword.json", foreground: "d7b98c" },
      // Markdown: headings and emphasis carry weight, not colour.
      { token: "keyword.md", foreground: "ededed", fontStyle: "bold" },
      { token: "strong.md", fontStyle: "bold" },
      { token: "emphasis.md", fontStyle: "italic" },
      { token: "string.link.md", foreground: "9fb8d6" },
      { token: "variable.md", foreground: "a1a1a1" },
      { token: "variable.source.md", foreground: "a5c9a1" },
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
      "editor.wordHighlightBackground": "#ffffff0f",
      "editor.wordHighlightStrongBackground": "#ffffff14",
      "editorBracketMatch.background": "#ffffff0f",
      "editorBracketMatch.border": "#ffffff33",
      // Bracket pair colourisation stays on, but in one quiet tone instead of gold/purple/blue.
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6].map((n) => [`editorBracketHighlight.foreground${n}`, "#a1a1a1"]),
      ),
      "editorBracketHighlight.unexpectedBracket.foreground": "#f87171",
    },
  });
}

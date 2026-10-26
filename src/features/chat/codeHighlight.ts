// Lazy syntax colouring for finished code blocks, reusing the Monaco bundle the editor already
// ships (no second highlighter). Monaco loads on the first code block, never at startup.
import type * as Monaco from "monaco-editor";

type MonacoModule = typeof Monaco;

let monacoReady: Promise<MonacoModule> | null = null;

function loadMonaco(): Promise<MonacoModule> {
  monacoReady ??= Promise.all([
    import("monaco-editor"),
    import("@/features/editor/monaco/theme"),
    // Registers workers and the onyx theme exactly as the editor does.
    import("@/features/editor/monaco/setup"),
  ]).then(([monaco, theme]) => {
    monaco.editor.setTheme(theme.XORA_THEME);
    return monaco;
  });
  return monacoReady;
}

/** Monaco language id for a fence tag ("ts", "rust", "yml", ".py"), or null. */
function resolveLanguage(monaco: MonacoModule, tag: string): string | null {
  const wanted = tag.toLowerCase().replace(/^\./, "");
  if (!wanted) return null;
  for (const language of monaco.languages.getLanguages()) {
    if (
      language.id === wanted ||
      language.aliases?.some((alias) => alias.toLowerCase() === wanted) ||
      language.extensions?.includes(`.${wanted}`)
    ) {
      return language.id;
    }
  }
  return null;
}

/** Colours every not-yet-coloured `.md-code` block inside `root`. Errors leave plain text. */
export async function highlightCodeBlocks(root: HTMLElement): Promise<void> {
  const blocks = root.querySelectorAll<HTMLElement>(".md-code[data-lang]:not([data-colored])");
  if (blocks.length === 0) return;
  const pending = [...blocks].filter((block) => block.dataset.lang);
  if (pending.length === 0) return;

  const monaco = await loadMonaco();
  for (const block of pending) {
    const code = block.querySelector("code");
    const language = resolveLanguage(monaco, block.dataset.lang ?? "");
    block.dataset.colored = "";
    if (!code || !language) continue;
    try {
      code.innerHTML = await monaco.editor.colorize(code.textContent ?? "", language, {
        tabSize: 2,
      });
    } catch {
      // Unknown grammar or a tokenizer hiccup: the escaped plain text stays.
    }
  }
}

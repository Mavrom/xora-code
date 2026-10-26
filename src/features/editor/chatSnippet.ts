// Ctrl+L in the editor: the selection (or the current line) goes to the chat composer as
// a fenced block headed by its place, e.g. "src/app/Layout.tsx:12-20".

/** Fence language for a Monaco language id; plain text needs none. */
const FENCE: Record<string, string> = { typescript: "ts", javascript: "js", plaintext: "" };

/** Path shown in the header: relative to the open folder when inside it, `/`-separated. */
export function displayPath(path: string, root: string | null): string {
  const norm = (p: string) => p.replace(/\\/g, "/");
  const full = norm(path);
  if (root) {
    const base = norm(root).replace(/\/+$/, "") + "/";
    if (full.toLowerCase().startsWith(base.toLowerCase())) return full.slice(base.length);
  }
  return full;
}

export function chatSnippet(opts: {
  path: string;
  root: string | null;
  startLine: number;
  endLine: number;
  language: string;
  code: string;
}): string {
  const lines =
    opts.startLine === opts.endLine ? `${opts.startLine}` : `${opts.startLine}-${opts.endLine}`;
  const fence = FENCE[opts.language] ?? opts.language;
  // A longer fence than any run of backticks inside keeps the block intact.
  const ticks = "`".repeat(
    Math.max(3, ...[...opts.code.matchAll(/`+/g)].map((m) => m[0].length + 1)),
  );
  const code = opts.code.replace(/\s+$/, "");
  return `\`${displayPath(opts.path, opts.root)}:${lines}\`\n${ticks}${fence}\n${code}\n${ticks}`;
}

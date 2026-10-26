/**
 * `@path` mention for an attached file: relative to the working folder when inside it
 * (what the agent sees as its project), absolute otherwise. Paths with spaces are quoted.
 */
export function mentionFor(path: string, cwd: string | null): string {
  const norm = (p: string) => p.replace(/\\/g, "/");
  let shown = norm(path);
  if (cwd) {
    const root = norm(cwd).replace(/\/+$/, "") + "/";
    if (shown.toLowerCase().startsWith(root.toLowerCase())) shown = shown.slice(root.length);
  }
  return /\s/.test(shown) ? `@"${shown}"` : `@${shown}`;
}

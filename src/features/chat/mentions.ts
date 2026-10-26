/**
 * `@path` mention for an attached file: relative to the working folder when inside it
 * (what the agent sees as its project), absolute otherwise; folders end in `/`. Paths
 * with spaces are quoted.
 */
export function mentionFor(path: string, cwd: string | null, dir = false): string {
  const norm = (p: string) => p.replace(/\\/g, "/");
  let shown = norm(path);
  if (cwd) {
    const root = norm(cwd).replace(/\/+$/, "") + "/";
    if (shown.toLowerCase().startsWith(root.toLowerCase())) shown = shown.slice(root.length);
  }
  // A trailing slash tells the agent it is a folder.
  if (dir && !shown.endsWith("/")) shown += "/";
  return /\s/.test(shown) ? `@"${shown}"` : `@${shown}`;
}

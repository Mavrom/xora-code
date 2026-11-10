/** Path relative to the open folder, with forward slashes (status bars). */
export function displayPath(path: string, root: string | null) {
  const normalized = path.replace(/\\/g, "/");
  if (!root) return normalized;
  const prefix = root.replace(/\\/g, "/").replace(/\/$/, "") + "/";
  return normalized.toLowerCase().startsWith(prefix.toLowerCase())
    ? normalized.slice(prefix.length)
    : normalized;
}

// Current git branch for the composer's context chip, read straight from `.git/HEAD` with the
// existing file read command (no git binary, no new Rust command). Worktrees and submodules
// keep a `.git` *file* that points at the real git dir; that indirection is followed once.

/** Branch name from a HEAD file, or a short commit id when detached; null when unreadable. */
export function parseHead(head: string): string | null {
  const text = head.trim();
  const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(text);
  if (ref) return ref[1].trim();
  if (/^[0-9a-f]{40,64}$/i.test(text)) return text.slice(0, 7);
  return null;
}

/** Target of a `.git` file ("gitdir: ../.git/worktrees/x"), resolved against the repo root. */
export function parseGitdir(dotGit: string, root: string): string | null {
  const match = /^gitdir:\s*(.+)$/m.exec(dotGit.trim());
  if (!match) return null;
  const target = match[1].trim();
  const absolute = /^(?:[a-zA-Z]:[\\/]|[\\/])/.test(target);
  return absolute ? target : `${trimSlash(root)}/${target}`;
}

const trimSlash = (path: string) => path.replace(/[\\/]+$/, "");

/** Reads the branch of the repository at `root`; null for non-repos or on any error. */
export async function readGitBranch(
  root: string,
  readFile: (path: string) => Promise<string>,
): Promise<string | null> {
  const base = trimSlash(root);
  try {
    return parseHead(await readFile(`${base}/.git/HEAD`));
  } catch {
    // `.git` may be a file (worktree, submodule) or missing altogether.
  }
  try {
    const gitdir = parseGitdir(await readFile(`${base}/.git`), base);
    return gitdir ? parseHead(await readFile(`${trimSlash(gitdir)}/HEAD`)) : null;
  } catch {
    return null;
  }
}

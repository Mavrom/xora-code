// Fuzzy file search for quick open (Ctrl+P) and `@` mentions. Tens of thousands of paths
// per keystroke: a cheap linear pass ranks everything, then the palette's exact matcher
// (with highlight positions) re-ranks only the best few hundred.
import { fold, fuzzyMatch } from "@/features/commands/fuzzy";

export interface IndexedFile {
  /** Workspace-relative, `/`-separated. */
  path: string;
  folded: string;
  /** Where the file name starts in `path`. */
  base: number;
}

export interface FileHit {
  path: string;
  /** Matched character indices in `path`, for highlighting. */
  positions: number[];
}

/** How many cheap-pass candidates get the exact (slower) match. */
const RERANK = 300;

export function indexFiles(paths: readonly string[]): IndexedFile[] {
  return paths.map((path) => ({ path, folded: fold(path), base: path.lastIndexOf("/") + 1 }));
}

/** Greedy subsequence check with a rough score; null when `q` is not in `text` in order. */
function quickScore(q: string, file: IndexedFile): number | null {
  const name = file.folded.slice(file.base);
  const inName = name.indexOf(q);
  if (inName !== -1) return 1000 - inName * 4 - name.length;
  const inPath = file.folded.indexOf(q);
  if (inPath !== -1) return 600 - file.folded.length;
  let j = 0;
  let gaps = 0;
  let last = -1;
  for (let i = 0; i < file.folded.length && j < q.length; i++) {
    if (file.folded[i] !== q[j]) continue;
    if (last !== -1 && i !== last + 1) gaps++;
    last = i;
    j++;
  }
  if (j < q.length) return null;
  return 300 - gaps * 10 - file.folded.length / 4 + (last >= file.base ? 50 : 0);
}

/** Best matches for `query`, at most `limit`; an empty query lists the first files. */
export function searchFiles(query: string, files: readonly IndexedFile[], limit = 50): FileHit[] {
  const q = fold(query).replace(/\s+/g, "");
  if (!q) return files.slice(0, limit).map((f) => ({ path: f.path, positions: [] }));

  const rough: { file: IndexedFile; score: number }[] = [];
  for (const file of files) {
    const score = quickScore(q, file);
    if (score !== null) rough.push({ file, score });
  }
  rough.sort((a, b) => b.score - a.score);

  return rough
    .slice(0, RERANK)
    .map(({ file, score }) => {
      // Matching the file name alone is what people mean; fall back to the whole path.
      const name = fuzzyMatch(q, file.path.slice(file.base));
      const match = name
        ? { score: name.score + 20, positions: name.positions.map((p) => p + file.base) }
        : fuzzyMatch(q, file.path);
      return {
        path: file.path,
        positions: match?.positions ?? [],
        score: (match?.score ?? 0) + score / 100,
      };
    })
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
    .slice(0, limit)
    .map(({ path, positions }) => ({ path, positions }));
}

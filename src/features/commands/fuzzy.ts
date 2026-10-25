// Small fuzzy matcher for the command palette: subsequence matching with an optimal
// alignment (tiny DP), rewarding word starts and contiguous runs.

/** Turkish letters fold to their ASCII base so "klasor ac" finds "Klasör aç". */
const FOLD: Record<string, string> = {
  ı: "i",
  İ: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ü: "u",
  Ü: "u",
  ö: "o",
  Ö: "o",
  ç: "c",
  Ç: "c",
  â: "a",
  Â: "a",
  î: "i",
  Î: "i",
  û: "u",
  Û: "u",
};

/** Lowercases and strips diacritics, keeping exactly one output unit per input unit. */
export function fold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const lower = FOLD[ch] ?? ch.toLowerCase();
    out += lower.length === 1 ? lower : ch;
  }
  return out;
}

const MATCH = 1;
const WORD_START = 8;
const TEXT_START = 4;
const CONSECUTIVE = 5;
const GAP = 0.5;
const LEADING = 0.2;

const isWordStart = (raw: string, folded: string, j: number) =>
  j === 0 ||
  !/[a-z0-9]/.test(folded[j - 1]) ||
  (raw[j - 1] !== raw[j - 1].toUpperCase() && raw[j] !== raw[j].toLowerCase());

export interface FuzzyMatch {
  score: number;
  /** Indices into `text` of the matched characters, ascending. */
  positions: number[];
}

/** Best alignment of `query` inside `text`, or null when it is not a subsequence. */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = fold(query).replace(/\s+/g, "");
  if (!q) return { score: 0, positions: [] };
  const t = fold(text);
  const m = q.length;
  const n = t.length;
  if (m > n) return null;

  // best[i][j]: best score with q[i] matched at t[j]; prev[i][j]: where q[i-1] sat.
  const best = Array.from({ length: m }, () => new Array<number>(n).fill(-Infinity));
  const prev = Array.from({ length: m }, () => new Array<number>(n).fill(-1));

  for (let i = 0; i < m; i++) {
    for (let j = i; j < n; j++) {
      if (q[i] !== t[j]) continue;
      const own = MATCH + (isWordStart(text, t, j) ? WORD_START : 0) + (j === 0 ? TEXT_START : 0);
      if (i === 0) {
        best[0][j] = own - LEADING * j;
        continue;
      }
      for (let k = i - 1; k < j; k++) {
        const before = best[i - 1][k];
        if (before === -Infinity) continue;
        const link = k === j - 1 ? CONSECUTIVE : -GAP * (j - k - 1);
        if (before + link + own > best[i][j]) {
          best[i][j] = before + link + own;
          prev[i][j] = k;
        }
      }
    }
  }

  let end = -1;
  let top = -Infinity;
  for (let j = 0; j < n; j++) {
    if (best[m - 1][j] > top) {
      top = best[m - 1][j];
      end = j;
    }
  }
  if (end === -1) return null;

  const positions = new Array<number>(m);
  for (let i = m - 1, j = end; i >= 0; j = prev[i][j], i--) positions[i] = j;
  return { score: top, positions };
}

/** Higher is better; null means no match. An empty query matches everything with 0. */
export function fuzzyScore(query: string, text: string): number | null {
  return fuzzyMatch(query, text)?.score ?? null;
}

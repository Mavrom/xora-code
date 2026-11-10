// Pure pieces of find in files: the flat row list the dialog renders and walks with the
// arrow keys, match highlighting, the summary line and error wording.
import type { EditorRange } from "@/features/editor/store";
import { localeOf, t } from "@/shared/i18n";
import type { FileMatches, LineMatch, SearchResults } from "./ipc";

/** Shorter queries are not searched (a single letter matches nearly every line). */
export const MIN_QUERY = 2;

export const canSearch = (query: string) => query.length >= MIN_QUERY;

export type ResultRow =
  | { kind: "file"; key: string; file: FileMatches; name: string; dir: string }
  | { kind: "match"; key: string; file: FileMatches; match: LineMatch; matchIndex: number };

export interface ResultList {
  /** File headers, each followed by its matching lines, in on-screen order. */
  rows: ResultRow[];
  /** Row index of each match row; keyboard navigation walks these. */
  matchRows: number[];
}

/** File name and its folder (empty at the root) of a `/`-separated relative path. */
export function splitPath(path: string): { name: string; dir: string } {
  const cut = path.lastIndexOf("/");
  return cut === -1
    ? { name: path, dir: "" }
    : { name: path.slice(cut + 1), dir: path.slice(0, cut) };
}

export function resultRows(results: SearchResults | null): ResultList {
  const rows: ResultRow[] = [];
  const matchRows: number[] = [];
  for (const file of results?.files ?? []) {
    rows.push({ kind: "file", key: file.path, file, ...splitPath(file.path) });
    for (const match of file.matches) {
      matchRows.push(rows.length);
      rows.push({
        kind: "match",
        key: `${file.path}:${match.line}`,
        file,
        match,
        matchIndex: matchRows.length - 1,
      });
    }
  }
  return { rows, matchRows };
}

export interface TextPart {
  text: string;
  hit: boolean;
}

/** Splits `text` into plain and matched parts; ranges are clamped, sorted and merged. */
export function highlightParts(text: string, ranges: readonly [number, number][]): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  for (const [rawStart, rawEnd] of sorted) {
    const start = Math.max(at, Math.min(rawStart, text.length));
    const end = Math.min(rawEnd, text.length);
    if (end <= start) continue;
    if (start > at) parts.push({ text: text.slice(at, start), hit: false });
    const last = parts[parts.length - 1];
    if (last?.hit && start === at) last.text += text.slice(start, end);
    else parts.push({ text: text.slice(start, end), hit: true });
    at = end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}

/** The editor selection for a match: its first occurrence on the line. */
export function matchRange(match: LineMatch): EditorRange {
  const first = match.ranges[0];
  const length = first ? first[1] - first[0] : 0;
  return {
    line: match.line,
    column: match.column,
    endLine: match.line,
    endColumn: match.column + length,
  };
}

const count = (n: number) => n.toLocaleString(localeOf());

/** "42 results in 7 files", with the singular forms. */
export function summaryText(results: SearchResults): string {
  const { totalMatches: n, totalFiles: files } = results;
  if (n === 1) return t("1 result in 1 file");
  if (files === 1) return t("{n} results in 1 file", { n: count(n) });
  return t("{n} results in {files} files", { n: count(n), files: count(files) });
}

/** A failed search: an invalid pattern (shown under the input) or anything else. */
export function describeSearchError(error: unknown): { badRegex: boolean; message: string } {
  const text = error instanceof Error ? error.message : String(error);
  const match = /^\[([a-z_]+)\]\s*/.exec(text);
  const detail = match ? text.slice(match[0].length) : text;
  if (match?.[1] === "bad_regex") {
    // The regex crate starts with a "regex parse error:" line; the caret diagram is the useful part.
    return { badRegex: true, message: detail.replace(/^regex parse error:\s*\n/, "") };
  }
  if (match?.[1] === "not_found") {
    return { badRegex: false, message: t("The folder was not found.") };
  }
  return { badRegex: false, message: t("Search failed: {detail}", { detail }) };
}

/** Longest editor selection taken as the query. */
const MAX_SEED = 200;

/** The editor selection as a starting query, if it is usable (not blank, not huge). */
export function seedQuery(selection: string | null): string | null {
  if (!selection || !selection.trim() || selection.length > MAX_SEED) return null;
  return selection;
}

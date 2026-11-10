// Typed wrappers around find in files (`src-tauri/src/fs/search.rs`).
import { invoke } from "@tauri-apps/api/core";

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

/** One matching line. Columns and ranges are UTF-16 units, like JS strings and Monaco. */
export interface LineMatch {
  /** 1-based. */
  line: number;
  /** 1-based column of the first match in the full line. */
  column: number;
  /** The line as shown: indentation dropped, long lines cut around the match with `…`. */
  text: string;
  /** `[start, end)` offsets of the matches inside `text`. */
  ranges: [number, number][];
}

export interface FileMatches {
  /** Relative to the searched root, with `/` separators. */
  path: string;
  count: number;
  matches: LineMatch[];
}

export interface SearchResults {
  files: FileMatches[];
  totalMatches: number;
  totalFiles: number;
  /** A cap was hit; there may be more matches than listed. */
  truncated: boolean;
}

/** `cancelled`: a newer search (or a cancel) superseded this one; ignore it. */
export type SearchOutcome = ({ status: "done" } & SearchResults) | { status: "cancelled" };

export const searchIpc = {
  /** Rejects with `[bad_regex] …` for an invalid pattern. */
  search: (root: string, query: string, options: SearchOptions) =>
    invoke<SearchOutcome>("fs_search", { root, query, ...options }),
  /** Stops the running search; it resolves as `cancelled`. */
  cancel: () => invoke<void>("fs_search_cancel"),
};

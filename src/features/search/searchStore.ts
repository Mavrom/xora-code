// Find in files state. It outlives the dialog, so reopening Ctrl+Shift+F shows the last
// query, options and results at once, and runs that search again (agents keep rewriting
// files, so old line numbers go stale). Searches are debounced and latest-wins: Rust stops a
// superseded search, and the gate drops any answer that arrives after a newer request.
import { create } from "zustand";
import { focusedEditorSelection } from "@/features/editor/editorFocus";
import { createLatestGate } from "@/features/files/latestGate";
import { searchIpc, type SearchOptions, type SearchResults } from "./ipc";
import { canSearch, seedQuery } from "./searchModel";

/** Quiet time after the last keystroke before a search starts. */
export const SEARCH_DEBOUNCE_MS = 200;

export type SearchStatus = "idle" | "searching" | "done" | "error";

interface SearchState extends SearchOptions {
  query: string;
  status: SearchStatus;
  /** The last finished search; kept on screen while a newer one runs. */
  results: SearchResults | null;
  /** The query and folder `results` belong to. */
  resultsQuery: string;
  resultsRoot: string | null;
  /** The last search failed: an invalid regex or another error. */
  error: unknown;
  /** Index of the selected match (into the flat match list). */
  active: number;
  setQuery: (query: string) => void;
  toggle: (option: keyof SearchOptions) => void;
  setActive: (active: number) => void;
  /**
   * Searches `root` for the current query and options unless that search is already shown.
   * `refresh` (the dialog just opened): run a shown search again at once, since files may
   * have changed; its results stay on screen meanwhile and the selected row is kept.
   */
  request: (root: string | null, refresh?: boolean) => void;
  /** Stops a pending or running search (the dialog closed). */
  stop: () => void;
}

const NO_RESULTS = { results: null, resultsQuery: "", resultsRoot: null, active: 0 };

const gate = createLatestGate();
let timer: ReturnType<typeof setTimeout> | undefined;
/** Root, query and options of the search last requested; equal requests are skipped. */
let requested: string | null = null;
/** The same for the results on screen. */
let shown: string | null = null;

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  status: "idle",
  results: null,
  resultsQuery: "",
  resultsRoot: null,
  error: null,
  active: 0,

  setQuery: (query) => set({ query }),
  toggle: (option) => set((s) => ({ [option]: !s[option] })),
  setActive: (active) => set({ active }),

  request: (root, refresh = false) => {
    const { query, caseSensitive, wholeWord, regex, status } = get();
    const options = { caseSensitive, wholeWord, regex };
    const key = JSON.stringify([root, query, options]);
    // Re-running the shown search keeps the selection; any other search starts at the top.
    const rerun = refresh && key === shown && status === "done";
    if (!rerun && key === requested && status !== "idle") return;
    requested = key;
    clearTimeout(timer);
    const token = gate.begin();
    // Stop the running search now rather than when the next one starts after the debounce.
    if (status === "searching") void searchIpc.cancel().catch(() => undefined);
    if (!root || !canSearch(query)) {
      set({ status: "idle", ...NO_RESULTS, error: null });
      return;
    }
    set({ status: "searching" });
    timer = setTimeout(
      () => {
        searchIpc.search(root, query, options).then(
          (outcome) => {
            // A cancelled search was superseded: the newer one reports.
            if (!gate.isLatest(token) || outcome.status === "cancelled") return;
            const { files, totalMatches, totalFiles, truncated } = outcome;
            const rows = files.reduce((n, file) => n + file.matches.length, 0);
            const { active } = get();
            shown = key;
            set({
              status: "done",
              results: { files, totalMatches, totalFiles, truncated },
              resultsQuery: query,
              resultsRoot: root,
              error: null,
              active: rerun && active < rows ? active : 0,
            });
          },
          (error: unknown) => {
            if (!gate.isLatest(token)) return;
            set({ status: "error", ...NO_RESULTS, error });
          },
        );
      },
      rerun ? 0 : SEARCH_DEBOUNCE_MS,
    );
  },

  stop: () => {
    clearTimeout(timer);
    gate.cancelAll();
    if (get().status !== "searching") return;
    void searchIpc.cancel().catch(() => undefined);
    // Reopening must search again: what is shown does not match the query.
    requested = null;
    set({ status: get().results ? "done" : "idle" });
  },
}));

/** Before opening: a one-line selection in the focused editor becomes the query. */
export function seedFromEditor() {
  const seed = seedQuery(focusedEditorSelection());
  if (seed) useSearchStore.getState().setQuery(seed);
}

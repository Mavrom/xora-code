import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchOutcome } from "./ipc";

const search = vi.fn<(root: string, query: string, options: object) => Promise<SearchOutcome>>();
const cancel = vi.fn(() => Promise.resolve());
vi.mock("./ipc", () => ({
  searchIpc: {
    search: (root: string, query: string, options: object) => search(root, query, options),
    cancel: () => cancel(),
  },
}));

const { SEARCH_DEBOUNCE_MS, useSearchStore } = await import("./searchStore");

const s = () => useSearchStore.getState();
const done = (totalMatches: number): SearchOutcome => ({
  status: "done",
  files: [],
  totalMatches,
  totalFiles: 0,
  truncated: false,
});

/** One file with `rows` matching lines. */
const withRows = (rows: number): SearchOutcome => ({
  status: "done",
  files: [
    {
      path: "a.ts",
      count: rows,
      matches: Array.from({ length: rows }, (_, i) => ({
        line: i + 1,
        column: 1,
        text: "x",
        ranges: [[0, 1]],
      })),
    },
  ],
  totalMatches: rows,
  totalFiles: 1,
  truncated: false,
});

/** A promise resolved from the outside, to finish searches out of order. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  search.mockReset();
  cancel.mockClear();
  s().stop();
  useSearchStore.setState({
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
  });
});

afterEach(() => vi.useRealTimers());

describe("search store", () => {
  it("debounces and passes the options", async () => {
    search.mockResolvedValue(done(3));
    s().setQuery("needle");
    s().toggle("regex");
    s().request("/p");
    expect(s().status).toBe("searching");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledExactlyOnceWith("/p", "needle", {
      caseSensitive: false,
      wholeWord: false,
      regex: true,
    });
    expect(s().status).toBe("done");
    expect(s().results?.totalMatches).toBe(3);
    expect(s().resultsQuery).toBe("needle");
  });

  it("only searches once per change and keeps the latest answer", async () => {
    const first = deferred<SearchOutcome>();
    search.mockReturnValueOnce(first.promise).mockResolvedValueOnce(done(2));
    s().setQuery("ab");
    s().request("/p");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    s().request("/p");
    expect(search).toHaveBeenCalledTimes(1);
    s().setQuery("abc");
    s().request("/p");
    // The running search is told to stop right away.
    expect(cancel).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    first.resolve(done(99));
    await vi.runAllTimersAsync();
    expect(s().results?.totalMatches).toBe(2);
  });

  it("ignores a cancelled outcome", async () => {
    search.mockResolvedValue({ status: "cancelled" });
    s().setQuery("ab");
    s().request("/p");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(s().status).toBe("searching");
    expect(s().results).toBeNull();
  });

  it("does not search short queries or without a folder", async () => {
    s().setQuery("a");
    s().request("/p");
    s().setQuery("ab");
    s().request(null);
    await vi.runAllTimersAsync();
    expect(search).not.toHaveBeenCalled();
    expect(s().status).toBe("idle");
  });

  it("keeps the error of a failed search", async () => {
    search.mockRejectedValue("[bad_regex] oops");
    s().setQuery("a(");
    s().request("/p");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(s().status).toBe("error");
    expect(s().error).toBe("[bad_regex] oops");
  });

  describe("reopening", () => {
    /** A finished search for `query` with `rows` matching lines, the third one selected. */
    async function shownSearch(query: string, rows: number) {
      search.mockResolvedValueOnce(withRows(rows));
      s().setQuery(query);
      s().request("/p");
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      s().setActive(2);
      s().stop(); // the dialog closes
    }

    it("runs the shown search again at once, keeping the results and the row", async () => {
      await shownSearch("reopen", 5);
      const refreshed = deferred<SearchOutcome>();
      search.mockReturnValueOnce(refreshed.promise);
      s().request("/p", true);
      // No flash of an empty list: the old results stay while the refresh runs.
      expect(s().status).toBe("searching");
      expect(s().results?.totalMatches).toBe(5);
      expect(s().active).toBe(2);
      await vi.advanceTimersByTimeAsync(0);
      expect(search).toHaveBeenCalledTimes(2);
      refreshed.resolve(withRows(4));
      await vi.runAllTimersAsync();
      expect(s().status).toBe("done");
      expect(s().results?.totalMatches).toBe(4);
      expect(s().active).toBe(2);
    });

    it("goes back to the first row when the selected one is gone", async () => {
      await shownSearch("shrinks", 5);
      search.mockResolvedValueOnce(withRows(2));
      s().request("/p", true);
      await vi.runAllTimersAsync();
      expect(s().results?.totalMatches).toBe(2);
      expect(s().active).toBe(0);
    });

    it("treats a changed (seeded) query as a new search", async () => {
      await shownSearch("before", 5);
      search.mockResolvedValueOnce(withRows(5));
      s().setQuery("seeded");
      s().request("/p", true);
      await vi.advanceTimersByTimeAsync(0);
      expect(search).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      expect(search).toHaveBeenLastCalledWith("/p", "seeded", expect.anything());
      expect(s().active).toBe(0);
    });

    it("only refreshes on open: later equal requests are skipped", async () => {
      await shownSearch("once", 3);
      search.mockResolvedValue(withRows(3));
      s().request("/p", true);
      await vi.runAllTimersAsync();
      s().request("/p");
      await vi.runAllTimersAsync();
      expect(search).toHaveBeenCalledTimes(2);
    });
  });

  it("stop cancels a running search and lets the next request run again", async () => {
    search.mockReturnValue(new Promise(() => undefined));
    s().setQuery("ab");
    s().request("/p");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    s().stop();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(s().status).toBe("idle");
    s().request("/p");
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(2);
  });
});

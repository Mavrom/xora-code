import { afterEach, describe, expect, it, vi } from "vitest";
import { CHECK_INTERVAL_MS, type Release } from "./releaseCheck";
import { EMPTY_SAVED, parseSaved, readSaved, SAVED_KEY, writeSaved } from "./saved";
import { selectNotice } from "./store";
import { runUpdateCheck, type CheckDeps } from "./updateCheck";

const PAGE = "https://github.com/Mavrom/xora-code/releases/tag/v0.2.0";
const RELEASE: Release = { version: "0.2.0", url: PAGE };
const NOW = 100 * CHECK_INTERVAL_MS;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function setup(options: { saved?: object; answer?: number; body?: unknown; current?: string }) {
  const storage = memoryStorage(
    options.saved ? { [SAVED_KEY]: JSON.stringify(options.saved) } : {},
  );
  const fetchFn = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(options.body ?? { tag_name: "v0.2.0", html_url: PAGE }), {
        status: options.answer ?? 200,
      }),
  );
  const report = vi.fn<(release: Release | null) => void>();
  const deps: CheckDeps = {
    now: () => NOW,
    fetchFn,
    currentVersion: async () => options.current ?? "0.1.0",
    storage,
    report,
  };
  return { deps, fetchFn, report, storage };
}

describe("runUpdateCheck", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks once, remembers the attempt and the release, and reports a newer one", async () => {
    const { deps, fetchFn, report, storage } = setup({});
    await runUpdateCheck(deps);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(RELEASE);
    expect(readSaved(storage)).toEqual({ lastCheck: NOW, latest: RELEASE, dismissed: null });
  });

  it("reports nothing when the latest release is the running one", async () => {
    const { deps, report } = setup({ current: "0.2.0" });
    await runUpdateCheck(deps);
    expect(report).toHaveBeenCalledWith(null);
  });

  it("does not ask again within a day, but still reports the release it saw", async () => {
    const { deps, fetchFn, report } = setup({
      saved: { lastCheck: NOW - CHECK_INTERVAL_MS + 60_000, latest: RELEASE },
    });
    await runUpdateCheck(deps);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(RELEASE);
  });

  it("stops reporting a remembered release once the app has been updated", async () => {
    const { deps, report } = setup({
      saved: { lastCheck: NOW, latest: RELEASE },
      current: "0.2.0",
    });
    await runUpdateCheck(deps);
    expect(report).toHaveBeenCalledWith(null);
  });

  it("on failure keeps what it knew and does not retry until tomorrow", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const old = { version: "0.1.5", url: PAGE };
    const { deps, fetchFn, report, storage } = setup({
      saved: { lastCheck: NOW - 2 * CHECK_INTERVAL_MS, latest: old },
      answer: 403,
    });
    await runUpdateCheck(deps);
    expect(report).toHaveBeenCalledWith(old);
    expect(readSaved(storage).lastCheck).toBe(NOW);

    await runUpdateCheck(deps);
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

describe("saved state", () => {
  it("reads malformed or missing data as empty, field by field", () => {
    expect(parseSaved(null)).toEqual(EMPTY_SAVED);
    expect(parseSaved("{oops")).toEqual(EMPTY_SAVED);
    expect(parseSaved("42")).toEqual(EMPTY_SAVED);
    expect(
      parseSaved(
        JSON.stringify({
          lastCheck: "yesterday",
          latest: { version: "0.2.0", url: "https://example.com/" },
          dismissed: "0.2.0",
        }),
      ),
    ).toEqual({ lastCheck: null, latest: null, dismissed: "0.2.0" });
  });

  it("merges writes and survives a storage that throws", () => {
    const storage = memoryStorage();
    writeSaved({ lastCheck: 5 }, storage);
    writeSaved({ dismissed: "0.2.0" }, storage);
    expect(readSaved(storage)).toEqual({ lastCheck: 5, latest: null, dismissed: "0.2.0" });

    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readSaved(broken)).toEqual(EMPTY_SAVED);
    expect(() => writeSaved({ lastCheck: 1 }, broken)).not.toThrow();
  });
});

describe("selectNotice", () => {
  it("hides a dismissed version and shows a later one", () => {
    expect(selectNotice({ available: RELEASE, dismissed: null })).toBe(RELEASE);
    expect(selectNotice({ available: RELEASE, dismissed: "0.2.0" })).toBeNull();
    const later = { version: "0.3.0", url: PAGE };
    expect(selectNotice({ available: later, dismissed: "0.2.0" })).toBe(later);
    expect(selectNotice({ available: null, dismissed: null })).toBeNull();
  });
});

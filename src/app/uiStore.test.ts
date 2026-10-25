import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

/** The initial view is read at module load, so import fresh per test. */
const loadStore = async () => (await import("./uiStore")).useUiStore;

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("ui store", () => {
  it("defaults to the explorer", async () => {
    vi.stubGlobal("localStorage", memoryStorage());
    expect((await loadStore()).getState().sidebarView).toBe("explorer");
  });

  it("restores and persists the sidebar view", async () => {
    const storage = memoryStorage({ "xora.sidebarView": "inbox" });
    vi.stubGlobal("localStorage", storage);
    const store = await loadStore();
    expect(store.getState().sidebarView).toBe("inbox");
    store.getState().setSidebarView("explorer");
    expect(storage.data.get("xora.sidebarView")).toBe("explorer");
  });

  it("ignores unknown stored values", async () => {
    vi.stubGlobal("localStorage", memoryStorage({ "xora.sidebarView": "bogus" }));
    expect((await loadStore()).getState().sidebarView).toBe("explorer");
  });

  it("keeps working when storage throws", async () => {
    const boom = () => {
      throw new Error("denied");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    const store = await loadStore();
    expect(store.getState().sidebarView).toBe("explorer");
    store.getState().setSidebarView("inbox");
    expect(store.getState().sidebarView).toBe("inbox");
  });
});

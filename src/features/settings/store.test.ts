import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPatch } from "./merge";
import { createSettingsStore, type SettingsBackend } from "./store";
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from "./types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

/** In-memory backend that deep-merges patches like the Rust side. */
function fakeBackend(initial: Settings = DEFAULT_SETTINGS) {
  let disk = initial;
  const calls: SettingsPatch[] = [];
  const backend: SettingsBackend & { calls: SettingsPatch[]; disk: () => Settings } = {
    calls,
    disk: () => disk,
    get: vi.fn(async () => disk),
    update: vi.fn(async (patch: SettingsPatch) => {
      calls.push(patch);
      disk = applyPatch(disk, patch);
      return disk;
    }),
  };
  return backend;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("settings store", () => {
  it("starts with defaults and loads the stored settings once", async () => {
    const stored = applyPatch(DEFAULT_SETTINGS, { editor: { fontSize: 16 } });
    const backend = fakeBackend(stored);
    const store = createSettingsStore(backend);
    expect(store.getState().settings).toBe(DEFAULT_SETTINGS);

    const [a, b] = await Promise.all([store.getState().load(), store.getState().load()]);

    expect(a).toEqual(stored);
    expect(b).toBe(a);
    expect(backend.get).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe("ready");
  });

  it("applies updates optimistically and persists them as one debounced patch", async () => {
    const backend = fakeBackend();
    const store = createSettingsStore(backend, 300);
    await store.getState().load();

    store.getState().update({ editor: { wordWrap: true } });
    store.getState().update({ editor: { fontSize: 15 }, general: { openLastFolder: false } });

    expect(store.getState().settings.editor).toMatchObject({ wordWrap: true, fontSize: 15 });
    expect(backend.update).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(backend.calls).toEqual([
      { editor: { wordWrap: true, fontSize: 15 }, general: { openLastFolder: false } },
    ]);
    expect(backend.disk().editor.fontSize).toBe(15);
  });

  it("ignores updates that change nothing", async () => {
    const backend = fakeBackend();
    const store = createSettingsStore(backend, 300);
    const before = store.getState().settings;

    store.getState().update({ editor: { fontSize: 13 } });

    expect(store.getState().settings).toBe(before);
    await vi.advanceTimersByTimeAsync(300);
    expect(backend.update).not.toHaveBeenCalled();
  });

  it("keeps changes made before the load finished", async () => {
    const backend = fakeBackend(applyPatch(DEFAULT_SETTINGS, { editor: { tabSize: 4 } }));
    let release!: () => void;
    backend.get = vi.fn(
      () =>
        new Promise<Settings>((resolve) => {
          release = () => resolve(backend.disk());
        }),
    );
    const store = createSettingsStore(backend, 300);
    const loaded = store.getState().load();

    store.getState().update({ editor: { minimap: true } });
    release();
    await loaded;

    expect(store.getState().settings.editor).toMatchObject({ tabSize: 4, minimap: true });
  });

  it("uses the sanitized settings the backend returns", async () => {
    const backend = fakeBackend();
    backend.update = vi.fn(async () => applyPatch(DEFAULT_SETTINGS, { editor: { fontSize: 24 } }));
    const store = createSettingsStore(backend, 300);

    store.getState().update({ editor: { fontSize: 99 } });
    await store.getState().flush();

    expect(store.getState().settings.editor.fontSize).toBe(24);
  });

  it("keeps a failed change in memory, reports it and retries on the next flush", async () => {
    const backend = fakeBackend();
    const update = backend.update;
    backend.update = vi.fn(async () => {
      throw new Error("disk full");
    });
    const store = createSettingsStore(backend, 300);

    store.getState().update({ general: { confirmDirtyClose: false } });
    await store.getState().flush();

    expect(store.getState().error).toContain("disk full");
    expect(store.getState().settings.general.confirmDirtyClose).toBe(false);

    backend.update = update;
    await store.getState().flush();

    expect(store.getState().error).toBeNull();
    expect(backend.disk().general.confirmDirtyClose).toBe(false);
  });

  it("falls back to defaults when loading fails", async () => {
    const backend = fakeBackend();
    backend.get = vi.fn(async () => {
      throw new Error("no access");
    });
    const store = createSettingsStore(backend);

    const settings = await store.getState().load();

    expect(settings).toBe(DEFAULT_SETTINGS);
    expect(store.getState().status).toBe("error");
  });

  it("flush waits for a save already in flight and then sends the rest", async () => {
    const backend = fakeBackend();
    const store = createSettingsStore(backend, 300);

    store.getState().update({ editor: { tabSize: 4 } });
    const first = store.getState().flush();
    store.getState().update({ editor: { tabSize: 8 } });
    await Promise.all([first, store.getState().flush()]);

    expect(backend.calls).toEqual([{ editor: { tabSize: 4 } }, { editor: { tabSize: 8 } }]);
    expect(store.getState().settings.editor.tabSize).toBe(8);
  });
});

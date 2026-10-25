import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ipc, type Note } from "@/shared/lib/ipc";
import { RETRY_DELAYS_MS, SAVE_DELAY_MS, flushNow, useInboxStore } from "./store";

vi.mock("@/shared/lib/ipc", () => ({
  ipc: { notesList: vi.fn(), notesSave: vi.fn() },
}));

const notesList = vi.mocked(ipc.notesList);
const notesSave = vi.mocked(ipc.notesSave);

const s = () => useInboxStore.getState();

const note = (patch: Partial<Note> & { id: string }): Note => ({
  text: patch.id,
  pinned: false,
  done: false,
  createdAt: 1,
  updatedAt: 1,
  ...patch,
});

/** Loads the given notes so the store is `ready`. */
async function ready(notes: Note[] = []) {
  notesList.mockResolvedValueOnce(notes);
  await s().load();
}

/** Lets the debounce fire and any in-flight save settle. */
const settle = () => vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
  notesList.mockReset();
  notesSave.mockReset().mockResolvedValue(undefined);
  useInboxStore.setState({ notes: [], status: "idle", error: null, lastRemoved: null });
});

afterEach(async () => {
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe("inbox store: load", () => {
  it("becomes ready with the stored notes", async () => {
    const stored = [note({ id: "a" })];
    await ready(stored);
    expect(s().status).toBe("ready");
    expect(s().notes).toEqual(stored);
    expect(s().error).toBeNull();
  });

  it("is loading while the request is pending", async () => {
    notesList.mockReturnValueOnce(new Promise(() => {}));
    void s().load();
    expect(s().status).toBe("loading");
  });

  it("enters the error state and never saves afterwards (would wipe the file)", async () => {
    notesList.mockRejectedValueOnce("notes file is not valid JSON");
    await s().load();
    expect(s().status).toBe("error");
    expect(s().error).toBe("notes file is not valid JSON");

    s().add("hello");
    await settle();
    expect(notesSave).not.toHaveBeenCalled();
    expect(s().notes).toEqual([]);
  });

  it("retrying after an error can succeed", async () => {
    notesList.mockRejectedValueOnce("boom");
    await s().load();
    await ready([note({ id: "a" })]);
    expect(s().status).toBe("ready");
    expect(s().error).toBeNull();
    expect(s().notes).toHaveLength(1);
  });

  it("does not reload once ready, so unsaved edits are never clobbered", async () => {
    await ready();
    s().add("local");
    await s().load();
    expect(notesList).toHaveBeenCalledTimes(1);
    expect(s().notes.map((n) => n.text)).toEqual(["local"]);
  });

  it("ignores mutations before the first load", async () => {
    expect(s().add("too early")).toBe(false);
    await settle();
    expect(s().notes).toEqual([]);
    expect(notesSave).not.toHaveBeenCalled();
  });
});

describe("inbox store: mutations", () => {
  it("add trims text and stamps a fresh open note", async () => {
    await ready();
    expect(s().add("  buy milk \n")).toBe(true);
    expect(s().notes).toHaveLength(1);
    const [n] = s().notes;
    expect(n).toMatchObject({
      text: "buy milk",
      pinned: false,
      done: false,
      createdAt: 1_000,
      updatedAt: 1_000,
    });
    expect(n.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("add keeps inner newlines", async () => {
    await ready();
    s().add("line 1\nline 2");
    expect(s().notes[0].text).toBe("line 1\nline 2");
  });

  it("add ignores empty and whitespace-only text", async () => {
    await ready();
    expect(s().add("")).toBe(false);
    expect(s().add("   \n\t")).toBe(false);
    await settle();
    expect(s().notes).toEqual([]);
    expect(notesSave).not.toHaveBeenCalled();
  });

  it("togglePin and toggleDone flip the flag and bump updatedAt", async () => {
    await ready([note({ id: "a" })]);
    vi.setSystemTime(2_000);
    s().togglePin("a");
    expect(s().notes[0]).toMatchObject({ pinned: true, updatedAt: 2_000, createdAt: 1 });
    vi.setSystemTime(3_000);
    s().toggleDone("a");
    expect(s().notes[0]).toMatchObject({ done: true, updatedAt: 3_000 });
    s().toggleDone("a");
    expect(s().notes[0].done).toBe(false);
  });

  it("update replaces the trimmed text and bumps updatedAt", async () => {
    await ready([note({ id: "a", text: "old" })]);
    vi.setSystemTime(5_000);
    s().update("a", " new ");
    expect(s().notes[0]).toMatchObject({ text: "new", updatedAt: 5_000 });
  });

  it("update ignores empty or unchanged text", async () => {
    await ready([note({ id: "a", text: "keep" })]);
    vi.setSystemTime(5_000);
    s().update("a", "  ");
    s().update("a", "keep");
    await settle();
    expect(s().notes[0]).toMatchObject({ text: "keep", updatedAt: 1 });
    expect(notesSave).not.toHaveBeenCalled();
  });

  it("remove deletes only that note", async () => {
    await ready([note({ id: "a" }), note({ id: "b" })]);
    s().remove("a");
    expect(s().notes.map((n) => n.id)).toEqual(["b"]);
    await settle();
    expect(notesSave).toHaveBeenCalledWith([note({ id: "b" })]);
  });

  it("remove remembers the deleted note for undo", async () => {
    const a = note({ id: "a", pinned: true });
    await ready([a, note({ id: "b" })]);
    s().remove("a");
    expect(s().lastRemoved).toEqual(a);
  });

  it("restore brings the note back with its original data and saves it", async () => {
    const a = note({ id: "a", text: "keep me", pinned: true, createdAt: 7, updatedAt: 9 });
    await ready([a, note({ id: "b" })]);
    s().remove("a");
    await settle();
    vi.setSystemTime(50_000);
    s().restore(a);
    expect(s().notes).toContainEqual(a);
    expect(s().notes).toHaveLength(2);
    expect(s().lastRemoved).toBeNull();
    await settle();
    expect(notesSave).toHaveBeenCalledTimes(2);
    expect(notesSave.mock.calls[1][0]).toContainEqual(a);
  });

  it("restore is a no-op when the note is still there", async () => {
    const a = note({ id: "a" });
    await ready([a]);
    s().restore(a);
    await settle();
    expect(s().notes).toEqual([a]);
    expect(notesSave).not.toHaveBeenCalled();
  });

  it("dismissRemoved forgets the undo target", async () => {
    await ready([note({ id: "a" })]);
    s().remove("a");
    s().dismissRemoved();
    expect(s().lastRemoved).toBeNull();
  });

  it("unknown ids are a no-op and do not save", async () => {
    await ready([note({ id: "a" })]);
    s().togglePin("zzz");
    s().toggleDone("zzz");
    s().update("zzz", "x");
    s().remove("zzz");
    await settle();
    expect(notesSave).not.toHaveBeenCalled();
  });
});

describe("inbox store: debounced save", () => {
  it("coalesces rapid mutations into one save of the final list", async () => {
    await ready();
    s().add("one");
    await vi.advanceTimersByTimeAsync(100);
    s().add("two");
    await vi.advanceTimersByTimeAsync(100);
    s().add("three");
    expect(notesSave).not.toHaveBeenCalled();

    await settle();
    expect(notesSave).toHaveBeenCalledTimes(1);
    expect(notesSave.mock.calls[0][0].map((n) => n.text).sort()).toEqual(["one", "three", "two"]);
  });

  it("keeps one save in flight; a change during it is saved afterwards (last write wins)", async () => {
    await ready();
    let finish!: () => void;
    notesSave.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));

    s().add("first");
    await settle();
    expect(notesSave).toHaveBeenCalledTimes(1);

    s().add("second");
    await settle();
    expect(notesSave).toHaveBeenCalledTimes(1); // still waiting on the first

    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(notesSave).toHaveBeenCalledTimes(2);
    expect(notesSave.mock.calls[1][0]).toHaveLength(2);
  });

  it("a failed save is retried automatically with backoff until it succeeds", async () => {
    await ready();
    notesSave.mockRejectedValue("disk full");
    s().add("precious");
    await settle();
    expect(notesSave).toHaveBeenCalledTimes(1);

    const expected = [2_000, 5_000, 15_000, 30_000, 30_000];
    expect(RETRY_DELAYS_MS).toEqual(expected.slice(0, 4));
    for (const [i, delay] of expected.entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(notesSave).toHaveBeenCalledTimes(i + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(notesSave).toHaveBeenCalledTimes(i + 2);
    }
    expect(s().error).toBe("disk full");

    notesSave.mockResolvedValue(undefined);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(notesSave).toHaveBeenCalledTimes(expected.length + 2);
    expect(s().error).toBeNull();

    // Success cancels the retry loop.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(notesSave).toHaveBeenCalledTimes(expected.length + 2);
  });

  it("a failed save keeps the notes, reports the error and retries on the next change", async () => {
    await ready();
    notesSave.mockRejectedValueOnce("disk full");
    s().add("precious");
    await settle();
    expect(s().error).toBe("disk full");
    expect(s().status).toBe("ready");
    expect(s().notes.map((n) => n.text)).toEqual(["precious"]);

    s().add("another");
    await settle();
    expect(notesSave).toHaveBeenCalledTimes(2);
    expect(notesSave.mock.calls[1][0]).toHaveLength(2);
    expect(s().error).toBeNull();
  });
});

describe("inbox store: flushNow", () => {
  it("saves a pending debounced change immediately", async () => {
    await ready();
    s().add("closing soon");
    expect(notesSave).not.toHaveBeenCalled();
    await flushNow();
    expect(notesSave).toHaveBeenCalledTimes(1);
    expect(notesSave.mock.calls[0][0].map((n) => n.text)).toEqual(["closing soon"]);

    // The cancelled debounce does not save a second time.
    await settle();
    expect(notesSave).toHaveBeenCalledTimes(1);
  });

  it("waits for an in-flight save and then saves changes made meanwhile", async () => {
    await ready();
    let finish!: () => void;
    notesSave.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    s().add("first");
    await settle();
    s().add("second");

    let done = false;
    const flushed = flushNow().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);

    finish();
    await flushed;
    expect(notesSave).toHaveBeenCalledTimes(2);
    expect(notesSave.mock.calls[1][0]).toHaveLength(2);
  });

  it("resolves right away when nothing is dirty", async () => {
    await ready([note({ id: "a" })]);
    await flushNow();
    expect(notesSave).not.toHaveBeenCalled();
  });

  it("is a no-op when the store is not ready (never overwrite an unloaded file)", async () => {
    notesList.mockRejectedValueOnce("bad json");
    await s().load();
    s().add("x");
    await flushNow();
    expect(notesSave).not.toHaveBeenCalled();
  });

  it("never rejects, even when the save fails", async () => {
    await ready();
    notesSave.mockRejectedValueOnce("disk full");
    s().add("x");
    await expect(flushNow()).resolves.toBeUndefined();
    expect(s().error).toBe("disk full");
  });
});

import { describe, expect, it } from "vitest";
import { DRAFT_KEY, readDraft, writeDraft } from "./draft";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("inbox draft", () => {
  it("round-trips the text unchanged (including newlines and spaces)", () => {
    const storage = memoryStorage();
    writeDraft("  first line\nsecond ", storage);
    expect(storage.map.get(DRAFT_KEY)).toBe("  first line\nsecond ");
    expect(readDraft(storage)).toBe("  first line\nsecond ");
  });

  it("reads an empty string when nothing is stored", () => {
    expect(readDraft(memoryStorage())).toBe("");
    expect(readDraft(null)).toBe("");
  });

  it("empty or whitespace-only text clears the key", () => {
    const storage = memoryStorage();
    writeDraft("keep", storage);
    writeDraft("   \n", storage);
    expect(storage.map.has(DRAFT_KEY)).toBe(false);
  });

  it("never throws when storage is broken", () => {
    expect(readDraft(throwing)).toBe("");
    expect(() => writeDraft("x", throwing)).not.toThrow();
    expect(() => writeDraft("", throwing)).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import type { Note } from "@/shared/lib/ipc";
import { openCount, sortNotes } from "./sortNotes";

const note = (patch: Partial<Note> & { id: string }): Note => ({
  text: patch.id,
  pinned: false,
  done: false,
  createdAt: 0,
  updatedAt: 0,
  ...patch,
});

describe("sortNotes", () => {
  it("orders pinned, then open by createdAt desc, then done by updatedAt desc", () => {
    const notes = [
      note({ id: "open-old", createdAt: 1 }),
      note({ id: "done-early", done: true, createdAt: 9, updatedAt: 5 }),
      note({ id: "pinned-old", pinned: true, createdAt: 2 }),
      note({ id: "open-new", createdAt: 7 }),
      note({ id: "done-late", done: true, createdAt: 3, updatedAt: 8 }),
      note({ id: "pinned-new", pinned: true, createdAt: 6 }),
    ];
    expect(sortNotes(notes).map((n) => n.id)).toEqual([
      "pinned-new",
      "pinned-old",
      "open-new",
      "open-old",
      "done-late",
      "done-early",
    ]);
  });

  it("puts a pinned note that is done with the done notes", () => {
    const notes = [note({ id: "pd", pinned: true, done: true }), note({ id: "o" })];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["o", "pd"]);
  });

  it("does not mutate its input", () => {
    const notes = [note({ id: "a", createdAt: 1 }), note({ id: "b", createdAt: 2 })];
    sortNotes(notes);
    expect(notes.map((n) => n.id)).toEqual(["a", "b"]);
  });
});

describe("openCount", () => {
  it("counts notes that are not done", () => {
    expect(openCount([])).toBe(0);
    expect(
      openCount([
        note({ id: "a" }),
        note({ id: "b", done: true }),
        note({ id: "c", pinned: true }),
      ]),
    ).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { diffLines, diffStats, limitHunks, toHunks, type DiffLine } from "./diff";

const compact = (lines: DiffLine[]) =>
  lines.map((l) => `${l.type === "add" ? "+" : l.type === "del" ? "-" : " "}${l.text}`);

describe("diffLines", () => {
  it("returns only context for identical texts", () => {
    const lines = diffLines("a\nb\n", "a\nb\n");
    expect(compact(lines)).toEqual([" a", " b"]);
    expect(diffStats(lines)).toEqual({ added: 0, removed: 0 });
  });

  it("treats a missing old text as a new file", () => {
    const lines = diffLines(null, "x\ny");
    expect(compact(lines)).toEqual(["+x", "+y"]);
    expect(lines[1]).toMatchObject({ oldNo: null, newNo: 2 });
  });

  it("finds a minimal edit in the middle with correct line numbers", () => {
    const lines = diffLines("a\nb\nc\nd", "a\nB\nc\nd\ne");
    expect(compact(lines)).toEqual([" a", "-b", "+B", " c", " d", "+e"]);
    expect(lines[3]).toMatchObject({ oldNo: 3, newNo: 3 });
    expect(lines[5]).toMatchObject({ oldNo: null, newNo: 5 });
    expect(diffStats(lines)).toEqual({ added: 2, removed: 1 });
  });

  it("handles deletions only and CRLF input", () => {
    expect(compact(diffLines("a\r\nb\r\nc\r\n", "a\nc\n"))).toEqual([" a", "-b", " c"]);
  });

  it("keeps the edit script minimal when lines move", () => {
    const lines = diffLines("x\na\nb\nc", "a\nb\nc\nx");
    expect(diffStats(lines)).toEqual({ added: 1, removed: 1 });
  });

  it("falls back to remove-all/add-all for very large rewrites", () => {
    const old = Array.from({ length: 2000 }, (_, i) => `o${i}`).join("\n");
    const next = Array.from({ length: 2000 }, (_, i) => `n${i}`).join("\n");
    const lines = diffLines(old, next);
    expect(diffStats(lines)).toEqual({ added: 2000, removed: 2000 });
  });
});

describe("toHunks", () => {
  const file = Array.from({ length: 30 }, (_, i) => `l${i + 1}`);

  it("wraps each change in up to three lines of context", () => {
    const next = [...file];
    next[14] = "CHANGED";
    const hunks = toHunks(diffLines(file.join("\n"), next.join("\n")));
    expect(hunks).toHaveLength(1);
    expect(hunks[0]).toMatchObject({ oldStart: 12, newStart: 12 });
    expect(compact(hunks[0].lines)).toEqual([
      " l12",
      " l13",
      " l14",
      "-l15",
      "+CHANGED",
      " l16",
      " l17",
      " l18",
    ]);
  });

  it("merges nearby changes and splits distant ones", () => {
    const near = [...file];
    near[4] = "A";
    near[9] = "B";
    expect(toHunks(diffLines(file.join("\n"), near.join("\n")))).toHaveLength(1);

    const far = [...file];
    far[2] = "A";
    far[25] = "B";
    const hunks = toHunks(diffLines(file.join("\n"), far.join("\n")));
    expect(hunks).toHaveLength(2);
    expect(hunks[1].oldStart).toBe(23);
  });

  it("starts a new-file hunk at line 1", () => {
    const hunks = toHunks(diffLines(undefined, "a\nb"));
    expect(hunks).toEqual([expect.objectContaining({ oldStart: 0, newStart: 1 })]);
  });

  it("returns no hunks when nothing changed", () => {
    expect(toHunks(diffLines("a", "a"))).toEqual([]);
  });
});

describe("limitHunks", () => {
  it("spends the row budget across hunks", () => {
    const file = Array.from({ length: 40 }, (_, i) => `l${i}`);
    const next = file.map((l, i) => (i === 2 || i === 30 ? `${l}!` : l));
    const hunks = toHunks(diffLines(file.join("\n"), next.join("\n")));
    expect(hunks).toHaveLength(2);
    const limited = limitHunks(hunks, hunks[0].lines.length + 2);
    expect(limited).toHaveLength(2);
    expect(limited[1].lines).toHaveLength(2);
    expect(limitHunks(hunks, 3)).toHaveLength(1);
  });
});

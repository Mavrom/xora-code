import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "./unifiedDiff";

const HEADER = "diff --git a/f.txt b/f.txt\nindex 1..2 100644\n--- a/f.txt\n+++ b/f.txt\n";

describe("parseUnifiedDiff", () => {
  it("numbers lines on both sides across hunks", () => {
    const text = `${HEADER}@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n@@ -10,2 +10,3 @@ fn x\n x\n+y\n z`;
    const { hunks, binary } = parseUnifiedDiff(text);
    expect(binary).toBe(false);
    expect(hunks.map((h) => [h.oldStart, h.newStart])).toEqual([
      [1, 1],
      [10, 10],
    ]);
    expect(hunks[0].lines).toEqual([
      { type: "context", text: "a", oldNo: 1, newNo: 1 },
      { type: "del", text: "b", oldNo: 2, newNo: null },
      { type: "add", text: "B", oldNo: null, newNo: 2 },
      { type: "context", text: "c", oldNo: 3, newNo: 3 },
    ]);
    expect(hunks[1].lines[1]).toEqual({ type: "add", text: "y", oldNo: null, newNo: 11 });
  });

  it("reads a new file and skips the no-newline marker", () => {
    const text =
      "diff --git a/n b/n\nnew file mode 100644\n--- /dev/null\n+++ b/n\n@@ -0,0 +1,2 @@\n+one\n+two\n\\ No newline at end of file";
    const { hunks } = parseUnifiedDiff(text);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.map((l) => [l.type, l.text, l.newNo])).toEqual([
      ["add", "one", 1],
      ["add", "two", 2],
    ]);
  });

  it("keeps removed lines that look like file headers", () => {
    const text = `${HEADER}@@ -1 +1 @@\n---- old rule\n++++ new rule`;
    const lines = parseUnifiedDiff(text).hunks[0].lines;
    expect(lines.map((l) => [l.type, l.text])).toEqual([
      ["del", "--- old rule"],
      ["add", "+++ new rule"],
    ]);
  });

  it("reads a rename with changes past its extra header lines", () => {
    const text = [
      "diff --git a/old.txt b/new name.txt",
      "similarity index 90%",
      "rename from old.txt",
      "rename to new name.txt",
      "index 1..2 100644",
      "--- a/old.txt",
      "+++ b/new name.txt",
      "@@ -6,3 +6,3 @@",
      " line 6",
      "-line 7",
      "+line seven",
      " line 8",
    ].join("\n");
    const { hunks, binary } = parseUnifiedDiff(text);
    expect(binary).toBe(false);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.map((l) => [l.type, l.text, l.oldNo, l.newNo])).toEqual([
      ["context", "line 6", 6, 6],
      ["del", "line 7", 7, null],
      ["add", "line seven", null, 7],
      ["context", "line 8", 8, 8],
    ]);
  });

  it("finds no lines in a pure rename", () => {
    const text =
      "diff --git a/a.txt b/b.txt\nsimilarity index 100%\nrename from a.txt\nrename to b.txt";
    expect(parseUnifiedDiff(text)).toEqual({ hunks: [], binary: false });
  });

  it("flags binary files and empty diffs", () => {
    expect(parseUnifiedDiff("Binary files /dev/null and b/x.png differ").binary).toBe(true);
    expect(parseUnifiedDiff("")).toEqual({ hunks: [], binary: false });
  });

  it("copes with Windows line ends and a diff cut short", () => {
    const text = `${HEADER}@@ -1,3 +1,3 @@\n a\n-b`.replace(/\n/g, "\r\n");
    const lines = parseUnifiedDiff(text).hunks[0].lines;
    expect(lines.map((l) => l.text)).toEqual(["a", "b"]);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { setLanguage } from "@/shared/i18n";
import type { SearchResults } from "./ipc";
import {
  canSearch,
  describeSearchError,
  highlightParts,
  matchRange,
  resultRows,
  seedQuery,
  splitPath,
  summaryText,
} from "./searchModel";

beforeAll(() => setLanguage("en"));

const results = (files: Record<string, number[]>): SearchResults => {
  const list = Object.entries(files).map(([path, lines]) => ({
    path,
    count: lines.length,
    matches: lines.map((line) => ({
      line,
      column: 1,
      text: "x",
      ranges: [[0, 1]] as [number, number][],
    })),
  }));
  const totalMatches = list.reduce((n, f) => n + f.count, 0);
  return { files: list, totalMatches, totalFiles: list.length, truncated: false };
};

describe("resultRows", () => {
  it("puts each file header before its lines and indexes the match rows", () => {
    const { rows, matchRows } = resultRows(results({ "src/a.ts": [1, 4], "b.md": [2] }));
    expect(rows.map((r) => r.kind)).toEqual(["file", "match", "match", "file", "match"]);
    expect(matchRows).toEqual([1, 2, 4]);
    const header = rows[0];
    expect(header.kind === "file" && [header.name, header.dir]).toEqual(["a.ts", "src"]);
    const last = rows[4];
    expect(last.kind === "match" && last.matchIndex).toBe(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it("is empty without results", () => {
    expect(resultRows(null)).toEqual({ rows: [], matchRows: [] });
  });
});

describe("splitPath", () => {
  it("splits name and folder", () => {
    expect(splitPath("a/b/c.ts")).toEqual({ name: "c.ts", dir: "a/b" });
    expect(splitPath("README.md")).toEqual({ name: "README.md", dir: "" });
  });
});

describe("highlightParts", () => {
  it("splits plain and matched text", () => {
    expect(
      highlightParts("let foo = foo;", [
        [4, 7],
        [10, 13],
      ]),
    ).toEqual([
      { text: "let ", hit: false },
      { text: "foo", hit: true },
      { text: " = ", hit: false },
      { text: "foo", hit: true },
      { text: ";", hit: false },
    ]);
  });

  it("uses UTF-16 offsets, so emoji and Turkish letters line up", () => {
    // "😀" is two UTF-16 units: "çay" starts at 3.
    expect(highlightParts("😀 çay", [[3, 6]])).toEqual([
      { text: "😀 ", hit: false },
      { text: "çay", hit: true },
    ]);
  });

  it("sorts, clamps and merges ranges", () => {
    expect(
      highlightParts("abcdef", [
        [4, 99],
        [0, 2],
        [1, 3],
      ]),
    ).toEqual([
      { text: "abc", hit: true },
      { text: "d", hit: false },
      { text: "ef", hit: true },
    ]);
    expect(highlightParts("abc", [])).toEqual([{ text: "abc", hit: false }]);
  });
});

describe("matchRange", () => {
  it("selects the first match from its column", () => {
    const match = {
      line: 3,
      column: 9,
      text: "x foo foo",
      ranges: [
        [2, 5],
        [6, 9],
      ] as [number, number][],
    };
    expect(matchRange(match)).toEqual({ line: 3, column: 9, endLine: 3, endColumn: 12 });
  });
});

describe("summaryText", () => {
  it("uses singular and plural forms", () => {
    expect(summaryText(results({ a: [1] }))).toBe("1 result in 1 file");
    expect(summaryText(results({ a: [1, 2] }))).toBe("2 results in 1 file");
    expect(summaryText(results({ a: [1, 2], b: [3] }))).toBe("3 results in 2 files");
  });
});

describe("describeSearchError", () => {
  it("keeps the regex diagram and recognises other errors", () => {
    const bad = describeSearchError(
      "[bad_regex] regex parse error:\n    (\n    ^\nerror: unclosed group",
    );
    expect(bad).toEqual({ badRegex: true, message: "    (\n    ^\nerror: unclosed group" });
    expect(describeSearchError("[not_found] not a folder")).toEqual({
      badRegex: false,
      message: "The folder was not found.",
    });
    expect(describeSearchError(new Error("boom")).message).toBe("Search failed: boom");
  });
});

describe("query rules", () => {
  it("needs two characters and seeds only from a usable selection", () => {
    expect(canSearch("a")).toBe(false);
    expect(canSearch("ab")).toBe(true);
    expect(seedQuery("useState")).toBe("useState");
    expect(seedQuery("   ")).toBeNull();
    expect(seedQuery(null)).toBeNull();
    expect(seedQuery("x".repeat(201))).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { ReviewChange } from "@/features/agents/reducer";
import type { GitStatus, StatusEntry } from "@/features/git/ipc";
import { effectiveSelection, pathKey, reviewSections, selectionForFile } from "./reviewList";

const change = (path: string): ReviewChange => ({ path, oldText: "a", newText: "b" });

const entry = (path: string, extra: Partial<StatusEntry> = {}): StatusEntry => ({
  path,
  origPath: null,
  staged: null,
  unstaged: null,
  untracked: false,
  conflicted: false,
  ...extra,
});

const status = (entries: StatusEntry[]): GitStatus => ({
  root: "C:/repo",
  branch: "main",
  head: "abc",
  upstream: null,
  ahead: 0,
  behind: 0,
  entries,
  truncated: false,
});

describe("pathKey", () => {
  it("compares Windows paths across slashes and case, others as spelled", () => {
    expect(pathKey("C:\\Repo\\src\\a.ts")).toBe(pathKey("c:/repo/src/a.ts"));
    expect(pathKey("/home/x/A.ts")).not.toBe(pathKey("/home/x/a.ts"));
    expect(pathKey("/home/x/")).toBe("/home/x");
  });
});

describe("reviewSections", () => {
  const git = status([
    entry("src/a.ts", { unstaged: "modified" }),
    entry("src/a.ts", { staged: "modified" }),
    entry("README.md", { staged: "modified" }),
    entry("notes.md", { untracked: true }),
  ]);

  it("lists the turn first and leaves its working tree rows out of the rest", () => {
    const s = reviewSections([change("C:\\repo\\src\\a.ts")], git);
    expect(s.turn.map((c) => c.path)).toEqual(["C:\\repo\\src\\a.ts"]);
    expect(s.changes.map((r) => r.path)).toEqual(["notes.md"]);
    // The staged side of the same file is the user's, so it stays.
    expect(s.staged.map((r) => r.path)).toEqual(["src/a.ts", "README.md"]);
    expect(s.count).toBe(3);
  });

  it("works with no turn changes and with no git status", () => {
    expect(reviewSections([], git).changes.map((r) => r.path)).toEqual(["src/a.ts", "notes.md"]);
    expect(reviewSections([change("/x/a.ts")], null)).toEqual({
      turn: [change("/x/a.ts")],
      staged: [],
      changes: [],
      count: 1,
    });
  });
});

describe("selection", () => {
  const s = reviewSections(
    [change("C:\\repo\\src\\a.ts")],
    status([entry("README.md", { staged: "modified" }), entry("b.ts", { unstaged: "modified" })]),
  );

  it("falls back to the first file when the selection is gone or unset", () => {
    expect(effectiveSelection(s, null)).toEqual({ kind: "turn", path: "C:\\repo\\src\\a.ts" });
    expect(effectiveSelection(s, { kind: "git", path: "gone.ts", staged: false })).toEqual({
      kind: "turn",
      path: "C:\\repo\\src\\a.ts",
    });
    const pick = { kind: "git", path: "b.ts", staged: false } as const;
    expect(effectiveSelection(s, pick)).toBe(pick);
    expect(effectiveSelection(reviewSections([], null), null)).toBeNull();
  });

  it("finds a file by its absolute path in either section", () => {
    expect(selectionForFile(s, "C:/repo", "c:/repo/src/a.ts")).toEqual({
      kind: "turn",
      path: "C:\\repo\\src\\a.ts",
    });
    expect(selectionForFile(s, "C:/repo", "C:\\repo\\b.ts")).toEqual({
      kind: "git",
      path: "b.ts",
      staged: false,
    });
    expect(selectionForFile(s, "C:/repo", "C:\\repo\\other.ts")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { describeGitError, pickName, worktreeName, worktreeOf, type Worktree } from "./worktrees";

const wt = (path: string, main = false): Worktree => ({
  path,
  branch: main ? "main" : `xora/${worktreeName(path)}`,
  head: "abc",
  main,
});

describe("worktreeOf / worktreeName", () => {
  const list = [wt("C:/repo", true), wt("C:/data/worktrees/repo/ankara")];

  it("finds the worktree a folder is, ignoring case and slashes, never the main checkout", () => {
    expect(worktreeOf(list, "c:\\DATA\\worktrees\\repo\\ankara\\")?.branch).toBe("xora/ankara");
    expect(worktreeOf(list, "C:/repo")).toBeNull();
  });

  it("names a worktree by its folder", () => {
    expect(worktreeName("C:/data/worktrees/repo/ankara/")).toBe("ankara");
  });
});

describe("describeGitError / pickName", () => {
  it("turns error codes into Turkish and keeps git's own text otherwise", () => {
    expect(describeGitError("[dirty] the worktree has uncommitted changes")).toMatch(
      /kaydedilmemiş/,
    );
    expect(describeGitError(new Error("[git] fatal: bad thing"))).toBe("fatal: bad thing");
  });

  it("picks a name from the list", () => {
    expect(pickName(() => 0)).toBe("ankara");
    expect(pickName(() => 0.9999)).toBe("uzungol");
  });
});

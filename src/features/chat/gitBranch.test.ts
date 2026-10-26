import { describe, expect, it } from "vitest";
import { parseGitdir, parseHead, readGitBranch } from "./gitBranch";

describe("parseHead", () => {
  it("reads branch refs, including slashes", () => {
    expect(parseHead("ref: refs/heads/main\n")).toBe("main");
    expect(parseHead("ref: refs/heads/feat/chat-ui")).toBe("feat/chat-ui");
  });

  it("shortens a detached commit and rejects junk", () => {
    expect(parseHead("8af7bf4c0ffee8af7bf4c0ffee8af7bf4c0ffee1\n")).toBe("8af7bf4");
    expect(parseHead("")).toBeNull();
    expect(parseHead("garbage")).toBeNull();
  });
});

describe("parseGitdir", () => {
  it("keeps absolute targets and resolves relative ones against the root", () => {
    expect(parseGitdir("gitdir: C:/repo/.git/worktrees/x\n", "C:/wt")).toBe(
      "C:/repo/.git/worktrees/x",
    );
    expect(parseGitdir("gitdir: ../.git/modules/sub", "C:\\repo\\sub\\")).toBe(
      "C:\\repo\\sub/../.git/modules/sub",
    );
    expect(parseGitdir("nope", "C:/x")).toBeNull();
  });
});

describe("readGitBranch", () => {
  const fs = (files: Record<string, string>) => (path: string) =>
    path in files ? Promise.resolve(files[path]) : Promise.reject(new Error("ENOENT"));

  it("reads a plain repository", async () => {
    expect(await readGitBranch("C:/p/", fs({ "C:/p/.git/HEAD": "ref: refs/heads/dev" }))).toBe(
      "dev",
    );
  });

  it("follows a worktree .git file", async () => {
    const files = {
      "C:/wt/.git": "gitdir: C:/repo/.git/worktrees/wt",
      "C:/repo/.git/worktrees/wt/HEAD": "ref: refs/heads/topic",
    };
    expect(await readGitBranch("C:/wt", fs(files))).toBe("topic");
  });

  it("returns null outside a repository", async () => {
    expect(await readGitBranch("C:/plain", fs({}))).toBeNull();
  });
});

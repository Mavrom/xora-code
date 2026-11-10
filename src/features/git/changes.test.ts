import { describe, expect, it } from "vitest";
import {
  activeCheckout,
  changeCount,
  commitBlocker,
  describeChangesError,
  discardPrompt,
  filePath,
  groupChanges,
  rowPaths,
  splitPath,
  statusLetter,
  statusTone,
  type ChangeRow,
} from "./changes";
import type { GitStatus, StatusEntry } from "./ipc";

const entry = (patch: Partial<StatusEntry> & { path: string }): StatusEntry => ({
  origPath: null,
  staged: null,
  unstaged: null,
  untracked: false,
  conflicted: false,
  ...patch,
});

const status = (entries: StatusEntry[]): GitStatus => ({
  root: "C:/repo",
  branch: "main",
  head: "abc1234",
  upstream: null,
  ahead: 0,
  behind: 0,
  entries,
  truncated: false,
});

const row = (patch: Partial<ChangeRow> & { path: string }): ChangeRow => ({
  origPath: null,
  kind: "modified",
  staged: false,
  ...patch,
});

describe("activeCheckout", () => {
  it("prefers the chat's folder, then the picked worktree, then the open folder", () => {
    expect(activeCheckout("C:/wt/x", "C:/wt/y", "C:/repo")).toBe("C:/wt/x");
    expect(activeCheckout(null, "C:/wt/y", "C:/repo")).toBe("C:/wt/y");
    expect(activeCheckout("", null, "C:/repo")).toBe("C:/repo");
    expect(activeCheckout(undefined, null, null)).toBeNull();
  });
});

describe("groupChanges", () => {
  it("puts each side of an entry in its own group", () => {
    const { staged, changes } = groupChanges([
      entry({ path: "both.ts", staged: "modified", unstaged: "modified" }),
      entry({ path: "new.ts", staged: "added" }),
      entry({ path: "b.ts", origPath: "a.ts", staged: "renamed" }),
      entry({ path: "gone.ts", unstaged: "deleted" }),
      entry({ path: "notes.md", untracked: true }),
      entry({ path: "clash.ts", conflicted: true }),
    ]);
    expect(staged.map((r) => [r.path, r.kind])).toEqual([
      ["both.ts", "modified"],
      ["new.ts", "added"],
      ["b.ts", "renamed"],
    ]);
    expect(staged.every((r) => r.staged)).toBe(true);
    expect(staged[2].origPath).toBe("a.ts");
    expect(changes.map((r) => [r.path, r.kind])).toEqual([
      ["both.ts", "modified"],
      ["gone.ts", "deleted"],
      ["notes.md", "untracked"],
      ["clash.ts", "conflicted"],
    ]);
    expect(changes.some((r) => r.staged)).toBe(false);
  });
});

describe("rowPaths", () => {
  it("adds a rename's old path once", () => {
    expect(
      rowPaths([
        row({ path: "b.ts", origPath: "a.ts" }),
        row({ path: "c.ts" }),
        row({ path: "c.ts" }),
      ]),
    ).toEqual(["b.ts", "a.ts", "c.ts"]);
  });
});

describe("changeCount", () => {
  it("counts changed files, not sides", () => {
    expect(changeCount(null)).toBe(0);
    expect(
      changeCount(status([entry({ path: "a", staged: "modified", unstaged: "modified" })])),
    ).toBe(1);
  });
});

describe("splitPath", () => {
  it("separates the name from its folder", () => {
    expect(splitPath("src/app/Main.tsx")).toEqual({ name: "Main.tsx", dir: "src/app" });
    expect(splitPath("README.md")).toEqual({ name: "README.md", dir: "" });
    expect(splitPath("klasör adı/dosya ş.md")).toEqual({ name: "dosya ş.md", dir: "klasör adı" });
  });
});

describe("filePath", () => {
  it("uses backslashes under a Windows root and slashes elsewhere", () => {
    expect(filePath("C:/repo", "src/a.ts")).toBe("C:\\repo\\src\\a.ts");
    expect(filePath("/home/u/repo/", "src/a.ts")).toBe("/home/u/repo/src/a.ts");
  });
});

describe("status letters", () => {
  it("has a letter and a token colour for every kind", () => {
    expect(statusLetter("untracked")).toBe("U");
    expect(statusLetter("conflicted")).toBe("!");
    expect(statusTone("modified")).toBe("text-warning");
    expect(statusTone("deleted")).toBe("text-danger");
    expect(statusTone("renamed")).toBe("text-fg-muted");
  });
});

describe("commitBlocker", () => {
  const staged = status([entry({ path: "a", staged: "modified" })]);

  it("explains why Commit is disabled", () => {
    expect(commitBlocker(null, "msg")).toBe("Bir git deposu değil.");
    expect(commitBlocker(status([entry({ path: "a", unstaged: "modified" })]), "msg")).toBe(
      "Commit için önce değişiklikleri stage'e al.",
    );
    expect(commitBlocker(staged, "   ")).toBe("Bir commit mesajı yaz.");
    expect(
      commitBlocker(status([...staged.entries, entry({ path: "b", conflicted: true })]), "msg"),
    ).toBe("Önce çakışmaları çöz.");
  });

  it("lets a staged set with a message through", () => {
    expect(commitBlocker(staged, "Fix it")).toBeNull();
  });
});

describe("discardPrompt", () => {
  it("names one file and warns when new files will be deleted", () => {
    expect(discardPrompt([row({ path: "src/a.ts" })])).toEqual({
      title: "“a.ts” dosyasındaki değişiklikler atılsın mı?",
      message: "Bu geri alınamaz.",
    });
    const many = discardPrompt([row({ path: "a" }), row({ path: "b", kind: "untracked" })]);
    expect(many.title).toBe("2 dosyadaki değişiklikler atılsın mı?");
    expect(many.message).toBe("Yeni dosyalar silinir. Bu geri alınamaz.");
  });
});

describe("describeChangesError", () => {
  it("maps codes to sentences and keeps git's text otherwise", () => {
    expect(describeChangesError("[auth] fatal: Authentication failed")).toBe(
      "Remote girişi reddetti. Git kimlik bilgilerini kontrol et.",
    );
    expect(describeChangesError(new Error("[rejected] ! [rejected] main"))).toBe(
      "Remote'ta sende olmayan commit'ler var. Önce pull, sonra push et.",
    );
    expect(describeChangesError("[timeout] the remote did not answer in 120 seconds")).toContain(
      "2 dakika",
    );
    expect(describeChangesError("[git] fatal: something odd")).toBe("fatal: something odd");
  });
});

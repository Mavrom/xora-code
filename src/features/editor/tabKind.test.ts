import { describe, expect, it } from "vitest";
import { diffTabKey, editorFileTab, fileKey, fileTabPaths, isDiffKey, tabFile } from "./tabKind";

describe("tab keys", () => {
  it("keys a diff apart from its file, for every kind of absolute path", () => {
    for (const file of ["C:\\p\\a.ts", "\\\\server\\share\\a.ts", "/home/u/a.ts"]) {
      const key = diffTabKey(file);
      expect(key).not.toBe(file);
      expect(isDiffKey(key)).toBe(true);
      expect(isDiffKey(file)).toBe(false);
      expect(tabFile(key)).toBe(file);
      expect(tabFile(file)).toBe(file);
    }
  });

  it("gives the file path only for file tabs", () => {
    expect(fileKey("C:\\p\\a.ts")).toBe("C:\\p\\a.ts");
    expect(fileKey(diffTabKey("C:\\p\\a.ts"))).toBeNull();
    expect(fileKey(null)).toBeNull();
    expect(isDiffKey(null)).toBe(false);
  });

  it("lists the paths of file tabs and skips diff tabs", () => {
    const tabs = [{ path: "/a.ts" }, { path: diffTabKey("/a.ts") }, { path: "/b.ts" }];
    expect(fileTabPaths(tabs)).toEqual(["/a.ts", "/b.ts"]);
  });
});

describe("editorFileTab", () => {
  const tabs = ["/a.ts", diffTabKey("/a.ts"), "/b.ts", diffTabKey("/c.ts")].map((path) => ({
    path,
  }));

  it("is the active tab when that is a file", () => {
    expect(editorFileTab(tabs, "/b.ts")?.path).toBe("/b.ts");
  });

  it("behind a diff tab, is the nearest file tab, left first", () => {
    expect(editorFileTab(tabs, diffTabKey("/a.ts"))?.path).toBe("/a.ts");
    expect(editorFileTab(tabs, diffTabKey("/c.ts"))?.path).toBe("/b.ts");
    expect(editorFileTab(tabs.slice(1), diffTabKey("/a.ts"))?.path).toBe("/b.ts");
  });

  it("is null when only diff tabs are open", () => {
    expect(editorFileTab([{ path: diffTabKey("/a.ts") }], diffTabKey("/a.ts"))).toBeNull();
    expect(editorFileTab([], null)).toBeNull();
  });
});

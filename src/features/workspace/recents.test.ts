import { describe, expect, it } from "vitest";
import {
  addFolder,
  MAX_RECENTS,
  parentLabel,
  parseFolders,
  parseRecents,
  pathKey,
  pushRecent,
  removeRecent,
  samePath,
} from "./recents";

describe("recent folders", () => {
  it("puts the newest first and de-duplicates across separator, case and trailing slash", () => {
    const list = pushRecent(["C:\\code\\a", "C:\\code\\b"], "c:/code/B/");
    expect(list).toEqual(["c:/code/B/", "C:\\code\\a"]);
  });

  it("keeps at most eight", () => {
    let list: string[] = [];
    for (let i = 0; i < 12; i++) list = pushRecent(list, `/p/${i}`);
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0]).toBe("/p/11");
    expect(list[list.length - 1]).toBe("/p/4");
  });

  it("removes a folder regardless of spelling", () => {
    expect(removeRecent(["C:\\a", "C:\\b"], "c:/A")).toEqual(["C:\\b"]);
  });

  it("parses stored lists defensively", () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents("not json")).toEqual([]);
    expect(parseRecents('{"a":1}')).toEqual([]);
    expect(parseRecents('["/a", 3, "", "/A", "/b"]')).toEqual(["/a", "/b"]);
  });

  it("compares paths loosely and labels the parent folder", () => {
    expect(pathKey("C:\\Code\\X\\")).toBe("c:/code/x");
    expect(samePath("/a/b", "/A/B/")).toBe(true);
    expect(parentLabel("C:\\code\\xora")).toBe("C:/code");
    expect(parentLabel("/home/me/proj/")).toBe("/home/me");
    expect(parentLabel("C:\\")).toBe("");
  });
});

describe("folder tabs", () => {
  it("appends new folders and keeps open ones in place", () => {
    expect(addFolder(["C:/a", "C:/b"], "c:\\A\\")).toEqual(["C:/a", "C:/b"]);
    expect(addFolder(["C:/a"], "C:/b")).toEqual(["C:/a", "C:/b"]);
  });

  it("parses stored tabs, dropping junk and duplicates", () => {
    expect(parseFolders('["C:/a", 3, "", "c:/A/", "C:/b"]')).toEqual(["C:/a", "C:/b"]);
    expect(parseFolders("{")).toEqual([]);
  });
});

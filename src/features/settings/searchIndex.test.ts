import { describe, expect, it } from "vitest";
import { fold, SEARCH_INDEX, searchSettings } from "./searchIndex";

describe("searchSettings", () => {
  it("folds Turkish letters both ways", () => {
    expect(fold("Görsel IŞIK ığ")).toBe("gorsel isik ig");
  });

  it("finds by label without diacritics, label matches first", () => {
    const results = searchSettings("yazi boyutu").map((e) => e.label);
    expect(results[0]).toBe("Yazı boyutu");
    expect(results).toContain("Sohbet yazı boyutu");
  });

  it("finds by keyword", () => {
    expect(searchSettings("zoom").map((e) => e.setting)).toEqual(["appearance.uiScale"]);
    expect(searchSettings("seffaf")[0].setting).toBe("appearance.window");
  });

  it("returns nothing for an empty query", () => {
    expect(searchSettings("   ")).toEqual([]);
  });

  it("indexes every setting at most once", () => {
    const paths = SEARCH_INDEX.flatMap((e) => (e.setting ? [e.setting] : []));
    expect(new Set(paths).size).toBe(paths.length);
  });
});

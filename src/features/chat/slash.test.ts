import { describe, expect, it } from "vitest";
import { applySlash, filterSlash, slashQuery, xoraCommandOf } from "./slash";

const COMMANDS = [
  { name: "review", description: "Değişiklikleri incele", input: { hint: "dosya ya da dal" } },
  { name: "compact", description: "Bağlamı sıkıştır" },
  { name: "review-branch", description: "Dalı incele" },
];

describe("slashQuery", () => {
  it("opens only for a leading slash while the caret is in the first word", () => {
    expect(slashQuery("/rev", 4)).toBe("rev");
    expect(slashQuery("/", 1)).toBe("");
    expect(slashQuery("/review src", 11)).toBeNull();
    expect(slashQuery("/review src", 3)).toBe("review");
    expect(slashQuery("merhaba /x", 10)).toBeNull();
    expect(slashQuery("/x", 0)).toBeNull();
  });
});

describe("filterSlash", () => {
  it("lists every agent command, then Xora's, for an empty query", () => {
    const names = filterSlash(COMMANDS, "").map((i) => `${i.group}:${i.name}`);
    expect(names).toEqual([
      "agent:review",
      "agent:compact",
      "agent:review-branch",
      "xora:new",
      "xora:clear",
    ]);
  });

  it("ranks by fuzzy score and keeps hints and match positions", () => {
    const items = filterSlash(COMMANDS, "rb");
    expect(items[0]).toMatchObject({ name: "review-branch", hint: null });
    expect(items[0].positions).toEqual([0, 7]);
    expect(filterSlash(COMMANDS, "rev")[0]).toMatchObject({
      name: "review",
      hint: "dosya ya da dal",
    });
  });

  it("drops non-matching commands", () => {
    expect(filterSlash(COMMANDS, "zzz")).toEqual([]);
    expect(filterSlash([], "clr").map((i) => i.name)).toEqual(["clear"]);
  });
});

describe("applySlash", () => {
  it("replaces the typed name and keeps arguments", () => {
    expect(applySlash("/rev", "review")).toBe("/review ");
    expect(applySlash("/rv src/lib.rs", "review")).toBe("/review src/lib.rs");
  });
});

describe("xoraCommandOf", () => {
  it("recognises bare Xora commands only", () => {
    expect(xoraCommandOf("/new")).toBe("new");
    expect(xoraCommandOf(" /clear ")).toBe("clear");
    expect(xoraCommandOf("/new chat")).toBeNull();
    expect(xoraCommandOf("/review")).toBeNull();
    expect(xoraCommandOf("new")).toBeNull();
  });
});

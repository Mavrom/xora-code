import { describe, expect, it } from "vitest";
import { applyPatch, isEmptyPatch, mergePatches } from "./merge";
import { DEFAULT_SETTINGS } from "./types";

describe("applyPatch", () => {
  it("replaces only the touched section", () => {
    const next = applyPatch(DEFAULT_SETTINGS, { editor: { fontSize: 15 } });
    expect(next.editor.fontSize).toBe(15);
    expect(next.editor.tabSize).toBe(2);
    expect(next.general).toBe(DEFAULT_SETTINGS.general);
    expect(next.editor).not.toBe(DEFAULT_SETTINGS.editor);
  });

  it("returns the same object when nothing changes", () => {
    expect(applyPatch(DEFAULT_SETTINGS, {})).toBe(DEFAULT_SETTINGS);
    expect(applyPatch(DEFAULT_SETTINGS, { editor: { fontSize: 13 } })).toBe(DEFAULT_SETTINGS);
  });
});

describe("mergePatches", () => {
  it("lets later fields win and keeps the rest", () => {
    expect(
      mergePatches(
        { editor: { fontSize: 14, minimap: true }, general: { openLastFolder: false } },
        { editor: { fontSize: 16 }, agent: { defaultEffort: "high" } },
      ),
    ).toEqual({
      editor: { fontSize: 16, minimap: true },
      general: { openLastFolder: false },
      agent: { defaultEffort: "high" },
    });
  });
});

describe("isEmptyPatch", () => {
  it("treats empty sections as empty", () => {
    expect(isEmptyPatch({})).toBe(true);
    expect(isEmptyPatch({ editor: {} })).toBe(true);
    expect(isEmptyPatch({ editor: { minimap: false } })).toBe(false);
  });
});

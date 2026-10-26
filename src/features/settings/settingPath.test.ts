import { describe, expect, it } from "vitest";
import { isModified, modifiedPaths, resetPatch, valueAt } from "./settingPath";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const changed: Settings = {
  ...DEFAULT_SETTINGS,
  editor: { ...DEFAULT_SETTINGS.editor, fontSize: 16 },
  agent: { ...DEFAULT_SETTINGS.agent, hiddenModels: ["claude:x"] },
};

describe("setting paths", () => {
  it("reads a value", () => {
    expect(valueAt(changed, "editor.fontSize")).toBe(16);
  });

  it("knows what differs from the default, arrays included", () => {
    expect(isModified(changed, "editor.fontSize")).toBe(true);
    expect(isModified(changed, "editor.tabSize")).toBe(false);
    expect(isModified(changed, "agent.hiddenModels")).toBe(true);
    expect(modifiedPaths(changed, ["editor.fontSize", "editor.tabSize"])).toEqual([
      "editor.fontSize",
    ]);
  });

  it("builds the patch that resets one setting", () => {
    expect(resetPatch("editor.fontSize")).toEqual({ editor: { fontSize: 13 } });
  });
});

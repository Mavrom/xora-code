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

  it("applies every section, the terminal included", () => {
    const next = applyPatch(DEFAULT_SETTINGS, { terminal: { shell: "cmd", fontSize: 15 } });
    expect(next.terminal).toEqual({ shell: "cmd", fontSize: 15 });
    expect(isEmptyPatch({ terminal: { fontSize: 15 } })).toBe(false);
    expect(mergePatches({ terminal: { shell: "cmd" } }, { terminal: { fontSize: 15 } })).toEqual({
      terminal: { shell: "cmd", fontSize: 15 },
    });
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

describe("keybindings", () => {
  const withSave = { ...DEFAULT_SETTINGS, keybindings: { "editor.save": "mod+alt+s" } };

  it("are replaced whole, not merged", () => {
    const next = applyPatch(withSave, { keybindings: { "chat.new": null } });
    expect(next.keybindings).toEqual({ "chat.new": null });
    expect(next.editor).toBe(withSave.editor);
    expect(applyPatch(withSave, { keybindings: {} }).keybindings).toEqual({});
  });

  it("keep the settings object when the map is the same", () => {
    expect(applyPatch(withSave, { keybindings: { "editor.save": "mod+alt+s" } })).toBe(withSave);
  });

  it("count as a change even when emptied, and the later map wins", () => {
    expect(isEmptyPatch({ keybindings: {} })).toBe(false);
    expect(
      mergePatches(
        { keybindings: { "editor.save": null }, editor: { minimap: true } },
        { keybindings: { "chat.new": "mod+j" } },
      ),
    ).toEqual({ keybindings: { "chat.new": "mod+j" }, editor: { minimap: true } });
  });
});

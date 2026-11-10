import { describe, expect, it } from "vitest";
import { ACTIONS } from "./actions";
import { parseBinding } from "./binding";
import { ev } from "./characterization.cases";
import {
  bindingsOf,
  matchesAction,
  monacoKeybinding,
  monacoKeybindings,
  resolve,
  shortcutOf,
  shortcutsOf,
} from "./keymap";

// Values as in monaco-editor's KeyMod / KeyCode.
const MONACO = {
  KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512, WinCtrl: 256 },
  KeyCode: { KeyL: 42, KeyS: 49, Backquote: 91, Equal: 86, F5: 63, Escape: 9 },
};

describe("defaults", () => {
  it("are all valid canonical bindings, and no two actions share one", () => {
    const seen = new Map<string, string>();
    for (const action of ACTIONS) {
      for (const text of action.defaults) {
        expect(parseBinding(text), text).not.toBeNull();
        expect(seen.get(text), text).toBeUndefined();
        seen.set(text, action.id);
      }
    }
  });

  it("are what the shortcut hints show", () => {
    expect(shortcutsOf("palette.open", {})).toEqual(["mod+k", "mod+shift+p"]);
    expect(shortcutOf("view.changes", {})).toBe("ctrl+shift+g");
    expect(shortcutOf("view.zoomIn", {})).toBe("mod+plus");
  });
});

describe("overrides", () => {
  it("replace every default binding of the action", () => {
    const overrides = { "palette.open": "mod+j" };
    expect(shortcutsOf("palette.open", overrides)).toEqual(["mod+j"]);
    expect(matchesAction(ev("ctrl", "j", "KeyJ"), "palette.open", "other", overrides)).toBe(true);
    expect(matchesAction(ev("ctrl", "k", "KeyK"), "palette.open", "other", overrides)).toBe(false);
    expect(resolve(ev("ctrl+shift", "P", "KeyP"), "other", overrides)).toBeNull();
  });

  it("unbind with null", () => {
    const overrides = { "editor.save": null };
    expect(bindingsOf("editor.save", overrides)).toEqual([]);
    expect(shortcutOf("editor.save", overrides)).toBeUndefined();
    expect(resolve(ev("ctrl", "s", "KeyS"), "other", overrides)).toBeNull();
  });

  it("fall back to the default when unreadable", () => {
    expect(shortcutOf("editor.save", { "editor.save": "nonsense+" })).toBe("mod+s");
  });
});

describe("monacoKeybinding", () => {
  it("gives Ctrl+L (CtrlCmd) for the editor's add-to-chat, as before", () => {
    expect(monacoKeybindings("editor.addToChat", MONACO)).toEqual([
      MONACO.KeyMod.CtrlCmd | MONACO.KeyCode.KeyL,
    ]);
  });

  it("maps Control to WinCtrl on macOS only", () => {
    const binding = parseBinding("ctrl+`")!;
    expect(monacoKeybinding(binding, MONACO, "other")).toBe(2048 | 91);
    expect(monacoKeybinding(binding, MONACO, "mac")).toBe(256 | 91);
  });

  it("returns null for a key Monaco has no code for", () => {
    expect(monacoKeybinding(parseBinding("mod+ş")!, MONACO, "other")).toBeNull();
  });
});

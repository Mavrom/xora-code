import { afterEach, describe, expect, it, vi } from "vitest";
import { isBindable, registerCommandActions } from "@/features/keymap/actions";
import { ev } from "@/features/keymap/characterization.cases";
import { setKeymapOverrides } from "@/features/keymap/keymap";
import { commandForKey, handleCommandKey } from "./commandShortcuts";

registerCommandActions(["test.stage", "test.hidden"]);

const press = (mods: string, key: string, code: string, repeat = false) => ({
  ...ev(mods, key, code),
  repeat,
  defaultPrevented: false,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

describe("palette commands bound in Settings", () => {
  afterEach(() => setKeymapOverrides({}));

  it("are bindable by their command id; dedicated actions are not registered twice", () => {
    expect(isBindable("test.stage")).toBe(true);
    expect(isBindable("test.unknown")).toBe(false);
    registerCommandActions(["editor.save"]);
    expect(
      commandForKey(ev("ctrl", "s", "KeyS"), [{ id: "editor.save", run: () => {} }]),
    ).toBeNull();
  });

  it("run once on their binding, and claim the key", () => {
    const run = vi.fn();
    setKeymapOverrides({ "test.stage": "mod+alt+a" });
    const e = press("ctrl+alt", "a", "KeyA");
    expect(handleCommandKey(e, [{ id: "test.stage", run }], false)).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
    // A held key does not run it again.
    handleCommandKey(press("ctrl+alt", "a", "KeyA", true), [{ id: "test.stage", run }], false);
    expect(run).toHaveBeenCalledOnce();
  });

  it("do nothing, and leave the key alone, while not available", () => {
    const run = vi.fn();
    setKeymapOverrides({ "test.hidden": "mod+alt+h" });
    const e = press("ctrl+alt", "h", "KeyH");
    const commands = [{ id: "test.hidden", when: () => false, run }];
    expect(handleCommandKey(e, commands, false)).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(e.stopPropagation).not.toHaveBeenCalled();
  });

  it("stay quiet while the palette or a dialog is open, or the key was taken", () => {
    const run = vi.fn();
    setKeymapOverrides({ "test.stage": "mod+alt+a" });
    expect(
      handleCommandKey(press("ctrl+alt", "a", "KeyA"), [{ id: "test.stage", run }], true),
    ).toBe(false);
    const taken = { ...press("ctrl+alt", "a", "KeyA"), defaultPrevented: true };
    expect(handleCommandKey(taken, [{ id: "test.stage", run }], false)).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("never run a command that has its own handler (no double fire)", () => {
    const run = vi.fn();
    // editor.save is a keymap action with a dedicated handler; Ctrl+S is its default.
    const e = press("ctrl", "s", "KeyS");
    expect(handleCommandKey(e, [{ id: "editor.save", run }], false)).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it("ignore keys bound to nothing", () => {
    const run = vi.fn();
    expect(
      handleCommandKey(press("ctrl+alt", "a", "KeyA"), [{ id: "test.stage", run }], false),
    ).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});

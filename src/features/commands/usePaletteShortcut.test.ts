import { describe, expect, it } from "vitest";
import { isPaletteShortcut } from "./usePaletteShortcut";

const key = (
  k: string,
  mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean },
) => ({
  key: k,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
});

describe("isPaletteShortcut", () => {
  it("accepts Ctrl+K and Ctrl+Shift+P (and Cmd on macOS)", () => {
    expect(isPaletteShortcut(key("k", { ctrl: true }))).toBe(true);
    expect(isPaletteShortcut(key("K", { ctrl: true }))).toBe(true);
    expect(isPaletteShortcut(key("P", { ctrl: true, shift: true }))).toBe(true);
    expect(isPaletteShortcut(key("k", { meta: true }))).toBe(true);
  });

  it("rejects other combinations", () => {
    expect(isPaletteShortcut(key("k", {}))).toBe(false);
    expect(isPaletteShortcut(key("p", { ctrl: true }))).toBe(false);
    expect(isPaletteShortcut(key("K", { ctrl: true, shift: true }))).toBe(false);
    expect(isPaletteShortcut(key("k", { ctrl: true, alt: true }))).toBe(false);
  });
});

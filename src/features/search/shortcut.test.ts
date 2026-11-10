import { describe, expect, it } from "vitest";
import { isFindInFilesShortcut, toggleFor } from "./shortcut";

const key = (code: string, mods: Partial<Record<"ctrl" | "meta" | "shift" | "alt", boolean>>) => ({
  code,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
});

describe("isFindInFilesShortcut", () => {
  it("matches Ctrl+Shift+F and Cmd+Shift+F only", () => {
    expect(isFindInFilesShortcut(key("KeyF", { ctrl: true, shift: true }))).toBe(true);
    expect(isFindInFilesShortcut(key("KeyF", { meta: true, shift: true }))).toBe(true);
    expect(isFindInFilesShortcut(key("KeyF", { ctrl: true }))).toBe(false);
    expect(isFindInFilesShortcut(key("KeyF", { ctrl: true, shift: true, alt: true }))).toBe(false);
    expect(isFindInFilesShortcut(key("KeyG", { ctrl: true, shift: true }))).toBe(false);
  });
});

describe("toggleFor", () => {
  it("maps Alt+C/W/R to the options and ignores AltGr", () => {
    expect(toggleFor(key("KeyC", { alt: true }))).toBe("caseSensitive");
    expect(toggleFor(key("KeyW", { alt: true }))).toBe("wholeWord");
    expect(toggleFor(key("KeyR", { alt: true }))).toBe("regex");
    expect(toggleFor(key("KeyC", { alt: true, ctrl: true }))).toBeUndefined();
    expect(toggleFor(key("KeyC", {}))).toBeUndefined();
    expect(toggleFor(key("KeyX", { alt: true }))).toBeUndefined();
  });
});

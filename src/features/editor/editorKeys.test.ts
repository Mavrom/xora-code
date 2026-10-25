import { describe, expect, it } from "vitest";
import { isCloseTabShortcut, isSaveShortcut } from "./editorKeys";

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

describe("editor shortcuts", () => {
  it("matches Ctrl/Cmd+W and Ctrl/Cmd+S, any letter case", () => {
    expect(isCloseTabShortcut(key("w", { ctrl: true }))).toBe(true);
    expect(isCloseTabShortcut(key("W", { meta: true }))).toBe(true);
    expect(isSaveShortcut(key("s", { ctrl: true }))).toBe(true);
    expect(isSaveShortcut(key("S", { meta: true }))).toBe(true);
  });

  it("rejects extra modifiers and bare keys", () => {
    expect(isCloseTabShortcut(key("w", {}))).toBe(false);
    expect(isCloseTabShortcut(key("w", { ctrl: true, shift: true }))).toBe(false);
    expect(isCloseTabShortcut(key("w", { ctrl: true, alt: true }))).toBe(false);
    expect(isSaveShortcut(key("s", { ctrl: true, shift: true }))).toBe(false);
    expect(isSaveShortcut(key("w", { ctrl: true }))).toBe(false);
  });
});

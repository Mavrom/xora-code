import { describe, expect, it } from "vitest";
import { isCloseTabShortcut, isSaveShortcut, revealTabScroll } from "./editorKeys";

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

describe("revealTabScroll", () => {
  // Five 100px tabs in a 250px strip with 16px fades.
  const tabs = [0, 100, 200, 300, 400].map((start) => ({ start, end: start + 100 }));
  const reveal = (index: number, scrollLeft: number) =>
    revealTabScroll(tabs, index, scrollLeft, 250, 16);

  it("leaves a fully visible tab alone", () => {
    expect(reveal(1, 0)).toBeNull();
  });

  it("reveals a tab on the left clear of the fade (the first one flush)", () => {
    expect(reveal(2, 250)).toBe(184);
    expect(reveal(0, 120)).toBe(0);
  });

  it("reveals a tab on the right and never leaves a half-cut label on the left", () => {
    // Plain reveal would be 266 (edge at 282, cutting tab 2 mid-label): snap to its end.
    expect(reveal(4, 0)).toBe(284);
  });

  it("ignores an unknown index", () => {
    expect(reveal(9, 0)).toBeNull();
  });
});

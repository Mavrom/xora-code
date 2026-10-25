import { afterEach, describe, expect, it, vi } from "vitest";
import { installPaletteGuard, isGlobalShortcut, setPaletteOpen } from "./paletteGuard";

const key = (
  k: string,
  code: string,
  mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {},
) => ({
  key: k,
  code,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
});

describe("isGlobalShortcut", () => {
  it("matches Ctrl+W, Ctrl+S and Ctrl+Shift+N/E (Cmd too)", () => {
    expect(isGlobalShortcut(key("w", "KeyW", { ctrl: true }))).toBe(true);
    expect(isGlobalShortcut(key("S", "KeyS", { meta: true }))).toBe(true);
    expect(isGlobalShortcut(key("N", "KeyN", { ctrl: true, shift: true }))).toBe(true);
    expect(isGlobalShortcut(key("E", "KeyE", { ctrl: true, shift: true }))).toBe(true);
  });

  it("leaves editing keys and the palette's own shortcuts alone", () => {
    expect(isGlobalShortcut(key("w", "KeyW"))).toBe(false);
    expect(isGlobalShortcut(key("a", "KeyA", { ctrl: true }))).toBe(false);
    expect(isGlobalShortcut(key("v", "KeyV", { ctrl: true }))).toBe(false);
    expect(isGlobalShortcut(key("k", "KeyK", { ctrl: true }))).toBe(false);
    expect(isGlobalShortcut(key("P", "KeyP", { ctrl: true, shift: true }))).toBe(false);
    expect(isGlobalShortcut(key("w", "KeyW", { ctrl: true, alt: true }))).toBe(false);
    expect(isGlobalShortcut(key("Escape", "Escape"))).toBe(false);
  });
});

describe("installPaletteGuard", () => {
  afterEach(() => setPaletteOpen(false));

  let listener: ((e: KeyboardEvent) => void) | undefined;
  const target = {
    addEventListener: vi.fn((_type: string, fn: (e: KeyboardEvent) => void, capture: boolean) => {
      expect(capture).toBe(true);
      listener = fn;
    }),
  } as unknown as Pick<Window, "addEventListener">;

  const fire = (init: ReturnType<typeof key>) => {
    const e = { ...init, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
    listener?.(e as unknown as KeyboardEvent);
    return e;
  };

  it("installs once and swallows global shortcuts only while the palette is open", () => {
    installPaletteGuard(target);
    installPaletteGuard(target);
    expect(target.addEventListener).toHaveBeenCalledOnce();

    const ctrlW = key("w", "KeyW", { ctrl: true });
    expect(fire(ctrlW).stopImmediatePropagation).not.toHaveBeenCalled();

    setPaletteOpen(true);
    const swallowed = fire(ctrlW);
    expect(swallowed.preventDefault).toHaveBeenCalled();
    expect(swallowed.stopImmediatePropagation).toHaveBeenCalled();
    expect(fire(key("ArrowDown", "ArrowDown")).stopImmediatePropagation).not.toHaveBeenCalled();
  });
});

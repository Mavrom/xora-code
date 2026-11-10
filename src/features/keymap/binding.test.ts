import { describe, expect, it } from "vitest";
import { ev } from "./characterization.cases";
import { formatBinding, matches, normalizeBinding, parseBinding } from "./binding";

describe("parseBinding / formatBinding", () => {
  it("round-trips the canonical form", () => {
    for (const text of [
      "mod+k",
      "mod+shift+p",
      "ctrl+shift+g",
      "ctrl+`",
      "shift+alt+f5",
      "mod+,",
    ]) {
      expect(normalizeBinding(text)).toBe(text);
    }
  });

  it("orders modifiers and accepts aliases", () => {
    expect(normalizeBinding("Shift+Ctrl+G")).toBe("ctrl+shift+g");
    expect(normalizeBinding("alt+shift+F5")).toBe("shift+alt+f5");
    expect(normalizeBinding("cmd+option+k")).toBe("mod+alt+k");
    expect(normalizeBinding("Ctrl+Esc")).toBe("ctrl+escape");
    expect(normalizeBinding("mod+ArrowUp")).toBe("mod+up");
  });

  it("spells + as plus", () => {
    expect(normalizeBinding("mod++")).toBe("mod+plus");
    expect(normalizeBinding("mod+=")).toBe("mod+plus");
    expect(normalizeBinding("mod+plus")).toBe("mod+plus");
    expect(normalizeBinding("mod+-")).toBe("mod+-");
  });

  it("keeps a layout's own characters", () => {
    expect(normalizeBinding("mod+ş")).toBe("mod+ş");
  });

  it("rejects what is not one key with modifiers", () => {
    for (const text of ["", "mod", "mod+", "k+mod", "mod+k+l", "hyper+k", "mod+enterr", "f25"]) {
      expect(parseBinding(text)).toBeNull();
    }
  });

  it("formats from parts", () => {
    expect(formatBinding({ mod: true, ctrl: false, shift: true, alt: false, key: "g" })).toBe(
      "mod+shift+g",
    );
  });
});

describe("matches", () => {
  const b = (text: string) => parseBinding(text)!;

  it("takes Ctrl or Cmd for mod, and only Control for ctrl", () => {
    expect(matches(ev("ctrl", "k", "KeyK"), b("mod+k"), "mac")).toBe(true);
    expect(matches(ev("meta", "k", "KeyK"), b("mod+k"), "mac")).toBe(true);
    expect(matches(ev("meta+shift", "G", "KeyG"), b("ctrl+shift+g"), "mac")).toBe(false);
    expect(matches(ev("ctrl+shift", "G", "KeyG"), b("ctrl+shift+g"), "mac")).toBe(true);
  });

  it("needs both Cmd and Control on macOS for mod+ctrl", () => {
    expect(matches(ev("ctrl+meta", "k", "KeyK"), b("mod+ctrl+k"), "mac")).toBe(true);
    expect(matches(ev("meta", "k", "KeyK"), b("mod+ctrl+k"), "mac")).toBe(false);
    expect(matches(ev("ctrl", "k", "KeyK"), b("mod+ctrl+k"), "other")).toBe(true);
  });

  it("compares Alt and Shift exactly, AltGr (Ctrl+Alt) included", () => {
    expect(matches(ev("ctrl+alt", "g", "KeyG"), b("mod+g"), "other")).toBe(false);
    expect(matches(ev("ctrl+alt", "g", "KeyG"), b("mod+alt+g"), "other")).toBe(true);
    expect(matches(ev("ctrl+shift", "G", "KeyG"), b("mod+g"), "other")).toBe(false);
  });

  it("matches named keys, F-keys and punctuation by the key typed", () => {
    expect(matches(ev("", "Escape", "Escape"), b("escape"), "other")).toBe(true);
    expect(matches(ev("alt", "F5", "F5"), b("alt+f5"), "other")).toBe(true);
    expect(matches(ev("ctrl", ",", "Comma"), b("mod+,"), "other")).toBe(true);
    expect(matches(ev("ctrl", "/", "Slash"), b("mod+/"), "other")).toBe(true);
    expect(matches(ev("ctrl", "ş", "Semicolon"), b("mod+ş"), "other")).toBe(true);
  });

  it("matches ` by the physical key", () => {
    expect(matches(ev("ctrl", '"', "Backquote"), b("ctrl+`"), "other")).toBe(true);
    expect(matches(ev("ctrl", "`", "Equal"), b("ctrl+`"), "other")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { ev } from "./characterization.cases";
import { resolve } from "./keymap";

// Letters and digits follow the character typed, with the physical key as the fallback when
// the key types no Latin letter or digit. Before the keymap, some handlers read the
// character (K, P, S, W, ",") and others the physical key (B, N, and the Ctrl+Shift
// letters), so on layouts that move letters the two halves disagreed.
const fires = (mods: string, key: string, code: string) =>
  resolve(ev(mods, key, code), "other", {});

describe("keyboard layouts", () => {
  it("AZERTY: Ctrl+Z (on the physical W key) is undo, not close tab", () => {
    expect(fires("ctrl", "z", "KeyW")).toBeNull();
    expect(fires("ctrl", "w", "KeyZ")).toBe("editor.closeTab");
  });

  it("AZERTY: Ctrl+0 resets the zoom though the key types à", () => {
    expect(fires("ctrl", "à", "Digit0")).toBe("view.zoomReset");
  });

  it("Turkish F: shortcuts follow the printed letters", () => {
    // The physical N key types z on Turkish F: Ctrl+Z is undo, not a new chat.
    expect(fires("ctrl", "z", "KeyN")).toBeNull();
    // n sits on the physical I key.
    expect(fires("ctrl", "n", "KeyI")).toBe("chat.new");
    // g sits on the physical W key; Shift keeps working.
    expect(fires("ctrl+shift", "G", "KeyW")).toBe("view.changes");
  });

  it("Turkish F: a key that types a Turkish letter falls back to its physical key", () => {
    // The physical B key types ç.
    expect(fires("ctrl", "ç", "KeyB")).toBe("view.toggleSidebar");
  });

  it("Turkish Q: the shifted combos still work", () => {
    expect(fires("ctrl+shift", "G", "KeyG")).toBe("view.changes");
    expect(fires("ctrl+shift", "F", "KeyF")).toBe("search.findInFiles");
    expect(fires("ctrl+shift", "P", "KeyP")).toBe("palette.open");
  });

  it("Cyrillic: the physical key decides", () => {
    expect(fires("ctrl", "л", "KeyK")).toBe("palette.open");
    expect(fires("ctrl", "ы", "KeyS")).toBe("editor.save");
  });

  it("macOS Option+letter types a symbol or a dead key: the physical key decides", () => {
    expect(resolve(ev("alt", "Dead", "KeyE"), "mac", { "chat.new": "alt+e" })).toBe("chat.new");
    expect(resolve(ev("alt", "ç", "KeyC"), "mac", { "chat.new": "alt+c" })).toBe("chat.new");
  });
});

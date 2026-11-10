import { describe, expect, it } from "vitest";
import { formatBinding, parseBinding } from "./binding";
import { captureStep, findConflict, overlaps, refusal, samePress, scopesOverlap } from "./capture";
import { ev } from "./characterization.cases";

const b = (text: string) => parseBinding(text)!;

/** The canonical text a key press records, or the step kind when it records nothing. */
function recorded(mods: string, key: string, code: string, platform: "mac" | "other" = "other") {
  const step = captureStep(ev(mods, key, code), platform);
  return step.kind === "binding" ? formatBinding(step.binding) : step.kind;
}

describe("captureStep", () => {
  it("records Ctrl as mod off macOS, Cmd as mod and Control as ctrl on macOS", () => {
    expect(recorded("ctrl+shift", "G", "KeyG")).toBe("mod+shift+g");
    expect(recorded("meta+shift", "G", "KeyG", "mac")).toBe("mod+shift+g");
    expect(recorded("ctrl+shift", "G", "KeyG", "mac")).toBe("ctrl+shift+g");
    expect(recorded("ctrl+meta", "k", "KeyK", "mac")).toBe("mod+ctrl+k");
  });

  it("records what the matcher will match: letters, digits, `, + and -", () => {
    expect(recorded("ctrl", '"', "Backquote")).toBe("mod+`");
    expect(recorded("ctrl+shift", "+", "Equal")).toBe("mod+plus");
    expect(recorded("ctrl", "-", "NumpadSubtract")).toBe("mod+-");
    expect(recorded("ctrl+shift", "!", "Digit1")).toBe("mod+shift+1");
    expect(recorded("ctrl", "л", "KeyK")).toBe("mod+k");
    expect(recorded("alt", "å", "KeyA", "mac")).toBe("alt+a");
    expect(recorded("", "F6", "F6")).toBe("f6");
    expect(recorded("ctrl", ",", "Comma")).toBe("mod+,");
  });

  it("waits through modifiers alone, cancels on Esc, clears on Backspace or Delete", () => {
    expect(recorded("ctrl", "Control", "ControlLeft")).toBe("wait");
    expect(recorded("shift", "Shift", "ShiftLeft")).toBe("wait");
    expect(recorded("", "Escape", "Escape")).toBe("cancel");
    expect(recorded("", "Backspace", "Backspace")).toBe("clear");
    expect(recorded("", "Delete", "Delete")).toBe("clear");
    expect(recorded("ctrl", "Backspace", "Backspace")).toBe("mod+backspace");
  });

  it("refuses AltGr characters and the Windows key", () => {
    expect(recorded("ctrl+alt", "@", "KeyQ")).toBe("refused");
    expect(recorded("ctrl+alt", "k", "KeyK")).toBe("mod+alt+k");
    expect(recorded("meta", "e", "KeyE")).toBe("refused");
    expect(recorded("ctrl+alt", "@", "KeyQ", "mac")).toBe("ctrl+alt+q");
  });
});

describe("refusal", () => {
  it("needs Ctrl, Cmd or Alt for typing keys; bare F-keys are fine", () => {
    expect(refusal(b("g"), "global", "other")).not.toBeNull();
    expect(refusal(b("shift+g"), "global", "other")).not.toBeNull();
    expect(refusal(b("shift+,"), "global", "mac")).not.toBeNull();
    expect(refusal(b("5"), "global", "other")).not.toBeNull();
    expect(refusal(b("alt+g"), "global", "other")).toBeNull();
    expect(refusal(b("f6"), "global", "other")).toBeNull();
    expect(refusal(b("shift+f6"), "global", "other")).toBeNull();
  });

  it("keeps Tab, Enter, Space and arrows for typing and navigation", () => {
    for (const key of ["tab", "enter", "space", "up", "shift+tab", "shift+enter"]) {
      expect(refusal(b(key), "global", "other"), key).not.toBeNull();
    }
    expect(refusal(b("mod+enter"), "global", "other")).toBeNull();
  });

  it("refuses the reserved combinations, Ctrl written either way", () => {
    for (const text of [
      "mod+c",
      "ctrl+v",
      "mod+z",
      "mod+shift+z",
      "mod+f",
      "mod+shift+i",
      "alt+f4",
    ]) {
      expect(refusal(b(text), "global", "other"), text).not.toBeNull();
    }
    expect(refusal(b("mod+q"), "global", "mac")).not.toBeNull();
    expect(refusal(b("mod+q"), "global", "other")).toBeNull();
    expect(refusal(b("alt+f4"), "global", "mac")).toBeNull();
    // On macOS Control+C is not copy.
    expect(refusal(b("ctrl+c"), "global", "mac")).toBeNull();
  });

  it("refuses keys the editor cannot bind for editor actions only", () => {
    expect(refusal(b("mod+ş"), "editor", "other")).not.toBeNull();
    expect(refusal(b("mod+ş"), "global", "other")).toBeNull();
  });
});

describe("overlaps", () => {
  it("treats mod and ctrl as the same key off macOS, and mod as taking Control on macOS", () => {
    expect(overlaps(b("mod+b"), b("ctrl+b"), "other")).toBe(true);
    expect(overlaps(b("mod+b"), b("ctrl+b"), "mac")).toBe(true);
    expect(overlaps(b("mod+ctrl+b"), b("ctrl+b"), "mac")).toBe(false);
    expect(overlaps(b("mod+b"), b("alt+b"), "other")).toBe(false);
    expect(overlaps(b("mod+b"), b("mod+shift+b"), "other")).toBe(false);
    expect(overlaps(b("mod+plus"), b("mod+shift+plus"), "other")).toBe(true);
  });
});

describe("findConflict", () => {
  it("names the action that already has the binding", () => {
    expect(findConflict("view.changes", b("ctrl+`"), {}, "other")).toBe("view.toggleTerminal");
    expect(findConflict("view.changes", b("mod+`"), {}, "other")).toBe("view.toggleTerminal");
    expect(findConflict("view.changes", b("mod+shift+p"), {}, "other")).toBe("palette.open");
    expect(findConflict("view.changes", b("mod+alt+g"), {}, "other")).toBeNull();
  });

  it("follows overrides, and ignores the action's own binding", () => {
    expect(findConflict("chat.new", b("mod+n"), {}, "other")).toBeNull();
    expect(
      findConflict("view.changes", b("ctrl+`"), { "view.toggleTerminal": null }, "other"),
    ).toBeNull();
    expect(findConflict("view.changes", b("mod+j"), { "chat.new": "mod+j" }, "other")).toBe(
      "chat.new",
    );
  });

  it("lets the editor and the composer share a binding, never with a global action", () => {
    expect(scopesOverlap("editor", "composer")).toBe(false);
    expect(findConflict("chat.stop", b("mod+l"), {}, "other")).toBeNull();
    expect(findConflict("editor.addToChat", b("mod+b"), {}, "other")).toBe("view.toggleSidebar");
  });
});

describe("samePress", () => {
  it("knows Ctrl+Shift+G recorded on Windows is the ctrl+shift+g default", () => {
    expect(samePress(b("mod+shift+g"), b("ctrl+shift+g"), "other")).toBe(true);
    expect(samePress(b("mod+shift+g"), b("ctrl+shift+g"), "mac")).toBe(false);
  });
});

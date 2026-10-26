import { describe, expect, it } from "vitest";
import { clipboardAction, isNewTerminalShortcut, isToggleTerminalShortcut } from "./keys";

const key = (init: Partial<KeyboardEvent> & { type?: string }) => ({
  type: "keydown",
  key: "",
  code: "",
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...init,
});

describe("terminal shortcuts", () => {
  it("matches Ctrl+` by physical key on any layout", () => {
    expect(isToggleTerminalShortcut(key({ ctrlKey: true, code: "Backquote", key: '"' }))).toBe(
      true,
    );
    expect(isToggleTerminalShortcut(key({ code: "Backquote" }))).toBe(false);
    expect(
      isToggleTerminalShortcut(key({ ctrlKey: true, shiftKey: true, code: "Backquote" })),
    ).toBe(false);
  });

  it("matches Ctrl+Shift+` for a new tab", () => {
    expect(isNewTerminalShortcut(key({ ctrlKey: true, shiftKey: true, code: "Backquote" }))).toBe(
      true,
    );
    expect(isNewTerminalShortcut(key({ ctrlKey: true, code: "Backquote" }))).toBe(false);
  });
});

describe("clipboardAction", () => {
  it("copies with Ctrl+C only while text is selected", () => {
    expect(clipboardAction(key({ ctrlKey: true, key: "c" }), true, false)).toBe("copy");
    expect(clipboardAction(key({ ctrlKey: true, key: "c" }), false, false)).toBeNull();
    expect(clipboardAction(key({ ctrlKey: true, shiftKey: true, key: "C" }), false, false)).toBe(
      "copy",
    );
  });

  it("pastes with Ctrl+V and Ctrl+Shift+V", () => {
    expect(clipboardAction(key({ ctrlKey: true, key: "v" }), false, false)).toBe("paste");
    expect(clipboardAction(key({ ctrlKey: true, shiftKey: true, key: "V" }), false, false)).toBe(
      "paste",
    );
  });

  it("leaves other keys, keyups and macOS alone", () => {
    expect(clipboardAction(key({ ctrlKey: true, key: "d" }), true, false)).toBeNull();
    expect(
      clipboardAction(key({ type: "keyup", ctrlKey: true, key: "v" }), false, false),
    ).toBeNull();
    expect(clipboardAction(key({ ctrlKey: true, key: "v" }), false, true)).toBeNull();
  });
});

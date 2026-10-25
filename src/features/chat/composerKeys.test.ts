import { describe, expect, it } from "vitest";
import { canSendMessage, getComposerKeyAction } from "./composerKeys";

describe("getComposerKeyAction", () => {
  it("submits on a plain Enter", () => {
    expect(getComposerKeyAction({ key: "Enter", shiftKey: false })).toBe("submit");
  });

  it("inserts a newline on Shift+Enter", () => {
    expect(getComposerKeyAction({ key: "Enter", shiftKey: true })).toBe("newline");
  });

  it("ignores Enter while an IME composition is active", () => {
    expect(getComposerKeyAction({ key: "Enter", shiftKey: false, isComposing: true })).toBe("none");
  });

  it("ignores other keys", () => {
    expect(getComposerKeyAction({ key: "a", shiftKey: false })).toBe("none");
    expect(getComposerKeyAction({ key: "Escape", shiftKey: true })).toBe("none");
  });
});

describe("canSendMessage", () => {
  it("needs both content and a ready agent", () => {
    expect(canSendMessage("merhaba", true)).toBe(true);
    expect(canSendMessage("merhaba", false)).toBe(false);
    expect(canSendMessage("   \n ", true)).toBe(false);
    expect(canSendMessage("", true)).toBe(false);
  });
});

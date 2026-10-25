import { describe, expect, it } from "vitest";
import { canSendMessage, getComposerKeyAction, isImeComposing } from "./composerKeys";

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

  it("ignores the IME commit Enter that macOS WebKit reports as keyCode 229", () => {
    expect(
      getComposerKeyAction({ key: "Enter", shiftKey: false, isComposing: false, keyCode: 229 }),
    ).toBe("none");
    expect(getComposerKeyAction({ key: "Enter", shiftKey: true, keyCode: 229 })).toBe("none");
  });

  it("still submits on a regular Enter keyCode", () => {
    expect(getComposerKeyAction({ key: "Enter", shiftKey: false, keyCode: 13 })).toBe("submit");
  });

  it("ignores other keys", () => {
    expect(getComposerKeyAction({ key: "a", shiftKey: false })).toBe("none");
    expect(getComposerKeyAction({ key: "Escape", shiftKey: true })).toBe("none");
  });
});

describe("isImeComposing", () => {
  it("detects both composition signals", () => {
    expect(isImeComposing({ isComposing: true })).toBe(true);
    expect(isImeComposing({ keyCode: 229 })).toBe(true);
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
    expect(isImeComposing({})).toBe(false);
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

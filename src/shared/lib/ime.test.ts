import { describe, expect, it } from "vitest";
import { isImeComposing } from "./ime";

describe("isImeComposing", () => {
  it("is true while composing or for WebKit's keyCode 229", () => {
    expect(isImeComposing({ isComposing: true })).toBe(true);
    expect(isImeComposing({ isComposing: false, keyCode: 229 })).toBe(true);
  });

  it("is false for a plain key", () => {
    expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
    expect(isImeComposing({})).toBe(false);
  });
});

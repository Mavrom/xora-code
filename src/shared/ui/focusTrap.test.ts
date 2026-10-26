import { describe, expect, it } from "vitest";
import { nextTrapIndex } from "./focusTrap";

describe("nextTrapIndex", () => {
  it("moves forward and backward, wrapping at both ends", () => {
    expect(nextTrapIndex(0, 3, false)).toBe(1);
    expect(nextTrapIndex(2, 3, false)).toBe(0);
    expect(nextTrapIndex(0, 3, true)).toBe(2);
    expect(nextTrapIndex(1, 3, true)).toBe(0);
  });

  it("enters at the matching end when focus is outside the trap", () => {
    expect(nextTrapIndex(-1, 3, false)).toBe(0);
    expect(nextTrapIndex(-1, 3, true)).toBe(2);
    expect(nextTrapIndex(7, 3, false)).toBe(0);
  });

  it("stays put with a single element and gives up with none", () => {
    expect(nextTrapIndex(0, 1, false)).toBe(0);
    expect(nextTrapIndex(0, 1, true)).toBe(0);
    expect(nextTrapIndex(-1, 0, false)).toBe(-1);
  });
});

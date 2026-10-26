import { describe, expect, it } from "vitest";
import { scrollToReveal, visibleRange } from "./virtualRange";

describe("visibleRange", () => {
  it("covers the viewport plus overscan", () => {
    expect(visibleRange(0, 240, 24, 2000, 5)).toEqual({ start: 0, end: 15 });
    expect(visibleRange(2400, 240, 24, 2000, 5)).toEqual({ start: 95, end: 115 });
  });

  it("includes a partly visible row at either edge", () => {
    expect(visibleRange(12, 24, 24, 100, 0)).toEqual({ start: 0, end: 2 });
  });

  it("clamps to the list", () => {
    expect(visibleRange(47_000, 600, 24, 2000, 8)).toEqual({ start: 1950, end: 1992 });
    expect(visibleRange(60_000, 600, 24, 2000, 8)).toEqual({ start: 2000, end: 2000 });
    expect(visibleRange(-50, 100, 24, 3, 8)).toEqual({ start: 0, end: 3 });
    expect(visibleRange(0, 100, 24, 0, 8)).toEqual({ start: 0, end: 0 });
  });
});

describe("scrollToReveal", () => {
  it("leaves a visible row alone", () => {
    expect(scrollToReveal(3, 0, 240, 24)).toBeNull();
  });

  it("scrolls up or down by the least amount", () => {
    expect(scrollToReveal(2, 100, 240, 24)).toBe(48);
    expect(scrollToReveal(20, 0, 240, 24)).toBe(264);
  });

  it("accounts for padding above the first row", () => {
    expect(scrollToReveal(0, 10, 240, 24, 4)).toBe(4);
  });
});

import { describe, expect, it } from "vitest";
import { computeAutoGrowHeight, parsePx, supportsFieldSizing } from "./autoGrow";

// A 13px/20px textarea with 12px + 4px padding and no border, like the chat composer.
const base = { lineHeight: 20, paddingBlock: 16, borderBlock: 0 };

describe("computeAutoGrowHeight", () => {
  it("follows the content height", () => {
    expect(computeAutoGrowHeight({ ...base, scrollHeight: 76 })).toEqual({
      height: 76,
      overflow: false,
    });
  });

  it("never shrinks below the min-height", () => {
    expect(computeAutoGrowHeight({ ...base, scrollHeight: 36, minHeight: 44 })).toEqual({
      height: 44,
      overflow: false,
    });
  });

  it("caps at the CSS max-height and scrolls beyond it", () => {
    expect(computeAutoGrowHeight({ ...base, scrollHeight: 500, maxHeight: 160 })).toEqual({
      height: 160,
      overflow: true,
    });
  });

  it("caps at maxRows, including padding and border", () => {
    const size = computeAutoGrowHeight({ ...base, borderBlock: 2, scrollHeight: 400, maxRows: 5 });
    expect(size).toEqual({ height: 5 * 20 + 16 + 2, overflow: true });
  });

  it("uses the tighter of maxRows and max-height", () => {
    expect(
      computeAutoGrowHeight({ ...base, scrollHeight: 400, maxRows: 10, maxHeight: 120 }).height,
    ).toBe(120);
    expect(
      computeAutoGrowHeight({ ...base, scrollHeight: 400, maxRows: 2, maxHeight: 120 }).height,
    ).toBe(56);
  });

  it("adds the border to the scroll height (border-box)", () => {
    expect(computeAutoGrowHeight({ ...base, borderBlock: 2, scrollHeight: 36 }).height).toBe(38);
  });

  it("rounds fractional heights up so the last line is never clipped", () => {
    expect(computeAutoGrowHeight({ ...base, scrollHeight: 36.4 }).height).toBe(37);
  });

  it("does not report overflow for content exactly at the cap", () => {
    expect(computeAutoGrowHeight({ ...base, scrollHeight: 116, maxRows: 5 }).overflow).toBe(false);
  });

  it("ignores a non-positive maxRows", () => {
    expect(computeAutoGrowHeight({ ...base, scrollHeight: 300, maxRows: 0 }).height).toBe(300);
  });
});

describe("parsePx", () => {
  it("reads px lengths and rejects keywords", () => {
    expect(parsePx("56px")).toBe(56);
    expect(parsePx("19.5px")).toBe(19.5);
    expect(parsePx("none")).toBeUndefined();
    expect(parsePx("normal")).toBeUndefined();
    expect(parsePx("40%")).toBeUndefined();
  });
});

describe("supportsFieldSizing", () => {
  it("is false without a CSS object (node)", () => {
    expect(supportsFieldSizing()).toBe(false);
  });
});

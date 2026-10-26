import { describe, expect, it } from "vitest";
import { asciiChar, BAYER_8, coverRect, ditherPixels, dotRadius, luminance } from "./effects";

describe("coverRect", () => {
  it("crops the sides of a wide picture into a square", () => {
    expect(coverRect(200, 100, 50, 50)).toEqual({ x: 50, y: 0, w: 100, h: 100 });
  });

  it("keeps the part of a tall picture chosen by focusY", () => {
    expect(coverRect(100, 200, 100, 100, 0)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(coverRect(100, 200, 100, 100, 1).y).toBe(100);
  });
});

describe("BAYER_8", () => {
  it("holds every threshold 0-63 exactly once", () => {
    expect([...BAYER_8].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i));
  });

  it("is the dispersed matrix: neighbours sit half the range apart", () => {
    expect(BAYER_8.slice(0, 8)).toEqual([0, 32, 8, 40, 2, 34, 10, 42]);
  });
});

describe("ditherPixels", () => {
  it("lights a pixel in a palette colour or leaves it black, alpha untouched", () => {
    const data = new Uint8ClampedArray([10, 128, 250, 77, 200, 60, 140, 255]);
    ditherPixels(data, 2, 4);
    for (const [i, v] of data.entries()) {
      if (i % 4 === 3) continue;
      expect([0, 85, 170, 255]).toContain(v);
    }
    expect(data[3]).toBe(77);
  });

  it("keeps pure black and white", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    ditherPixels(data, 2, 4);
    expect([...data]).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });

  it("lights more pixels in a brighter area", () => {
    const lit = (value: number) => {
      const data = new Uint8ClampedArray(64 * 4).fill(value);
      ditherPixels(data, 8, 4);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 0) n++;
      return n;
    };
    expect(lit(40)).toBeLessThan(lit(120));
  });
});

describe("asciiChar / dotRadius / luminance", () => {
  it("maps darkness to blank and brightness to dense marks", () => {
    expect(asciiChar(0)).toBe(" ");
    expect(asciiChar(1)).toBe("@");
    expect(asciiChar(2)).toBe("@");
  });

  it("grows dots with brightness but keeps them inside the cell", () => {
    expect(dotRadius(0, 8)).toBe(0);
    expect(dotRadius(0.25, 8)).toBeLessThan(dotRadius(1, 8));
    expect(dotRadius(1, 8) * 2).toBeLessThanOrEqual(8 * 1.1);
  });

  it("weighs green brightest", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1);
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0));
  });
});

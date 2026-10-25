import { describe, expect, it } from "vitest";
import { contextRatio, formatDuration, formatTokens } from "./format";

describe("formatDuration", () => {
  it("uses tenths of a second for short spans, never zero", () => {
    expect(formatDuration(0)).toBe("0,1 sn");
    expect(formatDuration(420)).toBe("0,4 sn");
    expect(formatDuration(3000)).toBe("3 sn");
    expect(formatDuration(9_940)).toBe("9,9 sn");
  });

  it("rounds to whole seconds and minutes for longer spans", () => {
    expect(formatDuration(12_400)).toBe("12 sn");
    expect(formatDuration(65_000)).toBe("1 dk 5 sn");
    expect(formatDuration(120_000)).toBe("2 dk");
  });
});

describe("formatTokens", () => {
  it("compacts thousands and millions", () => {
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(12_340)).toBe("12,3k");
    expect(formatTokens(200_000)).toBe("200k");
    expect(formatTokens(1_234_567)).toBe("1,2M");
  });
});

describe("contextRatio", () => {
  it("clamps and guards against unknown sizes", () => {
    expect(contextRatio(50, 200)).toBe(0.25);
    expect(contextRatio(500, 200)).toBe(1);
    expect(contextRatio(5, 0)).toBe(0);
  });
});

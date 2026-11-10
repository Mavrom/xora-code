import { describe, expect, it } from "vitest";
import { scrimAlpha } from "./scrim";

describe("scrimAlpha", () => {
  it("lets half of the picture's light through an undimmed picture", () => {
    expect(scrimAlpha(0)).toBe(0.5);
  });

  it("only makes up what the default dim leaves", () => {
    expect(scrimAlpha(15)).toBeCloseTo(0.412, 3);
  });

  it("disappears once the dim alone is dark enough", () => {
    expect(scrimAlpha(50)).toBe(0);
    expect(scrimAlpha(80)).toBe(0);
    expect(scrimAlpha(100)).toBe(0);
  });

  it("weakens steadily as the dim grows", () => {
    const steps = [0, 10, 20, 30, 40, 50].map(scrimAlpha);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
  });

  it("clamps out-of-range dims", () => {
    expect(scrimAlpha(-20)).toBe(scrimAlpha(0));
    expect(scrimAlpha(140)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { gapBefore, isNearBottom } from "./scroll";

describe("isNearBottom", () => {
  it("follows within the threshold and lets go beyond it", () => {
    expect(isNearBottom({ scrollTop: 552, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(isNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 400 })).toBe(false);
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 300, clientHeight: 400 })).toBe(true);
  });
});

describe("gapBefore", () => {
  it("separates turns and keeps tool steps together", () => {
    expect(gapBefore(undefined, "user")).toBe("");
    expect(gapBefore("agent", "user")).toBe("mt-8");
    expect(gapBefore("tool", "tool")).toBe("mt-0.5");
    expect(gapBefore("thought", "tool")).toBe("mt-1.5");
    expect(gapBefore("tool", "agent")).toBe("mt-4");
  });
});

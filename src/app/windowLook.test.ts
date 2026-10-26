import { describe, expect, it } from "vitest";
import { baseColor } from "./windowLook";

describe("baseColor", () => {
  it("is opaque onyx for a solid window", () => {
    expect(baseColor({ window: "solid", tint: 30 })).toBe("#000000");
  });

  it("tints a see-through window, clamped", () => {
    expect(baseColor({ window: "frosted", tint: 55 })).toBe("rgb(0 0 0 / 0.55)");
    expect(baseColor({ window: "clear", tint: 140 })).toBe("rgb(0 0 0 / 1)");
  });
});

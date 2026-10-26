import { describe, expect, it } from "vitest";
import { placeMenu } from "./menuModel";

describe("placeMenu", () => {
  it("opens at the pointer when it fits", () => {
    expect(placeMenu(100, 100, 200, 120, 1000, 800)).toEqual({ left: 100, top: 100 });
  });

  it("flips left and up near the right and bottom edges", () => {
    expect(placeMenu(950, 750, 200, 120, 1000, 800)).toEqual({ left: 750, top: 630 });
  });

  it("never leaves the window on a tiny viewport", () => {
    expect(placeMenu(50, 50, 200, 120, 100, 100)).toEqual({ left: 8, top: 8 });
  });
});

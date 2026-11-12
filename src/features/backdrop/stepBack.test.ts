import { describe, expect, it } from "vitest";
import { WALLPAPER_STEPS_BACK, wallpaperStepsBack } from "./stepBack";

describe("wallpaperStepsBack", () => {
  it("follows the constant unless a DEV param picks a side", () => {
    expect(wallpaperStepsBack("")).toBe(WALLPAPER_STEPS_BACK);
    expect(wallpaperStepsBack("?wallpaper=fade")).toBe(true);
    expect(wallpaperStepsBack("?wallpaper=scrim")).toBe(false);
    expect(wallpaperStepsBack("?wallpaper=bogus")).toBe(WALLPAPER_STEPS_BACK);
  });
});

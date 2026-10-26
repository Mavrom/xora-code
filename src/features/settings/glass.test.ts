import { describe, expect, it } from "vitest";
import { applyGlassVars, blurScale, glassVars, MIN_GLASS_ALPHA } from "./glass";
import { DEFAULT_SETTINGS } from "./types";

const look = DEFAULT_SETTINGS.appearance;

describe("glassVars", () => {
  it("is solid onyx without a wallpaper, whatever the sliders say", () => {
    expect(glassVars({ ...look, glass: 100 }, false)).toEqual({
      "--glass-alpha": "1",
      "--glass-blur": "0px",
      "--wallpaper-dim": "0",
    });
  });

  it("maps glass 0..100 onto alpha 1..MIN_GLASS_ALPHA", () => {
    expect(glassVars({ ...look, glass: 0 }, true)["--glass-alpha"]).toBe("1");
    expect(glassVars({ ...look, glass: 100 }, true)["--glass-alpha"]).toBe(String(MIN_GLASS_ALPHA));
    expect(glassVars(look, true)).toEqual({
      "--glass-alpha": "0.475",
      "--glass-blur": "24px",
      "--wallpaper-dim": "0.35",
    });
  });

  it("clamps out-of-range values", () => {
    const vars = glassVars({ ...look, glass: 180, dim: -5, blur: -1 }, true);
    expect(vars["--glass-alpha"]).toBe(String(MIN_GLASS_ALPHA));
    expect(vars["--wallpaper-dim"]).toBe("0");
    expect(vars["--glass-blur"]).toBe("0px");
  });
});

describe("applyGlassVars", () => {
  it("writes the variables and the data-wallpaper flag", () => {
    const style = new Map<string, string>();
    const root = {
      style: { setProperty: (k: string, v: string) => style.set(k, v) },
      dataset: {} as Record<string, string>,
    } as unknown as HTMLElement;

    applyGlassVars(glassVars(look, true), true, root);
    expect(style.get("--glass-alpha")).toBe("0.475");
    expect("wallpaper" in root.dataset).toBe(true);

    applyGlassVars(glassVars(look, false), false, root);
    expect(style.get("--glass-alpha")).toBe("1");
    expect("wallpaper" in root.dataset).toBe(false);
  });
});

describe("blurScale", () => {
  it("only scales when blurred, and never by much", () => {
    expect(blurScale(0)).toBe(1);
    expect(blurScale(24)).toBeCloseTo(1.06);
    expect(blurScale(64)).toBeCloseTo(1.15);
  });
});

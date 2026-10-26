import { convertFileSrc } from "@tauri-apps/api/core";
import type { AppearanceSettings } from "./types";

/** Panel opacity at glass 100: the most see-through it gets while text stays readable. */
export const MIN_GLASS_ALPHA = 0.3;

/** Image formats WebView2 shows; keep in sync with `settings::wallpaper::EXTENSIONS`. */
export const WALLPAPER_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"];

export interface GlassVars {
  /** Opacity of glass panels: 1 is solid onyx. */
  "--glass-alpha": string;
  /** Blur of the wallpaper behind the glass. */
  "--glass-blur": string;
  /** Opacity of the black layer over the wallpaper. */
  "--wallpaper-dim": string;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * CSS variables for the current look. Without a wallpaper everything is solid onyx,
 * whatever the sliders say, so the app looks the same as before the feature existed.
 */
export function glassVars(appearance: AppearanceSettings, hasWallpaper: boolean): GlassVars {
  if (!hasWallpaper) return { "--glass-alpha": "1", "--glass-blur": "0px", "--wallpaper-dim": "0" };
  const glass = Math.min(100, Math.max(0, appearance.glass)) / 100;
  return {
    "--glass-alpha": String(round(1 - glass * (1 - MIN_GLASS_ALPHA))),
    "--glass-blur": `${Math.max(0, appearance.blur)}px`,
    "--wallpaper-dim": String(round(Math.min(100, Math.max(0, appearance.dim)) / 100)),
  };
}

/** Writes the variables on <html> and flags `data-wallpaper` for CSS that needs to know. */
export function applyGlassVars(
  vars: GlassVars,
  hasWallpaper: boolean,
  root: HTMLElement = document.documentElement,
) {
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  if (hasWallpaper) root.dataset.wallpaper = "";
  else delete root.dataset.wallpaper;
}

/** Image blurred at the edges shows a soft frame; scale it up just enough to hide it. */
export const blurScale = (blurPx: number) => (blurPx > 0 ? 1 + Math.min(0.15, blurPx / 400) : 1);

/** File name for display: `C:\...\wallpaper-123.jpg` -> `wallpaper-123.jpg`. */
export const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Asset-protocol URL for a stored wallpaper path (`null` stays `null`). */
export function wallpaperSrc(path: string | null): string | null {
  if (!path) return null;
  try {
    return convertFileSrc(path);
  } catch {
    return null; // Outside Tauri (tests, plain browser).
  }
}

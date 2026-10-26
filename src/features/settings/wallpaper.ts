import { convertFileSrc } from "@tauri-apps/api/core";
import defaultPicture from "@/assets/backdrop-default.webp";
import type { AppearanceSettings } from "./types";

/** Image formats WebView2 shows; keep in sync with `settings::wallpaper::EXTENSIONS`. */
export const WALLPAPER_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp"];

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

/** The new-chat picture to show: the user's own, else the one Xora ships with; null when off. */
export function backdropSrc(appearance: Pick<AppearanceSettings, "picture" | "wallpaper">) {
  if (!appearance.picture) return null;
  return appearance.wallpaper ? wallpaperSrc(appearance.wallpaper) : defaultPicture;
}

import { convertFileSrc } from "@tauri-apps/api/core";

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

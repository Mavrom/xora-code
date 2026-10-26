import { useLayoutEffect, useState } from "react";
import { applyGlassVars, glassVars, wallpaperSrc } from "@/features/settings/glass";
import { useSettingsStore } from "@/features/settings/store";
import { WallpaperImage } from "@/features/settings/WallpaperImage";

/**
 * App-wide background layer (Settings > Görünüm). Sits behind everything and
 * publishes the glass look on <html> as CSS variables (`--glass-alpha`,
 * `--glass-blur`, `--wallpaper-dim`) plus `data-wallpaper`, so any surface can
 * opt in with the `glass-*` utilities. A missing or unreadable file falls back
 * to plain onyx.
 */
export function Wallpaper() {
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const src = wallpaperSrc(appearance.wallpaper);
  const [failed, setFailed] = useState<string | null>(null);
  const active = src !== null && failed !== src;

  useLayoutEffect(() => {
    applyGlassVars(glassVars(appearance, active), active);
  }, [appearance, active]);

  if (!active) return null;
  return (
    <WallpaperImage
      key={src}
      src={src}
      blur={appearance.blur}
      dim={appearance.dim}
      onError={() => setFailed(src)}
      className="fixed inset-0 -z-10"
    />
  );
}

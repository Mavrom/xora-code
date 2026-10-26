import { useState } from "react";
import { useSettingsStore } from "@/features/settings/store";
import { backdropSrc } from "@/features/settings/wallpaper";

/**
 * The picture, heavily blurred and darkened, filling its (relative, isolated) parent top to
 * bottom: frosted glass that still reads as glass where the hero picture has faded to black.
 * Nothing when the picture is off.
 */
export function FrostedGround() {
  const src = useSettingsStore((s) => backdropSrc(s.settings.appearance));
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <img
        src={src}
        alt=""
        draggable={false}
        onError={() => setFailed(src)}
        className="size-full scale-150 object-cover opacity-85 blur-3xl saturate-150"
      />
      {/* Keeps text readable over bright pictures; lighter at the top where the hero is. */}
      <div className="absolute inset-0 bg-linear-to-b from-black/25 via-black/45 to-black/60" />
    </div>
  );
}

import type { CSSProperties } from "react";
import { useSettingsStore } from "@/features/settings/store";
import { backdropSrc } from "@/features/settings/wallpaper";
import { scrimAlpha } from "./scrim";

/**
 * A soft shade behind the conversation column so muted and meta text stay readable over a
 * bright picture; it melts into the picture at its sides and ends where the picture does.
 * Nothing when the picture is off (it would only darken a see-through window's desktop)
 * or when the user's dim already darkens enough. Render it before the (positioned) content
 * it sits behind.
 */
export function ConversationScrim() {
  const alpha = useSettingsStore((s) =>
    backdropSrc(s.settings.appearance) ? scrimAlpha(s.settings.appearance.dim) : 0,
  );
  if (alpha === 0) return null;
  return (
    <div
      aria-hidden
      style={{ "--scrim-alpha": alpha } as CSSProperties}
      className="chat-scrim pointer-events-none absolute inset-y-0 left-1/2 w-full max-w-260 -translate-x-1/2 transition-opacity duration-slow ease-out-quint starting:opacity-0"
    />
  );
}

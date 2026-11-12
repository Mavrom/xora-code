import { useState } from "react";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { isDocked } from "@/features/chat/sessionTitle";
import { useSettingsStore } from "@/features/settings/store";
import { backdropSrc } from "@/features/settings/wallpaper";
import { CONVERSATION_LIGHT, STEPS_BACK } from "./stepBack";

/**
 * The picture, heavily blurred and darkened, filling its (relative, isolated) parent top to
 * bottom: frosted glass that still reads as glass where the hero picture has faded to black.
 * Nothing when the picture is off.
 */
export function FrostedGround() {
  const src = useSettingsStore((s) => backdropSrc(s.settings.appearance));
  // A see-through window is real glass already; the painted copy would hide what is behind.
  const solid = useSettingsStore((s) => s.settings.appearance.window === "solid");
  // With the step-back variant it darkens with the rest of the window in a conversation.
  const docked = useAgentStore((s) => STEPS_BACK && isDocked(selectActiveSession(s)));
  const [failed, setFailed] = useState<string | null>(null);
  if (!solid || !src || failed === src) return null;
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
      {STEPS_BACK && (
        <div
          style={{ opacity: docked ? 1 - CONVERSATION_LIGHT : 0 }}
          className="absolute inset-0 bg-black transition-opacity duration-slow ease-in-out-soft"
        />
      )}
    </div>
  );
}

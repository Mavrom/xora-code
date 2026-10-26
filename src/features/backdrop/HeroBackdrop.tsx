import { useState } from "react";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import { isDocked } from "@/features/chat/sessionTitle";
import { useSettingsStore } from "@/features/settings/store";
import { backdropSrc } from "@/features/settings/wallpaper";
import { cn } from "@/shared/ui/cn";
import { BackdropCanvas } from "./BackdropCanvas";

/**
 * The picture over the top of a new chat (Settings > Görünüm). It runs under the
 * transparent title strip to the window's top edge and sinks into onyx just below the
 * composer; in a conversation it stays behind the transcript, faint.
 */
export function HeroBackdrop() {
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const docked = useAgentStore((s) => isDocked(selectActiveSession(s)));
  const src = backdropSrc(appearance);
  const [failed, setFailed] = useState<string | null>(null);

  if (!src || failed === src) return null;
  return (
    <BackdropCanvas
      key={src}
      src={src}
      effect={appearance.effect}
      dim={appearance.dim}
      onError={() => setFailed(src)}
      // In a conversation it stays, faint, so the transcript keeps its contrast.
      className={cn(
        "hero-backdrop absolute inset-x-0 top-0 h-[68%] transition-opacity duration-slow starting:opacity-0",
        docked ? "opacity-50" : "opacity-100",
      )}
    />
  );
}

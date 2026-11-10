import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { PLATFORM, useShortcut } from "@/features/keymap/keymap";
import { describeShortcut } from "@/shared/ui/keys";
import { t } from "@/shared/i18n";

interface SendButtonProps {
  running: boolean;
  cancelling: boolean;
  canSend: boolean;
  hasText: boolean;
  onSend: () => void;
  onStop: () => void;
}

/** Send while idle; a square Stop while the agent works (text typed then still queues on Enter). */
export function SendButton({
  running,
  cancelling,
  canSend,
  hasText,
  onSend,
  onStop,
}: SendButtonProps) {
  const stop = running && !hasText;
  const stopKeys = useShortcut("chat.stop");
  const label = cancelling
    ? t("Stopping…")
    : stop
      ? stopKeys
        ? t("Stop ({keys})", { keys: describeShortcut(stopKeys, PLATFORM) })
        : t("Stop")
      : running
        ? t("Queue")
        : t("Send");
  const enabled = stop ? !cancelling : canSend;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!enabled}
      onClick={stop ? onStop : onSend}
      className={cn(
        "relative grid size-7 shrink-0 place-items-center rounded-full bg-fg text-bg transition-[opacity,background-color] duration-base ease-out-quint disabled:cursor-not-allowed",
        enabled ? "hover:bg-white" : "opacity-55",
      )}
    >
      {/* Both icons stay mounted and cross-fade, so the swap never jumps. */}
      <ArrowUp
        size={15}
        strokeWidth={2.25}
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 transition-[opacity,scale] duration-fast ease-out-quint",
          stop ? "scale-75 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <Square
        size={11}
        strokeWidth={0}
        fill="currentColor"
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 transition-[opacity,scale] duration-fast ease-out-quint",
          stop ? "scale-100 opacity-100" : "scale-75 opacity-0",
          cancelling && "animate-pulse",
        )}
      />
    </button>
  );
}

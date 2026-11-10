import { X } from "lucide-react";
import type { SessionView } from "@/features/agents/reducer";
import { useAgentStore } from "@/features/agents/store";
import { Kbd } from "@/shared/ui/Kbd";
import { useShortcut } from "@/features/keymap/keymap";
import { t } from "@/shared/i18n";

/** The Stop shortcut, shown beside the context row while a turn runs. */
export function StopHint() {
  const keys = useShortcut("chat.stop");
  if (!keys) return null;
  return (
    <p className="flex items-center gap-1.5 text-2xs text-fg-subtle">
      <Kbd keys={keys} />
      <span>{t("stop")}</span>
    </p>
  );
}

/** Messages typed during a running turn, sent one by one when it ends. */
export function QueuedPrompts({ session }: { session: SessionView }) {
  return (
    <ul aria-label={t("Queued messages")} className="mb-2 flex flex-col gap-1">
      {session.queued.map((blocks, index) => {
        const text = blocks.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
        return (
          <li
            key={index}
            className="flex h-8 items-center gap-2 rounded-lg border border-glass-border bg-glass pr-1 pl-3 text-xs backdrop-blur-xl"
          >
            <span className="shrink-0 text-2xs text-fg-subtle">{t("Queued")}</span>
            <span className="min-w-0 flex-1 truncate text-fg-muted">{text}</span>
            <button
              type="button"
              aria-label={t("Remove from queue")}
              title={t("Remove from queue")}
              onClick={() => useAgentStore.getState().dropQueued(session.sessionId, index)}
              className="grid size-6 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
            >
              <X size={12} strokeWidth={1.75} aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

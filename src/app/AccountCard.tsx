import { Inbox, Settings } from "lucide-react";
import { openCount } from "@/features/inbox/sortNotes";
import { useInboxStore } from "@/features/inbox/store";
import { showView } from "./sidebarView";
import { useAgentStore } from "@/features/agents/store";
import { PLATFORM, useShortcut } from "@/features/keymap/keymap";
import { describeShortcut } from "@/shared/ui/keys";
import { AgentGlyph } from "@/features/chat/AgentGlyph";
import { AGENT_TINT } from "@/features/chat/agentTint";
import { statusNote } from "@/features/chat/controlsView";
import { openSettings, useSettingsView } from "@/features/settings/viewStore";
import { UpdateNotice } from "@/features/updates/UpdateNotice";
import { useHostname } from "@/shared/lib/useHostname";
import { cn } from "@/shared/ui/cn";
import { t } from "@/shared/i18n";

/** The avatar's ring: the three agents' own colours. */
const RING = `conic-gradient(from 210deg, ${AGENT_TINT.claude}, ${AGENT_TINT.gemini}, ${AGENT_TINT.codex}, ${AGENT_TINT.claude})`;

/** The Inbox, out of the way: an icon with its open-note count, beside Settings. */
function InboxButton({ open }: { open: boolean }) {
  const count = useInboxStore((s) => openCount(s.notes));
  const shortcut = useShortcut("view.inbox");
  const keys = shortcut ? describeShortcut(shortcut, PLATFORM) : undefined;
  const label = count > 0 ? `${t("Inbox")} (${count})` : t("Inbox");
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={label}
      aria-keyshortcuts={keys}
      title={keys ? `${label} · ${keys}` : label}
      onClick={() => showView(open ? "sessions" : "inbox")}
      className={cn(
        "relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-fast",
        open ? "bg-white/[0.08] text-fg" : "text-fg-subtle hover:bg-white/[0.05] hover:text-fg",
      )}
    >
      <Inbox size={15} strokeWidth={1.75} aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 min-w-3.5 rounded-full bg-white/[0.12] px-1 text-[9px] leading-3.5 font-medium text-fg-muted tabular-nums"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

/** Bottom card: this computer, the selected agent's state, the Inbox and the way into settings. */
export function AccountCard({
  settingsOpen,
  inboxOpen,
}: {
  settingsOpen: boolean;
  inboxOpen: boolean;
}) {
  const hostname = useHostname();
  const agentId = useAgentStore((s) => s.selectedAgent);
  const agent = useAgentStore((s) => s.agents[s.selectedAgent]);
  const note = statusNote(agent.status) || t("Ready");
  const ready = agent.status.state === "ready" || agent.status.state === "stopped";
  const name = hostname ?? t("This computer");
  const shortcut = useShortcut("settings.open");
  const keys = shortcut ? describeShortcut(shortcut, PLATFORM) : undefined;
  const settingsLabel = t("Settings");

  return (
    <div className="relative shrink-0 border-t border-white/[0.05] p-2">
      <UpdateNotice />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => openSettings("accounts")}
          title={t("Accounts")}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors duration-fast hover:bg-white/[0.04]"
        >
          <span
            aria-hidden
            style={{ background: RING }}
            className="grid size-7 shrink-0 place-items-center rounded-full p-px"
          >
            <span className="grid size-full place-items-center rounded-full bg-elevated text-[11px] font-semibold text-fg">
              {name.charAt(0).toUpperCase()}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-fg">{name}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
              <AgentGlyph agent={agentId} size={10} tinted />
              <span className="truncate">
                {agent.displayName} · {note}
              </span>
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  ready ? "bg-success/80" : "bg-warning/80",
                )}
              />
            </span>
          </span>
        </button>
        <InboxButton open={inboxOpen} />
        <button
          type="button"
          aria-pressed={settingsOpen}
          aria-label={settingsLabel}
          aria-keyshortcuts={keys}
          title={keys ? `${settingsLabel} (${keys})` : settingsLabel}
          onClick={() => useSettingsView.getState().toggleSettings()}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-fast",
            settingsOpen
              ? "bg-white/[0.08] text-fg"
              : "text-fg-subtle hover:bg-white/[0.05] hover:text-fg",
          )}
        >
          <Settings size={15} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}

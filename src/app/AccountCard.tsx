import { GitBranch, Inbox, Settings, type LucideIcon } from "lucide-react";
import { changeCount } from "@/features/git/changes";
import { useChangesStore } from "@/features/git/changesStore";
import { openCount } from "@/features/inbox/sortNotes";
import { useInboxStore } from "@/features/inbox/store";
import type { ActionId } from "@/features/keymap/actions";
import { showView } from "./sidebarView";
import type { SidebarView } from "./uiStore";
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

interface ViewButtonProps {
  view: Exclude<SidebarView, "sessions">;
  icon: LucideIcon;
  label: string;
  action: ActionId;
  count: number;
  open: boolean;
}

/**
 * A sidebar view kept out of the way: an icon with its count, beside Settings. It opens the
 * view in place of the chats, and closes it again.
 */
function ViewButton({ view, icon: Icon, label, action, count, open }: ViewButtonProps) {
  const shortcut = useShortcut(action);
  const keys = shortcut ? describeShortcut(shortcut, PLATFORM) : undefined;
  const name = count > 0 ? `${label} (${count})` : label;
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={name}
      aria-keyshortcuts={keys}
      title={keys ? `${name} (${keys})` : name}
      onClick={() => showView(open ? "sessions" : view)}
      className={cn(
        "relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-fast",
        open ? "bg-white/[0.08] text-fg" : "text-fg-subtle hover:bg-white/[0.05] hover:text-fg",
      )}
    >
      <Icon size={15} strokeWidth={1.75} aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-0.5 -right-0.5 min-w-3.5 rounded-full bg-border-strong px-1 text-[9px] leading-3.5 font-medium text-fg-muted tabular-nums"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

/**
 * Bottom card: this computer, the selected agent's state, the Changes and the Inbox, and the
 * way into settings. `view` is the sidebar view on screen (null while settings cover it).
 */
export function AccountCard({
  settingsOpen,
  view,
}: {
  settingsOpen: boolean;
  view: SidebarView | null;
}) {
  const changes = useChangesStore((s) => changeCount(s.status));
  const notes = useInboxStore((s) => openCount(s.notes));
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
        <ViewButton
          view="changes"
          icon={GitBranch}
          label={t("Changes")}
          action="view.changes"
          count={changes}
          open={view === "changes"}
        />
        <ViewButton
          view="inbox"
          icon={Inbox}
          label={t("Inbox")}
          action="view.inbox"
          count={notes}
          open={view === "inbox"}
        />
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

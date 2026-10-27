import { useEffect, useMemo, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Inbox,
  MessagesSquare,
  PanelLeft,
  Search,
  Settings,
  SquarePen,
  type LucideIcon,
} from "lucide-react";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { FrostedGround } from "@/features/backdrop/FrostedGround";
import { AgentGlyph } from "@/features/chat/AgentGlyph";
import { ChipMenu } from "@/features/chat/ChipMenu";
import { statusNote } from "@/features/chat/controlsView";
import { canTravel, travel, useNavHistory } from "@/features/chat/navHistory";
import { SessionList } from "@/features/chat/SessionList";
import { emitCommand, NEW_CHAT, OPEN_PALETTE } from "@/features/commands/events";
import { InboxPanel } from "@/features/inbox/InboxPanel";
import { INBOX_COMPOSER_ID } from "@/features/inbox/NoteComposer";
import { openCount } from "@/features/inbox/sortNotes";
import { useInboxStore } from "@/features/inbox/store";
import { closeSettings, openSettings, useSettingsView } from "@/features/settings/viewStore";
import { useHostname } from "@/shared/lib/useHostname";
import { cn } from "@/shared/ui/cn";
import { Kbd } from "@/shared/ui/Kbd";
import { toggleFiles, useUiStore, type SidebarView } from "./uiStore";
import { NATIVE_CAPTION, TRAFFIC_LIGHT_INSET } from "./WindowControls";
import { t } from "@/shared/i18n";

/** Ctrl+Shift+<code> per view. Avoids WebView2's Ctrl+Shift+I/J (devtools). */
const SHORTCUTS: Record<SidebarView, { code: string; label: string }> = {
  sessions: { code: "KeyH", label: "Ctrl+Shift+H" },
  inbox: { code: "KeyN", label: "Ctrl+Shift+N" },
};

/** Opening the inbox is a capture gesture: land straight in the composer. */
function focusComposerSoon() {
  requestAnimationFrame(() => document.getElementById(INBOX_COMPOSER_ID)?.focus());
}

function showView(next: SidebarView) {
  closeSettings();
  useUiStore.getState().setSidebarView(next);
  if (next === "inbox") focusComposerSoon();
}

/**
 * The left column. Top: window controls and history arrows (also the drag handle), then
 * the two everyday actions (new chat, search) and the two views. Middle: the current
 * view. Bottom: this computer and the agent's state, with settings beside it.
 */
export function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const view = useUiStore((s) => s.sidebarView);
  const settingsOpen = useSettingsView((s) => s.open);
  const badge = useInboxStore((s) => openCount(s.notes));
  const canBack = useNavHistory((s) => canTravel(s, -1));
  const canForward = useNavHistory((s) => canTravel(s, 1));
  const active = settingsOpen ? null : view;

  // Load once at startup so the badge is right before the inbox is opened.
  useEffect(() => {
    void useInboxStore.getState().load();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey || e.repeat) return;
      if (e.code === "KeyE") {
        e.preventDefault();
        toggleFiles();
        return;
      }
      const match = (Object.keys(SHORTCUTS) as SidebarView[]).find(
        (v) => SHORTCUTS[v].code === e.code,
      );
      if (!match) return;
      e.preventDefault();
      useUiStore.getState().setSidebarView(match);
      if (match === "inbox") focusComposerSoon();
    };
    // Capture phase so the shortcut also works while the editor has focus. On
    // `document` (not `window`) so the command palette's window-capture handler
    // runs first and can swallow it while open.
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <div className="relative isolate flex h-full flex-col bg-black/25 backdrop-blur-xl backdrop-saturate-150">
      <FrostedGround />
      {/* A breath of light along the top edge, so the column reads as a surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(120%_100%_at_0%_0%,rgb(255_255_255/0.035),transparent_70%)]"
      />
      <div
        data-tauri-drag-region="deep"
        className={cn(
          "relative flex h-10 shrink-0 items-center gap-0.5 px-2",
          NATIVE_CAPTION && TRAFFIC_LIGHT_INSET,
        )}
      >
        <BarButton icon={PanelLeft} label={t("Hide sidebar")} onClick={onCollapse} />
        <BarButton
          icon={ArrowLeft}
          label={t("Back")}
          disabled={!canBack}
          onClick={() => travel(-1)}
        />
        <BarButton
          icon={ArrowRight}
          label={t("Forward")}
          disabled={!canForward}
          onClick={() => travel(1)}
        />
      </div>

      <div className="relative flex flex-col gap-1.5 px-2.5 pt-1">
        <button
          type="button"
          onClick={() => {
            closeSettings();
            emitCommand(NEW_CHAT);
          }}
          className="group flex h-9 items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.06] px-2.5 text-[13px] font-medium text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.4)] transition-colors duration-fast hover:bg-white/[0.09]"
        >
          <SquarePen size={15} strokeWidth={1.75} aria-hidden />
          {t("New chat")}
          <Kbd
            keys="mod+n"
            className="ml-auto opacity-0 transition-opacity duration-fast group-hover:opacity-100"
          />
        </button>
        <button
          type="button"
          onClick={() => emitCommand(OPEN_PALETTE)}
          className="group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-fg-subtle transition-colors duration-fast hover:bg-white/[0.04] hover:text-fg-muted"
        >
          <Search size={15} strokeWidth={1.75} aria-hidden />
          {t("Search")}
          <Kbd
            keys="mod+k"
            className="ml-auto opacity-60 transition-opacity duration-fast group-hover:opacity-100"
          />
        </button>
      </div>

      <nav aria-label={t("Sidebar view")} className="relative mt-3 flex flex-col gap-px px-2.5">
        <NavItem
          icon={MessagesSquare}
          label={t("Chats")}
          shortcut={SHORTCUTS.sessions.label}
          active={active === "sessions"}
          onClick={() => showView("sessions")}
        />
        <NavItem
          icon={Inbox}
          label={t("Inbox")}
          shortcut={SHORTCUTS.inbox.label}
          active={active === "inbox"}
          onClick={() => showView("inbox")}
          meta={
            badge > 0 ? (
              <span className="rounded-full bg-white/[0.08] px-1.5 text-[11px] leading-4.5 font-medium text-fg-muted tabular-nums">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null
          }
        />
      </nav>

      <div aria-hidden className="mx-4 mt-3 h-px bg-white/[0.05]" />

      {/* Both stay mounted so switching views keeps drafts. */}
      <div className="relative mt-1 min-h-0 flex-1">
        <div className="flex h-full flex-col" hidden={view !== "sessions"}>
          <ProjectPicker />
          <div className="min-h-0 flex-1">
            <SessionList />
          </div>
        </div>
        <div className="h-full" hidden={view !== "inbox"}>
          <InboxPanel />
        </div>
      </div>

      <AccountCard settingsOpen={settingsOpen} />
    </div>
  );
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  shortcut: string;
  active: boolean;
  meta?: ReactNode;
  onClick: () => void;
}

function NavItem({ icon: Icon, label, shortcut, active, meta, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      title={`${label} (${shortcut})`}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-[background-color,color] duration-fast",
        active
          ? "bg-white/[0.07] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
          : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
      )}
    >
      <Icon
        size={15}
        strokeWidth={1.75}
        aria-hidden
        className={active ? "text-fg" : "text-fg-subtle"}
      />
      {label}
      {meta && <span className="ml-auto">{meta}</span>}
    </button>
  );
}

/** "Tüm projeler ▾": narrows the conversations to one project folder. */
function ProjectPicker() {
  const groups = useAgentStore(selectProjectGroups);
  const filter = useUiStore((s) => s.projectFilter);
  const current = groups.find((g) => g.cwd === filter) ?? null;
  const options = useMemo(
    () => [
      { value: "", name: t("All projects") },
      ...groups.map((g) => ({ value: g.cwd, name: g.name, meta: String(g.sessions.length) })),
    ],
    [groups],
  );

  return (
    <div className="flex h-8 shrink-0 items-center px-2.5">
      <ChipMenu
        label={t("Project")}
        side="bottom"
        buttonClassName="inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-fg-subtle transition-colors duration-fast hover:bg-white/[0.04] hover:text-fg-muted"
        display={current?.name ?? t("All projects")}
        sections={[
          {
            key: "project",
            label: t("Project"),
            value: current?.cwd ?? "",
            options,
            onSelect: (value) => useUiStore.getState().setProjectFilter(value || null),
          },
        ]}
      />
    </div>
  );
}

/** Bottom card: this computer, the selected agent's state and the way into settings. */
function AccountCard({ settingsOpen }: { settingsOpen: boolean }) {
  const hostname = useHostname();
  const agentId = useAgentStore((s) => s.selectedAgent);
  const agent = useAgentStore((s) => s.agents[s.selectedAgent]);
  const note = statusNote(agent.status) || t("Ready");
  const ready = agent.status.state === "ready" || agent.status.state === "stopped";
  const name = hostname ?? t("This computer");

  return (
    <div className="relative shrink-0 border-t border-white/[0.05] p-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => openSettings("accounts")}
          title={t("Accounts")}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors duration-fast hover:bg-white/[0.04]"
        >
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-[conic-gradient(from_210deg,#d97757,#7aa7f5,#e8e8e8,#d97757)] p-px"
          >
            <span className="grid size-full place-items-center rounded-full bg-[#141415] text-[11px] font-semibold text-fg">
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
                  ready ? "bg-emerald-400/80" : "bg-amber-400/80",
                )}
              />
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={settingsOpen}
          aria-label={t("Settings (Ctrl+,)")}
          title={t("Settings (Ctrl+,)")}
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

interface BarButtonProps {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

function BarButton({ icon: Icon, label, disabled, onClick }: BarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-white/[0.05] hover:text-fg disabled:text-fg-subtle/40 disabled:hover:bg-transparent"
    >
      <Icon size={15} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

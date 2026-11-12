import { useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, PanelLeft, Search, SquarePen } from "lucide-react";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { FrostedGround } from "@/features/backdrop/FrostedGround";
import { ChipMenu } from "@/features/chat/ChipMenu";
import { canTravel, travel, useNavHistory } from "@/features/chat/navHistory";
import { SessionList } from "@/features/chat/SessionList";
import { emitCommand, NEW_CHAT, OPEN_PALETTE } from "@/features/commands/events";
import { ChangesPanel } from "@/features/git/ChangesPanel";
import { useChangesSync } from "@/features/git/useChangesSync";
import { InboxPanel } from "@/features/inbox/InboxPanel";
import { useInboxStore } from "@/features/inbox/store";
import { closeSettings, useSettingsView } from "@/features/settings/viewStore";
import { cn } from "@/shared/ui/cn";
import { Kbd } from "@/shared/ui/Kbd";
import type { PanelBack } from "@/shared/ui/PanelHeader";
import type { ActionId } from "@/features/keymap/actions";
import { matchesAction, PLATFORM, useShortcut } from "@/features/keymap/keymap";
import { describeShortcut } from "@/shared/ui/keys";
import { AccountCard } from "./AccountCard";
import { BarButton } from "./SidebarButtons";
import { focusViewSoon, showView } from "./sidebarView";
import { toggleFiles, useUiStore, type SidebarView } from "./uiStore";
import { NATIVE_CAPTION, TRAFFIC_LIGHT_INSET } from "./WindowControls";
import { t } from "@/shared/i18n";

/**
 * The keymap action per view (by default Ctrl+Shift+H / N / G, Control on macOS too).
 * The defaults avoid WebView2's Ctrl+Shift+I/J (devtools).
 */
const VIEW_ACTIONS: Record<SidebarView, ActionId> = {
  sessions: "view.sessions",
  inbox: "view.inbox",
  changes: "view.changes",
};
const VIEWS = Object.keys(VIEW_ACTIONS) as SidebarView[];

/**
 * The left column: the conversations, nothing else at rest. Top: window controls and
 * history arrows (also the drag handle), then New chat with search beside it. Middle: the
 * conversation list (or, when asked for, the Changes or the Inbox, each with a way back).
 * Bottom: this computer and the agent's state, with Changes, Inbox and Settings beside it.
 */
export function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const view = useUiStore((s) => s.sidebarView);
  const settingsOpen = useSettingsView((s) => s.open);
  const canBack = useNavHistory((s) => canTravel(s, -1));
  const canForward = useNavHistory((s) => canTravel(s, 1));
  const newChatKeys = useShortcut("chat.new");
  const paletteShortcut = useShortcut("palette.open");
  const paletteKeys = paletteShortcut ? describeShortcut(paletteShortcut, PLATFORM) : undefined;
  const searchLabel = t("Search");
  const sessionsKeys = useShortcut("view.sessions");
  const back: PanelBack = {
    label: t("Back to chats"),
    shortcut: sessionsKeys,
    onClick: () => showView("sessions"),
  };

  // Load once at startup so the badge is right before the inbox is opened.
  useEffect(() => {
    void useInboxStore.getState().load();
  }, []);
  useChangesSync();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (matchesAction(e, "view.explorer")) {
        e.preventDefault();
        toggleFiles();
        return;
      }
      const match = VIEWS.find((v) => matchesAction(e, VIEW_ACTIONS[v]));
      if (!match) return;
      e.preventDefault();
      useUiStore.getState().setSidebarView(match);
      focusViewSoon(match);
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

      <div className="relative flex items-center gap-1.5 px-2.5 pt-1">
        <button
          type="button"
          onClick={() => {
            closeSettings();
            emitCommand(NEW_CHAT);
          }}
          className="group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.06] px-2.5 text-[13px] font-medium text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.4)] transition-colors duration-fast hover:bg-white/[0.09]"
        >
          <SquarePen size={15} strokeWidth={1.75} aria-hidden />
          {t("New chat")}
          {newChatKeys && (
            <Kbd
              keys={newChatKeys}
              className="ml-auto opacity-0 transition-opacity duration-fast group-hover:opacity-100"
            />
          )}
        </button>
        <button
          type="button"
          aria-label={searchLabel}
          aria-keyshortcuts={paletteKeys}
          title={paletteKeys ? `${searchLabel} (${paletteKeys})` : searchLabel}
          onClick={() => emitCommand(OPEN_PALETTE)}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors duration-fast hover:bg-white/[0.05] hover:text-fg"
        >
          <Search size={15} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {/* All stay mounted so switching views keeps drafts. */}
      <div className="relative mt-2 min-h-0 flex-1">
        <div className="flex h-full flex-col" hidden={view !== "sessions"}>
          <ProjectPicker />
          <div className="min-h-0 flex-1">
            <SessionList />
          </div>
        </div>
        <div className="h-full" hidden={view !== "inbox"}>
          <InboxPanel back={back} />
        </div>
        <div className="h-full" hidden={view !== "changes"}>
          <ChangesPanel back={back} />
        </div>
      </div>

      <AccountCard settingsOpen={settingsOpen} view={settingsOpen ? null : view} />
    </div>
  );
}

/**
 * "Tüm projeler ▾": narrows the conversations to one project folder. Only there when the
 * list spans more than one project (or one is picked); with one project it filters nothing.
 */
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

  if (groups.length < 2 && !current) return null;
  return (
    <div className="flex h-7 shrink-0 items-center px-2.5">
      <ChipMenu
        label={t("Project")}
        side="bottom"
        buttonClassName="inline-flex h-6 min-w-0 items-center gap-1 rounded-md px-2 text-[11px] text-fg-subtle/80 transition-colors duration-fast hover:bg-white/[0.04] hover:text-fg-muted"
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

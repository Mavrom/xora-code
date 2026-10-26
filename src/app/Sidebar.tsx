import { useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Folder,
  MoreHorizontal,
  PanelLeft,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { selectProjectGroups, useAgentStore } from "@/features/agents/store";
import { SessionList } from "@/features/chat/SessionList";
import { ChipMenu } from "@/features/chat/ChipMenu";
import { canTravel, travel, useNavHistory } from "@/features/chat/navHistory";
import { FileTree } from "@/features/files/FileTree";
import { InboxPanel } from "@/features/inbox/InboxPanel";
import { useInboxStore } from "@/features/inbox/store";
import { openCount } from "@/features/inbox/sortNotes";
import { INBOX_COMPOSER_ID } from "@/features/inbox/NoteComposer";
import { closeSettings, useSettingsView } from "@/features/settings/viewStore";
import { openFolder } from "@/features/workspace/openFolder";
import { cn } from "@/shared/ui/cn";
import { useUiStore, type SidebarView } from "./uiStore";

/** Ctrl+Shift+<code> per view. Avoids WebView2's Ctrl+Shift+I/J (devtools). */
const SHORTCUTS: Record<SidebarView, { code: string; label: string }> = {
  sessions: { code: "KeyH", label: "Ctrl+Shift+H" },
  explorer: { code: "KeyE", label: "Ctrl+Shift+E" },
  inbox: { code: "KeyN", label: "Ctrl+Shift+N" },
};

const VIEW_NAMES: Record<SidebarView, string> = {
  sessions: "Oturumlar",
  explorer: "Gezgin",
  inbox: "Inbox",
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
 * The left column: hide + back/forward on top (also the window's drag handle), the
 * project filter with a "more" menu for the other views, the current view, and the
 * settings avatar in the corner.
 */
export function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const view = useUiStore((s) => s.sidebarView);
  const settingsOpen = useSettingsView((s) => s.open);
  const canBack = useNavHistory((s) => canTravel(s, -1));
  const canForward = useNavHistory((s) => canTravel(s, 1));

  // Load once at startup so the badge is right before the inbox is opened.
  useEffect(() => {
    void useInboxStore.getState().load();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey || e.repeat) return;
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
    <div className="flex h-full flex-col bg-surface">
      <div data-tauri-drag-region="deep" className="flex h-10 shrink-0 items-center gap-1 px-2">
        <BarButton icon={PanelLeft} label="Kenar çubuğunu gizle" onClick={onCollapse} />
        <BarButton icon={ArrowLeft} label="Geri" disabled={!canBack} onClick={() => travel(-1)} />
        <BarButton
          icon={ArrowRight}
          label="İleri"
          disabled={!canForward}
          onClick={() => travel(1)}
        />
      </div>
      <div className="flex h-9 shrink-0 items-center gap-1 pr-2 pl-1.5">
        <ProjectPicker />
        <ViewMenu view={settingsOpen ? null : view} />
      </div>
      {/* All stay mounted so switching views keeps tree expansion and drafts. */}
      <div className="mt-1 min-h-0 flex-1">
        <div className="h-full" hidden={view !== "sessions"}>
          <SessionList />
        </div>
        <div className="h-full" hidden={view !== "explorer"}>
          <FileTree onOpenFolder={openFolder} />
        </div>
        <div className="h-full" hidden={view !== "inbox"}>
          <InboxPanel />
        </div>
      </div>
      <div className="shrink-0 px-3 pt-1 pb-3">
        <button
          type="button"
          aria-pressed={settingsOpen}
          aria-label="Ayarlar (Ctrl+,)"
          title="Ayarlar (Ctrl+,)"
          onClick={() => useSettingsView.getState().toggleSettings()}
          className={cn(
            "grid size-5 place-items-center rounded-full transition-colors duration-fast",
            settingsOpen ? "bg-fg text-bg" : "bg-elevated text-fg-muted hover:bg-fg hover:text-bg",
          )}
        >
          <Settings size={11} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** "Tüm projeler": narrows the sessions list to one project folder. */
function ProjectPicker() {
  const groups = useAgentStore(selectProjectGroups);
  const filter = useUiStore((s) => s.projectFilter);
  const current = groups.find((g) => g.cwd === filter) ?? null;
  const options = useMemo(
    () => [
      { value: "", name: "Tüm projeler" },
      ...groups.map((g) => ({ value: g.cwd, name: g.name, meta: String(g.sessions.length) })),
    ],
    [groups],
  );

  return (
    <ChipMenu
      label="Proje"
      side="bottom"
      className="flex-1"
      buttonClassName="flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-[13px] font-medium text-fg transition-colors duration-fast hover:bg-hover [&>svg:last-child]:ml-auto"
      leading={
        <Folder size={15} strokeWidth={1.5} aria-hidden className="shrink-0 text-fg-muted" />
      }
      display={current?.name ?? "Tüm projeler"}
      sections={[
        {
          key: "project",
          label: "Proje",
          value: current?.cwd ?? "",
          options,
          onSelect: (value) => {
            useUiStore.getState().setProjectFilter(value || null);
            showView("sessions");
          },
        },
      ]}
    />
  );
}

/** The "…" menu: switches the sidebar between sessions, files and the inbox. */
function ViewMenu({ view }: { view: SidebarView | null }) {
  const badge = useInboxStore((s) => openCount(s.notes));
  return (
    <ChipMenu
      label="Kenar çubuğu görünümü"
      side="bottom"
      align="end"
      chevron={false}
      buttonClassName="relative grid size-7 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
      display={
        <>
          <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
          {badge > 0 && (
            <span
              aria-hidden
              className="absolute top-1 right-1 size-1.5 rounded-full bg-fg ring-2 ring-surface"
            />
          )}
        </>
      }
      sections={[
        {
          key: "view",
          label: "Görünüm",
          value: view ?? "",
          options: (Object.keys(VIEW_NAMES) as SidebarView[]).map((v) => ({
            value: v,
            name: VIEW_NAMES[v],
            meta: v === "inbox" && badge > 0 ? `${badge} açık` : SHORTCUTS[v].label,
          })),
          onSelect: (value) => showView(value as SidebarView),
        },
      ]}
    />
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
      className="grid size-7 place-items-center rounded-md text-fg-muted transition-colors duration-fast hover:bg-hover hover:text-fg disabled:text-fg-subtle/50 disabled:hover:bg-transparent"
    >
      <Icon size={15} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

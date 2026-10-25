import { useEffect } from "react";
import { Files, Inbox, type LucideIcon } from "lucide-react";
import { useInboxStore } from "@/features/inbox/store";
import { openCount } from "@/features/inbox/sortNotes";
import { INBOX_COMPOSER_ID } from "@/features/inbox/NoteComposer";
import { cn } from "@/shared/ui/cn";
import { useUiStore, type SidebarView } from "./uiStore";

/** Ctrl+Shift+<code> per view. Avoids WebView2's Ctrl+Shift+I/J (devtools). */
const SHORTCUTS: Record<SidebarView, { code: string; label: string }> = {
  explorer: { code: "KeyE", label: "Ctrl+Shift+E" },
  inbox: { code: "KeyN", label: "Ctrl+Shift+N" },
};

/** Opening the inbox is a capture gesture: land straight in the composer. */
function focusComposerSoon() {
  requestAnimationFrame(() => document.getElementById(INBOX_COMPOSER_ID)?.focus());
}

export function ActivityBar() {
  const view = useUiStore((s) => s.sidebarView);
  const setView = useUiStore((s) => s.setSidebarView);
  const badge = useInboxStore((s) => openCount(s.notes));

  const show = (next: SidebarView) => {
    setView(next);
    if (next === "inbox") focusComposerSoon();
  };

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
    <nav
      aria-label="Kenar çubuğu görünümü"
      className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg py-2"
    >
      <ActivityItem
        icon={Files}
        label={`Gezgin (${SHORTCUTS.explorer.label})`}
        active={view === "explorer"}
        onClick={() => show("explorer")}
      />
      <ActivityItem
        icon={Inbox}
        label={`Inbox (${SHORTCUTS.inbox.label})`}
        active={view === "inbox"}
        badge={badge}
        onClick={() => show("inbox")}
      />
    </nav>
  );
}

interface ActivityItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

function ActivityItem({ icon: Icon, label, active, badge = 0, onClick }: ActivityItemProps) {
  const badgeText = badge > 99 ? "99+" : String(badge);
  return (
    <button
      type="button"
      aria-label={badge > 0 ? `${label}, ${badge} açık not` : label}
      title={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "relative grid size-9 place-items-center rounded-md transition-colors duration-150",
        active ? "text-fg" : "text-fg-subtle hover:bg-hover hover:text-fg-muted",
      )}
    >
      {/* Indicator sits on the bar's left edge (button is inset 4px). */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 -left-1 w-0.5 origin-center rounded-r-full bg-accent transition-transform duration-200 ease-out-quint",
          active ? "scale-y-100" : "scale-y-0",
        )}
      />
      <Icon size={18} strokeWidth={1.5} aria-hidden />
      {/* Badge hugs the top-right corner, clear of the icon glyph. */}
      {badge > 0 && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-fg px-[3px] text-[9px] leading-none font-semibold text-bg tabular-nums ring-2 ring-bg starting:scale-50 starting:opacity-0 transition-[scale,opacity] duration-200 ease-out-quint"
        >
          {badgeText}
        </span>
      )}
    </button>
  );
}

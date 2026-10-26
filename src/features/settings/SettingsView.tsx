import { WindowControls } from "@/app/WindowControls";
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  Bot,
  CircleUserRound,
  Info,
  Keyboard,
  Palette,
  SlidersHorizontal,
  SquareCode,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { Kbd } from "@/shared/ui/Kbd";
import { stepIndex } from "./controls/keyboard";
import { AboutSection } from "./sections/AboutSection";
import { AccountsSection } from "./sections/AccountsSection";
import { AgentSection } from "./sections/AgentSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { EditorSection } from "./sections/EditorSection";
import { GeneralSection } from "./sections/GeneralSection";
import { ShortcutsSection } from "./sections/ShortcutsSection";
import { isSidebarShortcut } from "./settingsKeys";
import { useSettingsStore } from "./store";
import { SETTINGS_SECTIONS, useSettingsView, type SettingsSection } from "./viewStore";

const NAV: Record<SettingsSection, { label: string; icon: LucideIcon; render: () => ReactNode }> = {
  accounts: { label: "Hesaplar", icon: CircleUserRound, render: () => <AccountsSection /> },
  agent: { label: "Agent", icon: Bot, render: () => <AgentSection /> },
  editor: { label: "Editör", icon: SquareCode, render: () => <EditorSection /> },
  general: { label: "Genel", icon: SlidersHorizontal, render: () => <GeneralSection /> },
  appearance: { label: "Görünüm", icon: Palette, render: () => <AppearanceSection /> },
  shortcuts: { label: "Kısayollar", icon: Keyboard, render: () => <ShortcutsSection /> },
  about: { label: "Hakkında", icon: Info, render: () => <AboutSection /> },
};

/** Groups in the left nav; a hairline separates them. */
const NAV_GROUPS: SettingsSection[][] = [
  ["accounts", "agent"],
  ["editor", "general", "appearance", "shortcuts"],
  ["about"],
];

/**
 * Settings page over the whole window. Left: section nav. Right: the section, centred in a
 * readable column. Esc closes.
 */
export default function SettingsView() {
  const section = useSettingsView((s) => s.section);
  const setSection = useSettingsView((s) => s.setSection);
  const close = useSettingsView((s) => s.closeSettings);
  const saveError = useSettingsStore((s) => (s.status === "ready" ? s.error : null));
  const root = useRef<HTMLDivElement>(null);

  // Focus the active nav item on open; give focus back to where it was on close.
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  // Switching the sidebar (Ctrl+Shift+E/N) means "take me back to work".
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (isSidebarShortcut(e)) close();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [close]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.preventDefault();
      close();
    }
  };

  const onNavKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const index = SETTINGS_SECTIONS.indexOf(section);
    const key = e.key === "ArrowLeft" || e.key === "ArrowRight" ? "" : e.key;
    const next = stepIndex(key, index, SETTINGS_SECTIONS.length);
    if (next === null) return;
    e.preventDefault();
    const target = SETTINGS_SECTIONS[next];
    setSection(target);
    root.current?.querySelector<HTMLElement>(`[data-section="${target}"]`)?.focus();
  };

  return (
    <div
      ref={root}
      role="region"
      aria-label="Ayarlar"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="absolute inset-0 z-20 grid min-h-0 grid-cols-[224px_minmax(0,1fr)] overflow-hidden bg-bg outline-none transition-opacity duration-base ease-out-quint starting:opacity-0"
    >
      <nav
        aria-label="Ayar bölümleri"
        onKeyDown={onNavKeyDown}
        className="bg-surface relative flex min-h-0 flex-col border-r border-border"
      >
        <div data-tauri-drag-region="deep" className="flex h-14 shrink-0 items-center gap-1.5 px-3">
          <button
            type="button"
            aria-label="Geri"
            title="Geri (Esc)"
            onClick={close}
            className="grid size-7 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
          >
            <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
          </button>
          <h1 className="text-ui font-semibold tracking-tight text-fg">Ayarlar</h1>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pb-3">
          {NAV_GROUPS.map((group, gi) => (
            <ul
              key={gi}
              className={cn(
                "flex flex-col gap-px",
                gi > 0 && "mt-2.5 border-t border-border pt-2.5",
              )}
            >
              {group.map((id) => {
                const item = NAV[id];
                const Icon = item.icon;
                const active = id === section;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      data-section={id}
                      aria-current={active ? "page" : undefined}
                      tabIndex={active ? 0 : -1}
                      onClick={() => setSection(id)}
                      className={cn(
                        "relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-ui transition-colors duration-fast",
                        "focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-subtle",
                        active
                          ? "bg-elevated text-fg shadow-[inset_0_0_0_1px_var(--color-border)]"
                          : "text-fg-muted hover:bg-hover/70 hover:text-fg",
                      )}
                    >
                      <Icon
                        size={15}
                        strokeWidth={1.75}
                        aria-hidden
                        className={active ? "text-fg" : "text-fg-subtle"}
                      />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 border-t border-border px-5 py-3 text-2xs text-fg-subtle">
          <Kbd keys="mod+," />
          <span>ile aç</span>
          <span aria-hidden className="mx-0.5">
            ·
          </span>
          <Kbd keys="esc" />
          <span>kapat</span>
        </div>
      </nav>

      <div className="bg-bg relative min-h-0">
        {/* The page covers the window, so it carries the drag strip and caption buttons. */}
        <div
          data-tauri-drag-region="deep"
          className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-end"
        >
          <WindowControls />
        </div>

        {/* Keyed so each section starts at the top and fades in. */}
        <div key={section} className="h-full overflow-y-auto [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-[680px] px-10 pt-12 pb-20 transition-[opacity,translate] duration-slow ease-out-quint starting:translate-y-1 starting:opacity-0">
            {saveError && (
              <p
                role="alert"
                className="mb-6 rounded-md border border-border px-3 py-2 text-xs text-danger"
              >
                Ayarlar kaydedilemedi: {saveError}
              </p>
            )}
            {NAV[section].render()}
          </div>
        </div>
      </div>
    </div>
  );
}

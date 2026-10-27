import { NATIVE_CAPTION, TRAFFIC_LIGHT_INSET, WindowControls } from "@/app/WindowControls";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Bot,
  CircleUserRound,
  Info,
  Keyboard,
  Palette,
  Search,
  SlidersHorizontal,
  SquareCode,
  SquareTerminal,
  X,
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
import { TerminalSection } from "./sections/TerminalSection";
import { searchSettings, type SearchEntry } from "./searchIndex";
import { isSidebarShortcut } from "./settingsKeys";
import { useSettingsStore } from "./store";
import { SETTINGS_SECTIONS, useSettingsView, type SettingsSection } from "./viewStore";
import { t } from "@/shared/i18n";

const NAV: Record<SettingsSection, { label: string; icon: LucideIcon; render: () => ReactNode }> = {
  accounts: { label: t("Accounts"), icon: CircleUserRound, render: () => <AccountsSection /> },
  agent: { label: t("Agent"), icon: Bot, render: () => <AgentSection /> },
  editor: { label: t("Editor"), icon: SquareCode, render: () => <EditorSection /> },
  general: { label: t("General"), icon: SlidersHorizontal, render: () => <GeneralSection /> },
  appearance: { label: t("Appearance"), icon: Palette, render: () => <AppearanceSection /> },
  terminal: { label: t("Terminal"), icon: SquareTerminal, render: () => <TerminalSection /> },
  shortcuts: { label: t("Shortcuts"), icon: Keyboard, render: () => <ShortcutsSection /> },
  about: { label: t("About"), icon: Info, render: () => <AboutSection /> },
};

/** Groups in the left nav; a hairline separates them. */
const NAV_GROUPS: SettingsSection[][] = [
  ["accounts", "agent"],
  ["general", "appearance", "editor", "terminal", "shortcuts"],
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
  const [query, setQuery] = useState("");
  const results = searchSettings(query);
  const searching = query.trim().length > 0;

  // A search result opens its section and lands on the row, briefly highlighted.
  const [landing, setLanding] = useState<SearchEntry | null>(null);
  const go = (entry: SearchEntry) => {
    setQuery("");
    setSection(entry.section);
    setLanding(entry);
  };
  useEffect(() => {
    if (!landing?.setting) return;
    const id = requestAnimationFrame(() => {
      const row = root.current?.querySelector<HTMLElement>(`[data-setting="${landing.setting}"]`);
      if (!row) return;
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.classList.remove("setting-flash");
      void row.offsetWidth;
      row.classList.add("setting-flash");
    });
    return () => cancelAnimationFrame(id);
  }, [landing, section]);

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
      // Esc first clears a search, then closes.
      if (searching) setQuery("");
      else close();
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
      aria-label={t("Settings")}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="absolute inset-0 z-20 grid min-h-0 grid-cols-[224px_minmax(0,1fr)] overflow-hidden bg-black/75 outline-none transition-opacity duration-base ease-out-quint starting:opacity-0"
    >
      <nav
        aria-label={t("Settings sections")}
        onKeyDown={onNavKeyDown}
        className="relative flex min-h-0 flex-col border-r border-white/[0.06] bg-black/35"
      >
        <div
          data-tauri-drag-region="deep"
          className={cn(
            "flex h-14 shrink-0 items-center gap-1.5 px-3",
            NATIVE_CAPTION && TRAFFIC_LIGHT_INSET,
          )}
        >
          <button
            type="button"
            aria-label={t("Back")}
            title={t("Back (Esc)")}
            onClick={close}
            className="grid size-7 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
          >
            <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
          </button>
          <h1 className="text-ui font-semibold tracking-tight text-fg">{t("Settings")}</h1>
        </div>
        <div className="px-2.5 pb-2">
          <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-white/[0.03] px-2.5 text-fg-subtle transition-colors duration-fast focus-within:border-border-strong focus-within:text-fg-muted">
            <Search size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) {
                  e.preventDefault();
                  go(results[0]);
                }
              }}
              placeholder={t("Search settings")}
              aria-label={t("Search settings")}
              className="min-w-0 flex-1 bg-transparent text-ui text-fg outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
            />
            {searching && (
              <button
                type="button"
                aria-label={t("Clear search")}
                onClick={() => setQuery("")}
                className="grid size-5 place-items-center rounded-sm hover:bg-hover hover:text-fg"
              >
                <X size={12} strokeWidth={2} aria-hidden />
              </button>
            )}
          </label>
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
          <span>{t("to open")}</span>
          <span aria-hidden className="mx-0.5">
            ·
          </span>
          <Kbd keys="esc" />
          <span>{t("close")}</span>
        </div>
      </nav>

      <div className="relative min-h-0">
        {/* The page covers the window, so it carries the drag strip and caption buttons. */}
        <div
          data-tauri-drag-region="deep"
          className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-end"
        >
          <WindowControls />
        </div>

        {/* Keyed so each section starts at the top and fades in. */}
        <div
          key={searching ? "search" : section}
          className="h-full overflow-y-auto [scrollbar-gutter:stable]"
        >
          <div className="mx-auto w-full max-w-[680px] px-10 pt-12 pb-20 transition-[opacity,translate] duration-slow ease-out-quint starting:translate-y-1 starting:opacity-0">
            {saveError && (
              <p
                role="alert"
                className="mb-6 rounded-md border border-border px-3 py-2 text-xs text-danger"
              >
                {t("Could not save settings: {error}", { error: saveError })}
              </p>
            )}
            {searching ? (
              <SearchResults query={query} results={results} onPick={go} />
            ) : (
              NAV[section].render()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchResults({
  query,
  results,
  onPick,
}: {
  query: string;
  results: SearchEntry[];
  onPick: (entry: SearchEntry) => void;
}) {
  if (results.length === 0) {
    return (
      <p className="pt-10 text-center text-ui text-fg-muted">
        {t("No setting matches “{query}”.", { query: query.trim() })}
      </p>
    );
  }
  return (
    <>
      <h2 className="text-title font-semibold text-fg">{t("Search results")}</h2>
      <p className="mt-1.5 text-ui text-fg-muted">
        {results.length === 1
          ? t("1 setting · Enter opens it")
          : t("{n} settings · Enter opens the first", { n: results.length })}
      </p>
      <ul className="bg-surface mt-6 divide-y divide-border overflow-hidden rounded-lg border border-border">
        {results.map((entry) => {
          const Icon = NAV[entry.section].icon;
          return (
            <li key={`${entry.section}:${entry.label}`}>
              <button
                type="button"
                onClick={() => onPick(entry)}
                className="flex h-12 w-full items-center gap-3 px-4 text-left transition-colors duration-fast hover:bg-hover/60 focus-visible:bg-hover/60 focus-visible:outline-none"
              >
                <Icon
                  size={15}
                  strokeWidth={1.75}
                  aria-hidden
                  className="shrink-0 text-fg-subtle"
                />
                <span className="min-w-0 flex-1 truncate text-ui text-fg">{entry.label}</span>
                <span className="shrink-0 text-xs text-fg-subtle">{NAV[entry.section].label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Bot,
  CircleUserRound,
  Info,
  Keyboard,
  Palette,
  SlidersHorizontal,
  SquareCode,
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
import { wallpaperSrc } from "./glass";
import { isSidebarShortcut } from "./settingsKeys";
import { useSettingsStore } from "./store";
import { SETTINGS_SECTIONS, useSettingsView, type SettingsSection } from "./viewStore";
import { WallpaperImage } from "./WallpaperImage";

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
 * The wallpaper again, inside the settings page: the page covers the work panels,
 * so it cannot see the app-wide layer through them. Sized to the window and offset
 * by the page's position, it lines up exactly with that layer.
 */
function SettingsBackdrop({ host }: { host: RefObject<HTMLDivElement | null> }) {
  const appearance = useSettingsStore((s) => s.settings.appearance);
  const src = wallpaperSrc(appearance.wallpaper);
  const [failed, setFailed] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0, w: 0, h: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const rect = host.current?.getBoundingClientRect();
      if (rect)
        setOffset({ x: rect.left, y: rect.top, w: window.innerWidth, h: window.innerHeight });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [host]);

  if (!src || failed === src || offset.w === 0) return null;
  return (
    <WallpaperImage
      key={src}
      src={src}
      blur={appearance.blur}
      dim={appearance.dim}
      onError={() => setFailed(src)}
      className="absolute"
      style={{ left: -offset.x, top: -offset.y, width: offset.w, height: offset.h }}
    />
  );
}

/**
 * Full-height settings page over the panel area (the activity and title bars stay).
 * Left: section nav. Right: the section, centred in a readable column. Esc closes.
 * Both panes are glass over the wallpaper (solid onyx when there is none).
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
      className="relative z-20 col-start-2 row-start-2 grid min-h-0 grid-cols-[224px_minmax(0,1fr)] overflow-hidden bg-bg outline-none transition-opacity duration-base ease-out-quint starting:opacity-0"
    >
      <SettingsBackdrop host={root} />
      <nav
        aria-label="Ayar bölümleri"
        onKeyDown={onNavKeyDown}
        className="glass-surface relative flex min-h-0 flex-col border-r border-border"
      >
        <div className="flex h-14 shrink-0 items-center px-5">
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

      <div className="glass-bg relative min-h-0">
        <button
          type="button"
          aria-label="Ayarları kapat"
          title="Kapat (Esc)"
          onClick={close}
          className="absolute top-3 right-4 z-10 grid size-8 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>

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

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { FileIcon } from "@/features/files/FileIcon";
import { basename } from "@/shared/lib/path";
import { cn } from "@/shared/ui/cn";
import { isPaletteOpen } from "@/features/commands/paletteGuard";
import { closeActiveTab, requestCloseTab } from "./closeTab";
import { focusEditorSoon } from "./editorFocus";
import { isCloseTabShortcut, isShown, revealTabScroll } from "./editorKeys";
import { isDirty, useEditorStore, type Tab } from "./store";

/** Parent folder name, shown only when two open tabs share a file name. */
const parentName = (path: string) => basename(path.replace(/[\\/][^\\/]*$/, ""));

const FADE = 16;

export function EditorTabs() {
  const tabs = useEditorStore((s) => s.tabs);
  const activePath = useEditorStore((s) => s.activePath);
  const setActive = useEditorStore((s) => s.setActive);
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const duplicateNames = useMemo(() => {
    const seen = new Map<string, number>();
    for (const t of tabs) seen.set(t.name, (seen.get(t.name) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([name]) => name));
  }, [tabs]);

  // Track whether content is hidden on either side so the edges can fade out.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () =>
      setEdges({
        left: el.scrollLeft > 0,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [tabs.length]);

  // Keep the active tab (including its close button) fully visible, e.g. after opening a
  // file: clear of the edge fades, and snapped so its neighbour is never cut mid-label.
  useEffect(() => {
    const el = scroller.current;
    const tab = el?.querySelector<HTMLElement>("[aria-selected=true]")?.parentElement;
    if (!el || !tab) return;
    const tabs = [...el.querySelectorAll<HTMLElement>(":scope > [data-tab]")];
    const next = revealTabScroll(
      tabs.map((t) => ({ start: t.offsetLeft, end: t.offsetLeft + t.offsetWidth })),
      tabs.indexOf(tab),
      el.scrollLeft,
      el.clientWidth,
      FADE,
    );
    if (next !== null) el.scrollLeft = next;
  }, [activePath, tabs.length]);

  // Ctrl+W closes the active tab from anywhere; capture phase so Monaco cannot swallow it.
  // A held key closes one tab, not a run of them, and a collapsed editor panel (the strip
  // has no width) is left alone so nothing invisible gets closed.
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented || isPaletteOpen() || !isCloseTabShortcut(e)) return;
      if (!isShown(scroller.current)) return;
      e.preventDefault();
      if (!e.repeat) closeActiveTab();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // Left/Right/Home/End move between tabs; the focused tab becomes active.
  // Delete closes the focused tab and hands focus to the tab that takes its place.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.path === activePath);
    if (e.key === "Delete" && index !== -1) {
      e.preventDefault();
      const strip = e.currentTarget;
      void requestCloseTab(tabs[index]).then(() =>
        requestAnimationFrame(() =>
          strip.querySelector<HTMLElement>("[role=tab][aria-selected=true]")?.focus(),
        ),
      );
      return;
    }
    const target =
      e.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : e.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : -1;
    if (target === -1) return;
    e.preventDefault();
    setActive(tabs[target].path);
    e.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")[target]?.focus();
  };

  const mask =
    edges.left || edges.right
      ? `linear-gradient(90deg, ${edges.left ? "transparent" : "black"}, black ${FADE}px, black calc(100% - ${FADE}px), ${edges.right ? "transparent" : "black"})`
      : undefined;

  return (
    <div
      ref={scroller}
      role="tablist"
      aria-label="Açık dosyalar"
      onKeyDown={onKeyDown}
      // A vertical wheel scrolls the strip sideways, like every desktop editor.
      onWheel={(e) => {
        if (e.deltaY !== 0 && e.deltaX === 0) e.currentTarget.scrollLeft += e.deltaY;
      }}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
      className="relative flex h-9 shrink-0 overflow-x-auto overflow-y-hidden glass-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => (
        <EditorTab
          key={tab.path}
          tab={tab}
          active={tab.path === activePath}
          hint={duplicateNames.has(tab.name) ? parentName(tab.path) : undefined}
          onSelect={() => {
            // Like VS Code / Zed: picking a tab means "edit this", so the editor gets focus.
            setActive(tab.path);
            focusEditorSoon();
          }}
        />
      ))}
      {/* Filler carries the strip's bottom border; the active tab stays open to the editor. */}
      <div className="min-w-4 flex-1 border-b border-border" aria-hidden />
    </div>
  );
}

interface EditorTabProps {
  tab: Tab;
  active: boolean;
  hint?: string;
  onSelect: () => void;
}

function EditorTab({ tab, active, hint, onSelect }: EditorTabProps) {
  const dirty = isDirty(tab);
  const marked = dirty || !!tab.diskChanged;

  const onMouseDown = (e: MouseEvent) => {
    // Middle button: suppress the autoscroll cursor, close on auxclick.
    if (e.button === 1) e.preventDefault();
  };

  return (
    <div
      data-tab
      onMouseDown={onMouseDown}
      onAuxClick={(e) => {
        if (e.button === 1) void requestCloseTab(tab);
      }}
      className={cn(
        "group relative flex h-full max-w-56 shrink-0 items-center border-r border-b transition-colors duration-150",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-accent before:transition-opacity before:duration-150",
        active
          ? "border-r-border border-b-transparent glass-bg text-fg before:opacity-100"
          : "border-border text-fg-muted before:opacity-0 hover:bg-hover hover:text-fg",
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        title={tab.diskChanged ? `${tab.path}\nDiskte değişti` : tab.path}
        aria-keyshortcuts="Delete Control+W"
        onClick={onSelect}
        className="flex h-full min-w-0 items-center gap-2 pr-1 pl-3 text-xs outline-none focus-visible:bg-hover"
      >
        <FileIcon name={tab.name} />
        <span className="truncate">{tab.name}</span>
        {hint && <span className="truncate text-2xs text-fg-subtle">{hint}</span>}
        {dirty && <span className="sr-only">(kaydedilmedi)</span>}
        {tab.diskChanged && <span className="sr-only">(diskte değişti)</span>}
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${tab.name} kapat`}
        title="Kapat (Ctrl+W)"
        onClick={() => void requestCloseTab(tab)}
        className={cn(
          "group/close mr-1.5 grid size-5 shrink-0 place-items-center rounded-sm text-fg-subtle transition-colors duration-150 hover:bg-elevated hover:text-fg",
          !marked && !active && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {marked ? (
          <>
            {tab.diskChanged ? (
              // Changed on disk under unsaved edits (or gone): a ring, not the plain dirty dot.
              <span
                className="size-2 rounded-full border-[1.5px] border-warning group-hover/close:hidden"
                aria-hidden
              />
            ) : (
              <span
                className="size-2 rounded-full bg-warning group-hover/close:hidden"
                aria-hidden
              />
            )}
            <X
              size={14}
              strokeWidth={1.75}
              className="hidden group-hover/close:block"
              aria-hidden
            />
          </>
        ) : (
          <X size={14} strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { X } from "lucide-react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { FileIcon } from "@/features/files/FileIcon";
import { basename } from "@/shared/lib/path";
import { cn } from "@/shared/ui/cn";
import { isDirty, useEditorStore, type Tab } from "./store";

/**
 * Closes a tab, asking first when it has unsaved changes. Uses the dialog plugin directly:
 * the plugin replaces `window.confirm` with an async version that always returns a Promise.
 */
async function requestClose(tab: Tab) {
  if (isDirty(tab)) {
    const discard = await confirm(`${tab.name} kaydedilmedi. Yine de kapatılsın mı?`, {
      title: "Kaydedilmemiş değişiklikler",
      kind: "warning",
      okLabel: "Kapat",
      cancelLabel: "İptal",
    });
    if (!discard) return;
  }
  useEditorStore.getState().closeTab(tab.path);
}

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

  // Keep the active tab (including its close button) visible, e.g. after opening a file.
  useEffect(() => {
    const el = scroller.current;
    const tab = el?.querySelector("[aria-selected=true]")?.parentElement;
    if (!el || !tab) return;
    const start = tab.offsetLeft;
    const end = start + tab.offsetWidth;
    if (start < el.scrollLeft) el.scrollLeft = start;
    else if (end > el.scrollLeft + el.clientWidth) el.scrollLeft = end - el.clientWidth;
  }, [activePath, tabs.length]);

  // Left/Right/Home/End move between tabs; the focused tab becomes active.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.path === activePath);
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
      ? `linear-gradient(90deg, ${edges.left ? "transparent" : "#000"}, #000 ${FADE}px, #000 calc(100% - ${FADE}px), ${edges.right ? "transparent" : "#000"})`
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
      className="relative flex h-9 shrink-0 overflow-x-auto overflow-y-hidden bg-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => (
        <EditorTab
          key={tab.path}
          tab={tab}
          active={tab.path === activePath}
          hint={duplicateNames.has(tab.name) ? parentName(tab.path) : undefined}
          onSelect={() => setActive(tab.path)}
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

  const onMouseDown = (e: MouseEvent) => {
    // Middle button: suppress the autoscroll cursor, close on auxclick.
    if (e.button === 1) e.preventDefault();
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onAuxClick={(e) => {
        if (e.button === 1) void requestClose(tab);
      }}
      className={cn(
        "group relative flex h-full max-w-56 shrink-0 items-center border-r border-b transition-colors duration-150",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-accent before:transition-opacity before:duration-150",
        active
          ? "border-r-border border-b-transparent bg-bg text-fg before:opacity-100"
          : "border-border text-fg-muted before:opacity-0 hover:bg-hover hover:text-fg",
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        title={tab.path}
        onClick={onSelect}
        className="flex h-full min-w-0 items-center gap-2 pr-1 pl-3 text-[12px] outline-none focus-visible:bg-hover"
      >
        <FileIcon name={tab.name} />
        <span className="truncate">{tab.name}</span>
        {hint && <span className="truncate text-[11px] text-fg-subtle">{hint}</span>}
        {dirty && <span className="sr-only">(kaydedilmedi)</span>}
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${tab.name} kapat`}
        title="Kapat"
        onClick={() => void requestClose(tab)}
        className={cn(
          "group/close mr-1.5 grid size-5 shrink-0 place-items-center rounded-sm text-fg-subtle transition-colors duration-150 hover:bg-elevated hover:text-fg",
          !dirty && !active && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {dirty ? (
          <>
            <span className="size-2 rounded-full bg-warning group-hover/close:hidden" aria-hidden />
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

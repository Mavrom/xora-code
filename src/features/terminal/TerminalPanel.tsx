import { useCallback, useEffect, useMemo, type KeyboardEvent } from "react";
import { ChevronDown, Plus, SquareTerminal, X } from "lucide-react";
import { IconButton } from "@/shared/ui/IconButton";
import { cn } from "@/shared/ui/cn";
import { disposeSession } from "./session";
import { useTerminalStore } from "./store";
import { cycleTab, tabLabels, type TerminalTab } from "./tabs";
import { TerminalView } from "./TerminalView";

interface TerminalPanelProps {
  /** Collapses the bottom panel (also used when the last tab closes). */
  onHide: () => void;
}

/** Tab strip plus one terminal per tab. Loaded lazily: this chunk carries xterm. */
export default function TerminalPanel({ onHide }: TerminalPanelProps) {
  const tabs = useTerminalStore((s) => s.tabs);
  const activeKey = useTerminalStore((s) => s.activeKey);
  const open = useTerminalStore((s) => s.open);
  const labels = useMemo(() => tabLabels(tabs), [tabs]);

  const newTab = useCallback(() => {
    const { addTab, requestFocus } = useTerminalStore.getState();
    addTab();
    requestFocus();
  }, []);

  const closeTab = useCallback(
    (key: number) => {
      void disposeSession(key);
      const store = useTerminalStore.getState();
      store.removeTab(key);
      if (useTerminalStore.getState().tabs.length === 0) onHide();
      else store.requestFocus();
    },
    [onHide],
  );

  // Opening the panel with no terminal starts one. Reads the live store, not the render
  // snapshot, so StrictMode's double effect run cannot start two.
  useEffect(() => {
    if (open && useTerminalStore.getState().tabs.length === 0) newTab();
  }, [open, tabs.length, newTab]);

  const select = (key: number) => {
    const store = useTerminalStore.getState();
    store.setActive(key);
    store.requestFocus();
  };

  // Ctrl+PageUp/PageDown switch tabs, also from inside xterm (capture runs before it).
  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    const delta = e.key === "PageDown" ? 1 : e.key === "PageUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    const next = cycleTab(tabs, activeKey, delta);
    if (next !== null) select(next);
  };

  // Arrow keys move between tabs in the strip (roving tabindex).
  const onStripKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = cycleTab(tabs, activeKey, delta);
    if (next === null) return;
    useTerminalStore.getState().setActive(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-tab-key="${next}"]`)?.focus();
  };

  return (
    <section
      aria-label="Terminal"
      onKeyDownCapture={onKeyDownCapture}
      className="flex h-full min-h-0 flex-col bg-bg"
    >
      <div className="flex h-9 shrink-0 items-center gap-1 pr-1.5 pl-2">
        <div
          role="tablist"
          aria-label="Terminaller"
          onKeyDown={onStripKeyDown}
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => (
            <TerminalTabButton
              key={tab.key}
              tab={tab}
              label={labels.get(tab.key) ?? "Terminal"}
              active={tab.key === activeKey}
              onSelect={() => select(tab.key)}
              onClose={() => closeTab(tab.key)}
            />
          ))}
        </div>
        <IconButton icon={Plus} label="Yeni terminal (Ctrl+Shift+`)" size="sm" onClick={newTab} />
        <div className="flex-1" />
        <IconButton
          icon={ChevronDown}
          label="Terminali gizle (Ctrl+`)"
          size="sm"
          onClick={onHide}
        />
      </div>
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <TerminalView
            key={tab.key}
            tabKey={tab.key}
            active={tab.key === activeKey}
            onCleanExit={closeTab}
          />
        ))}
      </div>
    </section>
  );
}

interface TerminalTabButtonProps {
  tab: TerminalTab;
  label: string;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function TerminalTabButton({ tab, label, active, onSelect, onClose }: TerminalTabButtonProps) {
  const ended = tab.status === "exited" || tab.status === "failed";
  return (
    <div
      onAuxClick={(e) => {
        if (e.button === 1) onClose();
      }}
      onMouseDown={(e) => {
        if (e.button === 1) e.preventDefault();
      }}
      className={cn(
        "group flex h-6 shrink-0 items-center rounded-md transition-colors duration-fast",
        active ? "bg-elevated text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        tabIndex={active ? 0 : -1}
        data-tab-key={tab.key}
        onClick={onSelect}
        className="flex h-full min-w-0 items-center gap-1.5 rounded-md pr-1 pl-2 text-xs outline-none focus-visible:shadow-halo"
      >
        <SquareTerminal
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            "shrink-0",
            ended ? "text-fg-subtle" : active ? "text-fg" : "text-fg-subtle",
          )}
        />
        <span className={cn("max-w-32 truncate", ended && "text-fg-subtle")}>{label}</span>
        {tab.status === "failed" && (
          <span className="size-1.5 rounded-full bg-danger" aria-hidden />
        )}
        {ended && <span className="sr-only">(sonlandı)</span>}
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${label} kapat`}
        title="Kapat"
        onClick={onClose}
        className={cn(
          "mr-0.5 grid size-5 shrink-0 place-items-center rounded-sm text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg",
          !active && "opacity-0 group-hover:opacity-100",
        )}
      >
        <X size={12} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

import type { PanelImperativeHandle } from "react-resizable-panels";
import { isPaletteOpen } from "@/features/commands/paletteGuard";
import { isNewTerminalShortcut, isToggleTerminalShortcut } from "./keys";
import { useTerminalStore } from "./store";

/** Height the panel opens to when it has no remembered size yet. */
const DEFAULT_OPEN_SIZE = "32%";
const MIN_OPEN_PERCENT = 10;

const isShown = (el: Element | null): el is HTMLElement =>
  el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0;

export interface DockController {
  /** Callback ref for the terminal `Panel`'s imperative handle. */
  setPanel: (handle: PanelImperativeHandle | null) => void;
  /** Callback ref for the element wrapping the terminal UI (focus tracking). */
  setSection: (el: HTMLElement | null) => void;
  /** Expands the panel and focuses the active terminal. */
  show: () => void;
  /** Collapses the panel; focus goes back to where it was before the terminal took it. */
  hide: () => void;
  toggle: () => void;
  /** Window capture-phase keydown handler for Ctrl+` and Ctrl+Shift+`. */
  onKeyDown: (e: KeyboardEvent) => void;
}

/** Imperative open/close and focus hand-off for the terminal panel (one per dock). */
export function createDockController(): DockController {
  let panel: PanelImperativeHandle | null = null;
  let section: HTMLElement | null = null;
  let returnFocus: Element | null = null;

  const hasFocus = () => section?.contains(document.activeElement) ?? false;

  const show = () => {
    const handle = panel;
    if (!handle) return;
    if (!hasFocus()) returnFocus = document.activeElement;
    if (handle.isCollapsed()) handle.expand();
    if (handle.getSize().asPercentage < MIN_OPEN_PERCENT) handle.resize(DEFAULT_OPEN_SIZE);
    useTerminalStore.getState().requestFocus();
  };

  const hide = () => {
    const handle = panel;
    if (!handle || handle.isCollapsed()) return;
    const hadFocus = hasFocus();
    handle.collapse();
    if (!hadFocus) return;
    // Give focus back to where the user came from instead of leaving it on <body>.
    if (isShown(returnFocus)) returnFocus.focus();
    else (document.activeElement as HTMLElement | null)?.blur();
  };

  const toggle = () => {
    if (panel?.isCollapsed()) show();
    else hide();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || isPaletteOpen()) return;
    const toggleKey = isToggleTerminalShortcut(e);
    const newKey = isNewTerminalShortcut(e);
    if (!toggleKey && !newKey) return;
    // Capture phase + stopPropagation: xterm and Monaco never see these keys.
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    if (newKey) {
      const store = useTerminalStore.getState();
      // Opening an empty panel starts a terminal by itself; only add one otherwise.
      if (store.open && store.tabs.length > 0) store.addTab();
      show();
      return;
    }
    // Ctrl+`: open and focus; when open but focus is elsewhere, focus it; else hide.
    if (panel?.isCollapsed() !== false || !hasFocus()) show();
    else hide();
  };

  return {
    setPanel: (handle) => {
      panel = handle;
    },
    setSection: (el) => {
      section = el;
    },
    show,
    hide,
    toggle,
    onKeyDown,
  };
}

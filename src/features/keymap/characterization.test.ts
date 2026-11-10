import { describe, expect, it } from "vitest";
import { isPaletteShortcut, isQuickOpenShortcut } from "@/features/commands/usePaletteShortcut";
import { isFindInFilesShortcut } from "@/features/search/shortcut";
import { isSettingsShortcut } from "@/features/settings/settingsKeys";
import { diffNavigation, isCloseTabShortcut, isSaveShortcut } from "@/features/editor/editorKeys";
import { isNewTerminalShortcut, isToggleTerminalShortcut } from "@/features/terminal/keys";
import { zoomDirection } from "@/app/uiPrefs";
import { CASE_ACTIONS, CASES, type KeyEventLike } from "./characterization.cases";

type Event = KeyboardEvent;
const asEvent = (e: KeyEventLike) => ({ key: "", code: "", ...e }) as unknown as Event;

// The handlers as they are today. Where a handler's condition is inline in a component
// (Layout, ChatPanel, Sidebar, Composer), it is copied here verbatim.
const sidebarView = (e: Event) =>
  e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey ? e.code : null;
const plainMod = (e: Event) => (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;

const TODAY: Record<(typeof CASE_ACTIONS)[number], (e: Event) => boolean> = {
  "palette.open": isPaletteShortcut,
  "workspace.quickOpen": isQuickOpenShortcut,
  "search.findInFiles": isFindInFilesShortcut,
  "chat.new": (e) => plainMod(e) && e.code === "KeyN", // ChatPanel.tsx
  "view.toggleSidebar": (e) => plainMod(e) && e.code === "KeyB", // Layout.tsx
  "view.explorer": (e) => sidebarView(e) === "KeyE", // Sidebar.tsx
  "view.sessions": (e) => sidebarView(e) === "KeyH",
  "view.inbox": (e) => sidebarView(e) === "KeyN",
  "view.changes": (e) => sidebarView(e) === "KeyG",
  "view.toggleTerminal": isToggleTerminalShortcut,
  "terminal.new": isNewTerminalShortcut,
  "editor.save": isSaveShortcut,
  "editor.closeTab": isCloseTabShortcut,
  "settings.open": isSettingsShortcut,
  "view.zoomIn": (e) => zoomDirection(e) === 1,
  "view.zoomOut": (e) => zoomDirection(e) === -1,
  "view.zoomReset": (e) => zoomDirection(e) === 0,
  "diff.next": (e) => diffNavigation(e) === "next",
  "diff.previous": (e) => diffNavigation(e) === "previous",
  "chat.stop": (e) => e.key === "Escape", // Composer.tsx, while a turn runs
};

describe("global shortcuts today", () => {
  for (const { note, event, fires } of CASES) {
    it(`${note} fires ${fires.join(", ") || "nothing"}`, () => {
      const fired = CASE_ACTIONS.filter((id) => TODAY[id](asEvent(event)));
      expect(fired).toEqual(fires);
    });
  }
});

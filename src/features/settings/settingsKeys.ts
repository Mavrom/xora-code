import type { KeyEventLike } from "@/features/keymap/binding";
import { matchesAction } from "@/features/keymap/keymap";

/** Settings (by default Ctrl+, and Cmd+, on macOS). */
export const isSettingsShortcut = (e: KeyEventLike) => matchesAction(e, "settings.open");

/** The sidebar switches (files, conversations, Inbox, Changes) leave the settings view. */
export const isSidebarShortcut = (e: KeyEventLike) =>
  (["view.explorer", "view.sessions", "view.inbox", "view.changes"] as const).some((id) =>
    matchesAction(e, id),
  );

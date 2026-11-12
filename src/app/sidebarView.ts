import { CHANGES_PANEL_ID } from "@/features/git/ChangesPanel";
import { INBOX_COMPOSER_ID } from "@/features/inbox/NoteComposer";
import { closeSettings } from "@/features/settings/viewStore";
import { useUiStore, type SidebarView } from "./uiStore";

/**
 * Where focus lands when a view is opened from the keyboard: the inbox is a capture
 * gesture (its composer), the changes view its panel (Tab moves on into it).
 */
export function focusViewSoon(view: SidebarView) {
  const id = view === "inbox" ? INBOX_COMPOSER_ID : view === "changes" ? CHANGES_PANEL_ID : null;
  if (id) requestAnimationFrame(() => document.getElementById(id)?.focus());
}

/** Opens a sidebar view over whatever is on screen; the Inbox lands in its composer. */
export function showView(next: SidebarView) {
  closeSettings();
  useUiStore.getState().setSidebarView(next);
  if (next === "inbox") focusViewSoon(next);
}

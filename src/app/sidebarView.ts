import { INBOX_COMPOSER_ID } from "@/features/inbox/NoteComposer";
import { closeSettings } from "@/features/settings/viewStore";
import { useUiStore, type SidebarView } from "./uiStore";

/**
 * Where focus lands when a view is opened from the keyboard: the inbox is a capture
 * gesture, so its composer.
 */
export function focusViewSoon(view: SidebarView) {
  if (view === "inbox") {
    requestAnimationFrame(() => document.getElementById(INBOX_COMPOSER_ID)?.focus());
  }
}

/** Opens a sidebar view over whatever is on screen; the Inbox lands in its composer. */
export function showView(next: SidebarView) {
  closeSettings();
  useUiStore.getState().setSidebarView(next);
  if (next === "inbox") focusViewSoon(next);
}

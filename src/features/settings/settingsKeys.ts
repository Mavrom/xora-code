type KeyLike = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

/**
 * Ctrl+, (Cmd+, on macOS). Matches the produced character, not the physical key,
 * so it follows the keyboard layout like the app's other letter shortcuts.
 */
export function isSettingsShortcut(e: KeyLike) {
  return (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === ",";
}

/** Sidebar switches (Ctrl+Shift+E / N) leave the settings view to show that sidebar. */
export function isSidebarShortcut(
  e: Pick<KeyboardEvent, "code" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">,
) {
  return (
    e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.code === "KeyE" || e.code === "KeyN")
  );
}

// Window events for actions that live inside a mounted component (panel refs, local error
// state). The palette emits them; the owning component listens while it is mounted.

export const TOGGLE_EDITOR = "xora:toggle-editor";
export const SAVE_ACTIVE_FILE = "xora:save-active-file";

export type CommandEvent = typeof TOGGLE_EDITOR | typeof SAVE_ACTIVE_FILE;

export const emitCommand = (name: CommandEvent) => window.dispatchEvent(new Event(name));

/** Subscribes to a command event; returns the unsubscribe function (fits `useEffect`). */
export function onCommand(name: CommandEvent, handler: () => void) {
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}

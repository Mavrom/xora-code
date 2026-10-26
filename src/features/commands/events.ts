// Window events for actions that live inside a mounted component (panel refs, local error
// state). The palette emits them; the owning component listens while it is mounted.

export const TOGGLE_EDITOR = "xora:toggle-editor";
export const SAVE_ACTIVE_FILE = "xora:save-active-file";
export const TOGGLE_TERMINAL = "xora:toggle-terminal";
export const OPEN_PALETTE = "xora:open-palette";
/** Back to the welcome composer, focused (sidebar button, Ctrl+N). */
export const NEW_CHAT = "xora:new-chat";
/** Shows or hides the left sidebar (Ctrl+B). */
export const TOGGLE_SIDEBAR = "xora:toggle-sidebar";

export type CommandEvent =
  | typeof TOGGLE_EDITOR
  | typeof SAVE_ACTIVE_FILE
  | typeof TOGGLE_TERMINAL
  | typeof OPEN_PALETTE
  | typeof NEW_CHAT
  | typeof TOGGLE_SIDEBAR;

export const emitCommand = (name: CommandEvent) => window.dispatchEvent(new Event(name));

/** Subscribes to a command event; returns the unsubscribe function (fits `useEffect`). */
export function onCommand(name: CommandEvent, handler: () => void) {
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}

/** Asks the chat to put `text` in its composer (e.g. an Inbox note), ready to send. */
export const CHAT_DRAFT = "xora:chat-draft";

export function sendToChat(text: string) {
  window.dispatchEvent(new CustomEvent<string>(CHAT_DRAFT, { detail: text }));
}

/** Subscribes to chat drafts; returns the unsubscribe function (fits `useEffect`). */
export function onChatDraft(handler: (text: string) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(CHAT_DRAFT, listener);
  return () => window.removeEventListener(CHAT_DRAFT, listener);
}

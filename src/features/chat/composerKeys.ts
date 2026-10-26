import { isImeComposing, type ImeKeyLike } from "@/shared/lib/ime";

export { isImeComposing };

export type ComposerKeyAction = "submit" | "newline" | "none";

interface KeyLike extends ImeKeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/**
 * With `sendKey` "enter" (default) Enter sends and Shift+Enter breaks the line; with
 * "ctrlEnter" Ctrl/Cmd+Enter sends and a plain Enter breaks the line (Settings > Genel).
 * Enter that confirms an IME candidate is left alone.
 */
export function getComposerKeyAction(
  event: KeyLike,
  sendKey: "enter" | "ctrlEnter" = "enter",
): ComposerKeyAction {
  if (event.key !== "Enter" || isImeComposing(event)) return "none";
  if (sendKey === "ctrlEnter") return event.ctrlKey || event.metaKey ? "submit" : "newline";
  return event.shiftKey ? "newline" : "submit";
}

/** A message is sendable once it has visible content and an agent is ready to take it. */
export function canSendMessage(value: string, agentReady: boolean): boolean {
  return agentReady && value.trim().length > 0;
}

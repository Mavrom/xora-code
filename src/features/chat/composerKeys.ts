import { isImeComposing, type ImeKeyLike } from "@/shared/lib/ime";

export { isImeComposing };

export type ComposerKeyAction = "submit" | "newline" | "none";

interface KeyLike extends ImeKeyLike {
  key: string;
  shiftKey: boolean;
}

/** Enter sends, Shift+Enter breaks the line; Enter that confirms an IME candidate is left alone. */
export function getComposerKeyAction(event: KeyLike): ComposerKeyAction {
  if (event.key !== "Enter" || isImeComposing(event)) return "none";
  return event.shiftKey ? "newline" : "submit";
}

/** A message is sendable once it has visible content and an agent is ready to take it. */
export function canSendMessage(value: string, agentReady: boolean): boolean {
  return agentReady && value.trim().length > 0;
}

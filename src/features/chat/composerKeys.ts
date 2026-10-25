export type ComposerKeyAction = "submit" | "newline" | "none";

interface KeyLike {
  key: string;
  shiftKey: boolean;
  /** True while an IME composition is active (e.g. accented or CJK input). */
  isComposing?: boolean;
  /** Legacy `keyCode`; WebKit reports 229 for the Enter that commits an IME candidate. */
  keyCode?: number;
}

/** IME composition in progress, including WebKit's `keyCode` 229 while `isComposing` is false. */
export function isImeComposing(event: Pick<KeyLike, "isComposing" | "keyCode">): boolean {
  return event.isComposing === true || event.keyCode === 229;
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

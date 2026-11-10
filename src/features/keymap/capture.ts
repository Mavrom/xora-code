// Recording a new binding from a key press, and the rules a recorded binding must pass:
// it must not take a key the user types with, a key the system or the editor owns, or (without
// asking) a key another action already uses. Pure, so each rule is tested on its own.
import type { Platform } from "@/shared/ui/keys";
import { ACTIONS, actionDef, type ActionId, type Scope } from "./actions";
import { formatBinding, type Binding, type KeyEventLike } from "./binding";
import { bindingsOf, monacoKeyName, type KeymapOverrides } from "./keymap";
import { t } from "@/shared/i18n";

/** What one key press in capture mode means. */
export type CaptureStep =
  /** A modifier on its own, or a key that cannot be bound: keep listening. */
  | { kind: "wait" }
  | { kind: "cancel" }
  | { kind: "clear" }
  | { kind: "binding"; binding: Binding }
  /** A combination that cannot be used, with the reason shown on the row. */
  | { kind: "refused"; reason: string };

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "AltGraph", "Meta", "OS", "CapsLock"]);

const NAMED_BY_KEY: Record<string, string> = {
  Enter: "enter",
  Escape: "escape",
  Tab: "tab",
  " ": "space",
  Backspace: "backspace",
  Delete: "delete",
  Insert: "insert",
  Home: "home",
  End: "end",
  PageUp: "pageup",
  PageDown: "pagedown",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** The canonical key a press stands for, matched back the way `matches` reads it. */
function keyOf(e: KeyEventLike): string | null {
  const typed = e.key ?? "";
  const code = e.code ?? "";
  if (code === "Backquote") return "`";
  if (typed === "+" || typed === "=" || code === "NumpadAdd") return "plus";
  if (typed === "-" || code === "NumpadSubtract") return "-";
  if (/^[a-z]$/i.test(typed)) return typed.toLowerCase();
  if (/^[0-9]$/.test(typed)) return typed;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^(Digit|Numpad)[0-9]$/.test(code)) return code.slice(-1);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(typed)) return typed.toLowerCase();
  if (typed in NAMED_BY_KEY) return NAMED_BY_KEY[typed];
  if ([...typed].length === 1 && typed.trim() !== "") return typed.toLowerCase();
  return null;
}

const isTypingKey = (key: string) => key !== "plus" && [...key].length === 1;

/**
 * Reads one key press in capture mode. Esc cancels, Backspace or Delete alone clears the
 * binding, a modifier alone keeps listening. On macOS Cmd is `mod` and Control is `ctrl`;
 * elsewhere Ctrl is `mod` and the Windows key is not used.
 */
export function captureStep(e: KeyEventLike, platform: Platform): CaptureStep {
  const typed = e.key ?? "";
  if (MODIFIER_KEYS.has(typed)) return { kind: "wait" };
  const bare = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
  if (bare && typed === "Escape") return { kind: "cancel" };
  if (bare && (typed === "Backspace" || typed === "Delete")) return { kind: "clear" };
  if (platform !== "mac" && e.metaKey) {
    return { kind: "refused", reason: t("The Windows key belongs to the system.") };
  }
  const key = keyOf(e);
  if (!key) return { kind: "wait" };
  // AltGr reports Ctrl+Alt on Windows: a press that typed a character is someone typing.
  if (
    platform !== "mac" &&
    e.ctrlKey &&
    e.altKey &&
    [...typed].length === 1 &&
    typed.toLowerCase() !== key
  ) {
    return {
      kind: "refused",
      reason: t("This combination types a character on your keyboard (AltGr)."),
    };
  }
  const mod = platform === "mac" ? e.metaKey : e.ctrlKey;
  const binding: Binding = {
    mod,
    ctrl: platform === "mac" && e.ctrlKey,
    // + and - ignore Shift when matched (Shift types + on US layouts): leave it out.
    shift: e.shiftKey && key !== "plus" && key !== "-",
    alt: e.altKey,
    key,
  };
  return { kind: "binding", binding };
}

/** `binding` as this platform sees it: off macOS, `ctrl` and `mod` are the same Ctrl key. */
function onPlatform(binding: Binding, platform: Platform): Binding {
  if (platform === "mac") return binding;
  return { ...binding, mod: binding.mod || binding.ctrl, ctrl: false };
}

/** Whether two bindings are the same key press on this platform. */
export const samePress = (a: Binding, b: Binding, platform: Platform) =>
  formatBinding(onPlatform(a, platform)) === formatBinding(onPlatform(b, platform));

/** Combinations that must keep working, or belong to the system, the WebView or the editor. */
const RESERVED: { bindings: string[]; platforms?: Platform[]; reason: string }[] = [
  {
    bindings: ["mod+c", "mod+v", "mod+x", "mod+a", "mod+z", "mod+y", "mod+shift+z"],
    reason: t("Kept for copy, paste, cut, select all, undo and redo."),
  },
  { bindings: ["mod+f"], reason: t("Kept for find in the file.") },
  { bindings: ["mod+shift+i", "mod+shift+j"], reason: t("Opens the WebView's developer tools.") },
  { bindings: ["alt+f4"], platforms: ["other"], reason: t("Closes the window.") },
  { bindings: ["alt+tab", "alt+shift+tab"], platforms: ["other"], reason: t("Switches windows.") },
  {
    bindings: ["mod+q", "mod+h", "mod+m", "mod+tab", "mod+space"],
    platforms: ["mac"],
    reason: t("Belongs to macOS."),
  },
];

const BARE_NAVIGATION = new Set([
  "enter",
  "escape",
  "tab",
  "space",
  "backspace",
  "delete",
  "up",
  "down",
  "left",
  "right",
  "home",
  "end",
  "pageup",
  "pagedown",
]);

/** Why `binding` cannot be given to an action of `scope`, or `null` when it can. */
export function refusal(binding: Binding, scope: Scope, platform: Platform): string | null {
  const commandKey = binding.mod || binding.ctrl;
  if (isTypingKey(binding.key) && !commandKey && !binding.alt) {
    return platform === "mac"
      ? t("Add ⌘, ⌃ or ⌥: a single key would get in the way of typing.")
      : t("Add Ctrl or Alt: a single key would get in the way of typing.");
  }
  if (!commandKey && !binding.alt && BARE_NAVIGATION.has(binding.key)) {
    return t("This key is needed for typing and moving around.");
  }
  // Bare F-keys are fine. On Windows and Linux Ctrl is `mod`: compare in that form.
  const text = formatBinding(onPlatform(binding, platform));
  for (const rule of RESERVED) {
    if (rule.platforms && !rule.platforms.includes(platform)) continue;
    if (rule.bindings.includes(text)) return rule.reason;
  }
  if (scope === "editor" && monacoKeyName(binding.key) === null) {
    return t("The editor cannot use this key.");
  }
  return null;
}

/** The set of (Ctrl, Cmd) states a binding accepts, as two-bit numbers (Ctrl = 1, Cmd = 2). */
function commandStates(b: Binding, platform: Platform): number[] {
  if (b.mod && b.ctrl) return platform === "mac" ? [3] : [1, 3];
  if (b.mod) return [1, 2, 3];
  if (b.ctrl) return [1];
  return [0];
}

const SHIFT_AGNOSTIC = new Set(["plus", "-"]);

/** Whether some key press would match both bindings. */
export function overlaps(a: Binding, b: Binding, platform: Platform): boolean {
  if (a.key !== b.key || a.alt !== b.alt) return false;
  if (!SHIFT_AGNOSTIC.has(a.key) && a.shift !== b.shift) return false;
  const states = commandStates(b, platform);
  return commandStates(a, platform).some((s) => states.includes(s));
}

/** Global actions listen everywhere; the editor's and the composer's do not meet. */
export const scopesOverlap = (a: Scope, b: Scope) => a === "global" || b === "global" || a === b;

/** The other action that already answers to `binding` where `id` would, if any. */
export function findConflict(
  id: ActionId,
  binding: Binding,
  overrides: KeymapOverrides,
  platform: Platform,
): ActionId | null {
  const scope = actionDef(id).scope;
  for (const other of ACTIONS) {
    if (other.id === id || !scopesOverlap(scope, other.scope)) continue;
    if (bindingsOf(other.id, overrides).some((b) => overlaps(binding, b, platform))) {
      return other.id;
    }
  }
  return null;
}

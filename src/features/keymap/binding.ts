// A key binding in its portable, canonical text form ("mod+shift+g") and how a key event
// is matched against it. Pure: no DOM, no store.
import type { Platform } from "@/shared/ui/keys";

/**
 * One key combination. `mod` is the platform's command key: shown as Ctrl on Windows and
 * Linux and as ⌘ on macOS, and matched by either Ctrl or Cmd (as the app always did).
 * `ctrl` is the Control key only, Cmd not accepted (Ctrl+` on macOS, like VS Code).
 */
export interface Binding {
  mod: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  /** Canonical key name, see {@link parseBinding}. */
  key: string;
}

/** The parts of a key event the matcher reads (DOM and React events both fit). */
export interface KeyEventLike {
  key?: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Named keys and the `KeyboardEvent.key` they match. */
const NAMED: Record<string, string> = {
  enter: "Enter",
  escape: "Escape",
  tab: "Tab",
  space: " ",
  backspace: "Backspace",
  delete: "Delete",
  insert: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  return: "enter",
  del: "delete",
  spacebar: "space",
  pgup: "pageup",
  pgdn: "pagedown",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  "=": "plus",
};

const MODIFIERS: Record<string, keyof Omit<Binding, "key">> = {
  mod: "mod",
  cmd: "mod",
  command: "mod",
  meta: "mod",
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  shift: "shift",
};

const isLetter = (key: string) => /^[a-z]$/.test(key);
const isDigit = (key: string) => /^[0-9]$/.test(key);
const isFunctionKey = (key: string) => /^f([1-9]|1[0-9]|2[0-4])$/.test(key);

/** A key name `parseBinding` accepts, already lowercased and de-aliased. */
function canonicalKey(raw: string): string | null {
  const key = KEY_ALIASES[raw] ?? raw;
  if (key === "plus" || key in NAMED || isFunctionKey(key)) return key;
  // Any other single printable character: letters, digits, punctuation, a layout's own
  // letters (ş, ç, ö …).
  if ([...key].length === 1 && key.trim() !== "" && !(key in MODIFIERS)) return key;
  return null;
}

/**
 * Reads a binding such as `"mod+shift+g"`, `"ctrl+`"`, `"alt+f5"`, `"mod++"` or
 * `"mod+plus"`. Modifier names: `mod` (also `cmd`, `meta`), `ctrl`, `alt` (`option`),
 * `shift`. Returns `null` for anything that is not exactly one key with modifiers.
 */
export function parseBinding(text: string): Binding | null {
  let source = text.trim().toLowerCase();
  if (source === "+") source = "plus";
  else if (source.endsWith("++")) source = `${source.slice(0, -2)}+plus`;
  const parts = source.split("+").map((p) => p.trim());
  const binding: Binding = { mod: false, ctrl: false, shift: false, alt: false, key: "" };
  for (const [index, part] of parts.entries()) {
    const last = index === parts.length - 1;
    const modifier = MODIFIERS[part];
    if (!last) {
      if (!modifier) return null;
      binding[modifier] = true;
      continue;
    }
    const key = canonicalKey(part);
    if (!key) return null;
    binding.key = key;
  }
  return binding.key ? binding : null;
}

/** Canonical text: modifiers in the order mod, ctrl, shift, alt, then the key. */
export function formatBinding(binding: Binding): string {
  const parts: string[] = [];
  if (binding.mod) parts.push("mod");
  if (binding.ctrl) parts.push("ctrl");
  if (binding.shift) parts.push("shift");
  if (binding.alt) parts.push("alt");
  parts.push(binding.key);
  return parts.join("+");
}

/** `"Ctrl+Shift+G"`-style canonical text of `text`, or `null` when it does not parse. */
export function normalizeBinding(text: string): string | null {
  const binding = parseBinding(text);
  return binding ? formatBinding(binding) : null;
}

/**
 * Keys typed with Shift on some layouts and without it on others (`+` is Shift+= on US
 * and unshifted on Turkish Q): Shift is not compared for them.
 */
const SHIFT_AGNOSTIC = new Set(["plus", "-"]);

function modifiersMatch(e: KeyEventLike, b: Binding, platform: Platform): boolean {
  if (!!e.altKey !== b.alt) return false;
  if (!SHIFT_AGNOSTIC.has(b.key) && !!e.shiftKey !== b.shift) return false;
  if (b.mod && b.ctrl) return platform === "mac" ? e.metaKey && e.ctrlKey : e.ctrlKey;
  if (b.mod) return e.ctrlKey || e.metaKey;
  if (b.ctrl) return e.ctrlKey && !e.metaKey;
  return !e.ctrlKey && !e.metaKey;
}

/**
 * How letters are recognised. `char`: the character typed (`KeyboardEvent.key`), so the
 * shortcut follows the keyboard layout. `code`: the physical key (`KeyboardEvent.code`).
 */
export type LetterMatch = "char" | "code";

function keyMatches(e: KeyEventLike, key: string, letters: LetterMatch): boolean {
  const typed = e.key ?? "";
  if (isLetter(key)) {
    return letters === "char" ? typed.toLowerCase() === key : e.code === `Key${key.toUpperCase()}`;
  }
  if (isDigit(key)) return typed === key || e.code === `Numpad${key}`;
  // The physical key left of 1: it types `"` on Turkish Q, so the character cannot be used.
  if (key === "`") return e.code === "Backquote";
  if (key === "plus") return typed === "+" || typed === "=" || e.code === "NumpadAdd";
  if (key === "-") return typed === "-" || e.code === "NumpadSubtract";
  if (key in NAMED) return typed === NAMED[key];
  if (isFunctionKey(key)) return typed === key.toUpperCase();
  return typed.toLowerCase() === key;
}

/** Whether a key event is this binding on `platform`. */
export function matches(
  e: KeyEventLike,
  binding: Binding,
  platform: Platform,
  letters: LetterMatch = "code",
): boolean {
  return modifiersMatch(e, binding, platform) && keyMatches(e, binding.key, letters);
}

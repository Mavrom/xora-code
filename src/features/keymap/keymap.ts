// The effective keymap: each action's default bindings, overlaid with the user's overrides,
// and the questions handlers ask it ("is this event action X?", "which action is this?").
import { create } from "zustand";
import { detectPlatform, type Platform } from "@/shared/ui/keys";
import { ACTIONS, bindableIds, isBindable, type ActionId, type BindableId } from "./actions";
import { formatBinding, matches, parseBinding, type Binding, type KeyEventLike } from "./binding";

export const PLATFORM: Platform = detectPlatform(
  typeof navigator === "undefined" ? undefined : navigator,
);

/** User overrides by action id: a binding in canonical form, or `null` for unbound. */
export type KeymapOverrides = Partial<Record<BindableId, string | null>>;

interface KeymapState {
  overrides: KeymapOverrides;
}

export const useKeymap = create<KeymapState>(() => ({ overrides: {} }));

export function setKeymapOverrides(overrides: KeymapOverrides) {
  useKeymap.setState({ overrides });
}

const DEFAULTS = new Map<BindableId, Binding[]>(
  ACTIONS.map((a) => [a.id, a.defaults.map((d) => parseBinding(d) as Binding)]),
);

/** The default bindings of an action (none for a palette command). */
export const defaultBindings = (id: BindableId): Binding[] => DEFAULTS.get(id) ?? [];

/** The bindings in effect for an action (none when the user unbound it). */
export function bindingsOf(
  id: BindableId,
  overrides: KeymapOverrides = useKeymap.getState().overrides,
): Binding[] {
  if (Object.prototype.hasOwnProperty.call(overrides, id)) {
    const value = overrides[id];
    if (value === null) return [];
    const parsed = value === undefined ? null : parseBinding(value);
    if (parsed) return [parsed];
  }
  return defaultBindings(id);
}

/** Whether `e` is any bindable action `id` (a palette command included). */
export function matchesBindable(
  e: KeyEventLike,
  id: BindableId,
  platform: Platform = PLATFORM,
  overrides: KeymapOverrides = useKeymap.getState().overrides,
): boolean {
  return bindingsOf(id, overrides).some((b) => matches(e, b, platform));
}

/** Whether `e` is action `id` under the effective keymap (for the dedicated handlers). */
export const matchesAction = (
  e: KeyEventLike,
  id: ActionId,
  platform: Platform = PLATFORM,
  overrides: KeymapOverrides = useKeymap.getState().overrides,
): boolean => matchesBindable(e, id, platform, overrides);

/**
 * The action a key event stands for, if any: `ACTIONS` first, then the registered palette
 * commands (conflict checks keep two from sharing a binding).
 */
export function resolve(
  e: KeyEventLike,
  platform: Platform = PLATFORM,
  overrides: KeymapOverrides = useKeymap.getState().overrides,
): BindableId | null {
  return bindableIds().find((id) => matchesBindable(e, id, platform, overrides)) ?? null;
}

/** The bindings of an action in canonical text form, for `Kbd` (first is the main one). */
export const shortcutsOf = (
  id: BindableId,
  overrides: KeymapOverrides = useKeymap.getState().overrides,
): string[] => bindingsOf(id, overrides).map(formatBinding);

/** The main binding of an action in canonical form, or `undefined` when unbound. */
export const shortcutOf = (
  id: BindableId,
  overrides: KeymapOverrides = useKeymap.getState().overrides,
): string | undefined => shortcutsOf(id, overrides)[0];

/** {@link shortcutOf}, re-rendering when the keymap changes. */
export function useShortcut(id: ActionId): string | undefined {
  return useKeymap((s) => shortcutOf(id, s.overrides));
}

/** The main binding of a command palette entry, for ids that are keymap actions. */
export function useCommandShortcut(id: string): string | undefined {
  return useKeymap((s) => (isBindable(id) ? shortcutOf(id, s.overrides) : undefined));
}

/** The parts of Monaco's API a keybinding needs (`monaco.KeyMod`, `monaco.KeyCode`). */
export interface MonacoKeys {
  KeyMod: { CtrlCmd: number; Shift: number; Alt: number; WinCtrl: number };
  KeyCode: object;
}

const MONACO_KEY_NAMES: Record<string, string> = {
  "`": "Backquote",
  ",": "Comma",
  ".": "Period",
  ";": "Semicolon",
  "/": "Slash",
  "\\": "Backslash",
  "[": "BracketLeft",
  "]": "BracketRight",
  "'": "Quote",
  "-": "Minus",
  plus: "Equal",
  enter: "Enter",
  escape: "Escape",
  tab: "Tab",
  space: "Space",
  backspace: "Backspace",
  delete: "Delete",
  insert: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  up: "UpArrow",
  down: "DownArrow",
  left: "LeftArrow",
  right: "RightArrow",
};

/** Monaco's name for a key (`KeyCode[name]`), or `null` when Monaco has no such key. */
export function monacoKeyName(key: string): string | null {
  if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  if (/^f([1-9]|1[0-9])$/.test(key)) return key.toUpperCase();
  return MONACO_KEY_NAMES[key] ?? null;
}

/**
 * A binding as a Monaco keybinding number, or `null` when Monaco cannot express it.
 * `mod` is Monaco's CtrlCmd; `ctrl` is Ctrl on Windows and Linux, WinCtrl (Control) on macOS.
 */
export function monacoKeybinding(
  binding: Binding,
  monaco: MonacoKeys,
  platform: Platform = PLATFORM,
): number | null {
  const name = monacoKeyName(binding.key);
  const code = name === null ? undefined : (monaco.KeyCode as Record<string, unknown>)[name];
  if (typeof code !== "number") return null;
  let value = code;
  if (binding.mod) value |= monaco.KeyMod.CtrlCmd;
  if (binding.ctrl) value |= platform === "mac" ? monaco.KeyMod.WinCtrl : monaco.KeyMod.CtrlCmd;
  if (binding.shift) value |= monaco.KeyMod.Shift;
  if (binding.alt) value |= monaco.KeyMod.Alt;
  return value;
}

/** The Monaco keybindings of an action under the effective keymap. */
export function monacoKeybindings(id: ActionId, monaco: MonacoKeys): number[] {
  return bindingsOf(id)
    .map((b) => monacoKeybinding(b, monaco))
    .filter((k): k is number => k !== null);
}

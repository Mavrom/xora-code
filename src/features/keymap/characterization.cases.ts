// Characterization of the app's global shortcuts: which key events fire which action.
// Written against the hand-written predicates before the keymap existed, so the keymap
// can be checked to fire exactly the same actions for the same events.

export interface KeyEventLike {
  key?: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface ShortcutCase {
  /** What the case stands for, shown in the test name. */
  note: string;
  event: KeyEventLike;
  /** Every action the event fires; empty for a near-miss. */
  fires: string[];
}

/** `ev("ctrl+shift", "G", "KeyG")`. */
export function ev(mods: string, key: string | undefined, code: string | undefined): KeyEventLike {
  const has = (m: string) => mods.split("+").includes(m);
  return {
    key,
    code,
    ctrlKey: has("ctrl"),
    metaKey: has("meta"),
    shiftKey: has("shift"),
    altKey: has("alt"),
  };
}

const c = (
  note: string,
  mods: string,
  key: string | undefined,
  code: string | undefined,
  fires: string[] = [],
): ShortcutCase => ({ note, event: ev(mods, key, code), fires });

export const CASES: ShortcutCase[] = [
  // Command palette: Ctrl/Cmd+K, Ctrl/Cmd+Shift+P.
  c("Ctrl+K", "ctrl", "k", "KeyK", ["palette.open"]),
  c("Cmd+K", "meta", "k", "KeyK", ["palette.open"]),
  c("Ctrl+Cmd+K", "ctrl+meta", "k", "KeyK", ["palette.open"]),
  c("Ctrl+K with Caps Lock", "ctrl", "K", "KeyK", ["palette.open"]),
  c("Ctrl+Shift+P", "ctrl+shift", "P", "KeyP", ["palette.open"]),
  c("Cmd+Shift+P", "meta+shift", "P", "KeyP", ["palette.open"]),
  c("bare K", "", "k", "KeyK"),
  c("Ctrl+Shift+K", "ctrl+shift", "K", "KeyK"),
  c("AltGr+K (Ctrl+Alt)", "ctrl+alt", "k", "KeyK"),
  c("Ctrl+Alt+Shift+P", "ctrl+alt+shift", "P", "KeyP"),

  // Go to file: Ctrl/Cmd+P.
  c("Ctrl+P", "ctrl", "p", "KeyP", ["workspace.quickOpen"]),
  c("Cmd+P", "meta", "p", "KeyP", ["workspace.quickOpen"]),
  c("AltGr+P", "ctrl+alt", "p", "KeyP"),

  // Find in files: Ctrl/Cmd+Shift+F, physical key.
  c("Ctrl+Shift+F", "ctrl+shift", "F", "KeyF", ["search.findInFiles"]),
  c("Cmd+Shift+F", "meta+shift", "F", "KeyF", ["search.findInFiles"]),
  c("Ctrl+F (find in file, Monaco)", "ctrl", "f", "KeyF"),
  c("AltGr+Shift+F", "ctrl+alt+shift", "F", "KeyF"),
  c("Cmd+Option+Shift+F", "meta+alt+shift", "F", "KeyF"),

  // New chat: Ctrl/Cmd+N, physical key.
  c("Ctrl+N", "ctrl", "n", "KeyN", ["chat.new"]),
  c("Cmd+N", "meta", "n", "KeyN", ["chat.new"]),
  c("AltGr+N", "ctrl+alt", "n", "KeyN"),

  // Toggle sidebar: Ctrl/Cmd+B, physical key.
  c("Ctrl+B", "ctrl", "b", "KeyB", ["view.toggleSidebar"]),
  c("Cmd+B", "meta", "b", "KeyB", ["view.toggleSidebar"]),
  c("Ctrl+Shift+B", "ctrl+shift", "B", "KeyB"),
  c("AltGr+B", "ctrl+alt", "b", "KeyB"),

  // Sidebar views: Control+Shift+E/H/N/G only (Cmd does not count, on macOS either).
  c("Ctrl+Shift+E", "ctrl+shift", "E", "KeyE", ["view.explorer"]),
  c("Ctrl+Shift+H", "ctrl+shift", "H", "KeyH", ["view.sessions"]),
  c("Ctrl+Shift+N", "ctrl+shift", "N", "KeyN", ["view.inbox"]),
  c("Ctrl+Shift+G", "ctrl+shift", "G", "KeyG", ["view.changes"]),
  c("Cmd+Shift+G", "meta+shift", "G", "KeyG"),
  c("Cmd+Shift+E", "meta+shift", "E", "KeyE"),
  c("Ctrl+Cmd+Shift+G", "ctrl+meta+shift", "G", "KeyG"),
  c("AltGr+Shift+G", "ctrl+alt+shift", "G", "KeyG"),
  c("Ctrl+E", "ctrl", "e", "KeyE"),
  c("Ctrl+G", "ctrl", "g", "KeyG"),
  c("Ctrl+H", "ctrl", "h", "KeyH"),

  // Terminal: Control+` (Control on macOS too), physical key.
  c("Ctrl+`", "ctrl", "`", "Backquote", ["view.toggleTerminal"]),
  c('Ctrl+` on Turkish Q (types ")', "ctrl", '"', "Backquote", ["view.toggleTerminal"]),
  c("Cmd+`", "meta", "`", "Backquote"),
  c("Ctrl+Shift+`", "ctrl+shift", "~", "Backquote", ["terminal.new"]),
  c("Ctrl+Shift+` on Turkish Q", "ctrl+shift", "é", "Backquote", ["terminal.new"]),
  c("Cmd+Shift+`", "meta+shift", "~", "Backquote"),
  c("AltGr+`", "ctrl+alt", "`", "Backquote"),
  c("bare `", "", "`", "Backquote"),

  // Save and close tab: Ctrl/Cmd+S, Ctrl/Cmd+W.
  c("Ctrl+S", "ctrl", "s", "KeyS", ["editor.save"]),
  c("Cmd+S", "meta", "S", "KeyS", ["editor.save"]),
  c("Ctrl+Shift+S", "ctrl+shift", "S", "KeyS"),
  c("AltGr+S", "ctrl+alt", "s", "KeyS"),
  c("bare S", "", "s", "KeyS"),
  c("Ctrl+W", "ctrl", "w", "KeyW", ["editor.closeTab"]),
  c("Cmd+W", "meta", "W", "KeyW", ["editor.closeTab"]),
  c("Ctrl+Shift+W", "ctrl+shift", "W", "KeyW"),
  c("AltGr+W", "ctrl+alt", "w", "KeyW"),

  // Settings: Ctrl/Cmd+, (the produced character).
  c("Ctrl+,", "ctrl", ",", "Comma", ["settings.open"]),
  c("Cmd+,", "meta", ",", "Comma", ["settings.open"]),
  c("Ctrl+Shift+,", "ctrl+shift", "<", "Comma"),
  c("AltGr+,", "ctrl+alt", ",", "Comma"),
  c("Ctrl+.", "ctrl", ".", "Period"),

  // Interface scale: Ctrl/Cmd + / - / 0; Shift does not matter for + and -.
  c("Ctrl+=", "ctrl", "=", "Equal", ["view.zoomIn"]),
  c("Ctrl+Shift+= (types +)", "ctrl+shift", "+", "Equal", ["view.zoomIn"]),
  c("Ctrl+numpad +", "ctrl", "+", "NumpadAdd", ["view.zoomIn"]),
  c("Cmd+=", "meta", "=", "Equal", ["view.zoomIn"]),
  c("Ctrl+Shift+4 on Turkish Q (types +)", "ctrl+shift", "+", "Digit4", ["view.zoomIn"]),
  c("Ctrl+Shift+0 on Turkish Q (types =)", "ctrl+shift", "=", "Digit0", ["view.zoomIn"]),
  c("Ctrl+-", "ctrl", "-", "Minus", ["view.zoomOut"]),
  c("Ctrl+- on Turkish Q", "ctrl", "-", "Equal", ["view.zoomOut"]),
  c("Ctrl+numpad -", "ctrl", "-", "NumpadSubtract", ["view.zoomOut"]),
  c("Ctrl+0", "ctrl", "0", "Digit0", ["view.zoomReset"]),
  c("Ctrl+numpad 0", "ctrl", "0", "Numpad0", ["view.zoomReset"]),
  c("Ctrl+numpad 0 without Num Lock", "ctrl", "Insert", "Numpad0", ["view.zoomReset"]),
  c("Ctrl+Shift+0 on US (types ))", "ctrl+shift", ")", "Digit0"),
  c("Ctrl+Shift+- on US (types _)", "ctrl+shift", "_", "Minus"),
  c("AltGr++", "ctrl+alt", "+", "Equal"),
  c("bare +", "", "+", "Equal"),

  // Diff tab: Alt+F5 / Shift+Alt+F5.
  c("Alt+F5", "alt", "F5", "F5", ["diff.next"]),
  c("Shift+Alt+F5", "shift+alt", "F5", "F5", ["diff.previous"]),
  c("bare F5", "", "F5", "F5"),
  c("Ctrl+Alt+F5", "ctrl+alt", "F5", "F5"),
  c("Cmd+Option+F5", "meta+alt", "F5", "F5"),
  c("Alt+F7 (Monaco's accessible diff viewer)", "alt", "F7", "F7"),

  // Stop the running turn: Esc in the composer.
  c("Esc", "", "Escape", "Escape", ["chat.stop"]),

  // Keys none of them take.
  c("Ctrl+A", "ctrl", "a", "KeyA"),
  c("Ctrl+V", "ctrl", "v", "KeyV"),
  c("ArrowDown", "", "ArrowDown", "ArrowDown"),
];

/** Every action the cases cover. */
export const CASE_ACTIONS = [
  "palette.open",
  "workspace.quickOpen",
  "search.findInFiles",
  "chat.new",
  "view.toggleSidebar",
  "view.explorer",
  "view.sessions",
  "view.inbox",
  "view.changes",
  "view.toggleTerminal",
  "terminal.new",
  "editor.save",
  "editor.closeTab",
  "settings.open",
  "view.zoomIn",
  "view.zoomOut",
  "view.zoomReset",
  "diff.next",
  "diff.previous",
  "chat.stop",
] as const;

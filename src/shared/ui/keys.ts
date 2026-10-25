export type Platform = "mac" | "other";

/** One rendered key cap: the visible glyph and the name a screen reader should hear. */
export interface KeyCap {
  label: string;
  name: string;
}

interface NavigatorLike {
  platform?: string;
  userAgent?: string;
}

/** macOS (and iPadOS with a keyboard) use ⌘-style glyphs; everything else spells keys out. */
export function detectPlatform(nav?: NavigatorLike): Platform {
  const source = `${nav?.platform ?? ""} ${nav?.userAgent ?? ""}`.toLowerCase();
  return /mac|iphone|ipad|ipod/.test(source) ? "mac" : "other";
}

type KeyTable = Record<string, KeyCap>;

const MAC: KeyTable = {
  mod: { label: "⌘", name: "Command" },
  cmd: { label: "⌘", name: "Command" },
  meta: { label: "⌘", name: "Command" },
  ctrl: { label: "⌃", name: "Control" },
  alt: { label: "⌥", name: "Option" },
  option: { label: "⌥", name: "Option" },
  shift: { label: "⇧", name: "Shift" },
  enter: { label: "↵", name: "Return" },
  backspace: { label: "⌫", name: "Delete" },
  tab: { label: "⇥", name: "Tab" },
};

const OTHER: KeyTable = {
  mod: { label: "Ctrl", name: "Ctrl" },
  cmd: { label: "Ctrl", name: "Ctrl" },
  meta: { label: "Win", name: "Windows" },
  ctrl: { label: "Ctrl", name: "Ctrl" },
  alt: { label: "Alt", name: "Alt" },
  option: { label: "Alt", name: "Alt" },
  shift: { label: "Shift", name: "Shift" },
  enter: { label: "Enter", name: "Enter" },
  backspace: { label: "Backspace", name: "Backspace" },
  tab: { label: "Tab", name: "Tab" },
};

const SHARED: KeyTable = {
  esc: { label: "Esc", name: "Escape" },
  escape: { label: "Esc", name: "Escape" },
  space: { label: "Space", name: "Space" },
  up: { label: "↑", name: "Up" },
  down: { label: "↓", name: "Down" },
  left: { label: "←", name: "Left" },
  right: { label: "→", name: "Right" },
  plus: { label: "+", name: "Plus" },
};

/**
 * Turns a shortcut such as `"mod+shift+k"` into key caps for the given platform:
 * `⌘ ⇧ K` on macOS, `Ctrl Shift K` elsewhere. Write a literal plus as `plus`.
 */
export function formatShortcut(shortcut: string, platform: Platform): KeyCap[] {
  const table = platform === "mac" ? MAC : OTHER;
  return shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const key = part.toLowerCase();
      const known = table[key] ?? SHARED[key];
      if (known) return known;
      const label = part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
      return { label, name: label };
    });
}

/** Spoken form of a shortcut, e.g. "Ctrl+Shift+K" or "Command+K". */
export function describeShortcut(shortcut: string, platform: Platform): string {
  return formatShortcut(shortcut, platform)
    .map((cap) => cap.name)
    .join("+");
}

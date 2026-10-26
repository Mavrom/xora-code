import type { ITheme } from "@xterm/xterm";

/** The design tokens the terminal theme is built from (see `src/styles/globals.css`). */
export interface ThemeTokens {
  bg: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  borderStrong: string;
  danger: string;
  warning: string;
  accent: string;
  /**
   * Optional translucent surface for a glass/wallpaper look (`--glass`, any CSS colour incl.
   * rgba). When set it becomes the terminal background; xterm runs with `allowTransparency`.
   */
  glass?: string;
}

/** Fallbacks matching globals.css, used when a CSS variable is missing (tests, old builds). */
export const DEFAULT_TOKENS: ThemeTokens = {
  bg: "#000000",
  fg: "#ededed",
  fgMuted: "#a1a1a1",
  fgSubtle: "#7e7e7e",
  borderStrong: "#2a2a2a",
  danger: "#f87171",
  warning: "#e5b567",
  accent: "#ffffff",
};

const TOKEN_VARS: Record<keyof ThemeTokens, string> = {
  glass: "--glass",
  bg: "--color-bg",
  fg: "--color-fg",
  fgMuted: "--color-fg-muted",
  fgSubtle: "--color-fg-subtle",
  borderStrong: "--color-border-strong",
  danger: "--color-danger",
  warning: "--color-warning",
  accent: "--color-accent",
};

/** Reads the tokens through `read` (a CSS variable lookup), falling back per token. */
export function readTokens(read: (cssVar: string) => string | undefined): ThemeTokens {
  const out = { ...DEFAULT_TOKENS };
  for (const key of Object.keys(TOKEN_VARS) as Array<keyof ThemeTokens>) {
    const value = read(TOKEN_VARS[key])?.trim();
    if (value) out[key] = value;
  }
  return out;
}

/** `#rrggbb` plus an alpha in 0..1 as `#rrggbbaa`; other formats pass through unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, "0")}`;
}

/**
 * Onyx terminal theme: true black, the UI's greys for text, and a muted ANSI palette
 * (the same calm hues as the editor's syntax colours) so tool output never shouts.
 * Black maps to a visible grey because ANSI black on a black background would vanish.
 */
export function buildTerminalTheme(t: ThemeTokens): ITheme {
  return {
    background: t.glass ?? t.bg,
    foreground: t.fg,
    cursor: t.fg,
    cursorAccent: t.bg,
    selectionBackground: withAlpha(t.fg, 0.22),
    selectionInactiveBackground: withAlpha(t.fg, 0.12),
    scrollbarSliderBackground: withAlpha(t.fg, 0.1),
    scrollbarSliderHoverBackground: withAlpha(t.fg, 0.18),
    scrollbarSliderActiveBackground: withAlpha(t.fg, 0.24),

    black: t.borderStrong,
    red: t.danger,
    green: "#a5c9a1",
    yellow: t.warning,
    blue: "#9fb8d6",
    magenta: "#c3b1d4",
    cyan: "#a3c7c4",
    white: t.fgMuted,

    brightBlack: t.fgSubtle,
    brightRed: "#fca5a5",
    brightGreen: "#c2dcbf",
    brightYellow: "#f0cf94",
    brightBlue: "#bfd0e4",
    brightMagenta: "#d8cae5",
    brightCyan: "#c1dbd8",
    brightWhite: t.accent,
  };
}

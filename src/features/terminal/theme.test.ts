import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/shared/lib/contrast";
import { buildTerminalTheme, DEFAULT_TOKENS, readTokens, withAlpha } from "./theme";

describe("readTokens", () => {
  it("uses CSS variables and falls back per token", () => {
    const tokens = readTokens((v) =>
      v === "--color-bg" ? " #010101 " : v === "--color-fg" ? "" : undefined,
    );
    expect(tokens.bg).toBe("#010101");
    expect(tokens.fg).toBe(DEFAULT_TOKENS.fg);
    expect(tokens.danger).toBe(DEFAULT_TOKENS.danger);
  });
});

describe("withAlpha", () => {
  it("appends a hex alpha", () => {
    expect(withAlpha("#ededed", 0.22)).toBe("#ededed38");
    expect(withAlpha("#000000", 2)).toBe("#000000ff");
  });

  it("passes other formats through", () => {
    expect(withAlpha("rgb(1 2 3)", 0.5)).toBe("rgb(1 2 3)");
  });
});

describe("buildTerminalTheme", () => {
  const theme = buildTerminalTheme(DEFAULT_TOKENS);

  it("maps the surface tokens", () => {
    expect(theme.background).toBe("#000000");
    expect(theme.foreground).toBe("#ededed");
    expect(theme.cursor).toBe("#ededed");
    expect(theme.brightWhite).toBe("#ffffff");
  });

  it("keeps every ANSI colour except black readable on the background", () => {
    const keys = [
      "red",
      "green",
      "yellow",
      "blue",
      "magenta",
      "cyan",
      "white",
      "brightBlack",
      "brightRed",
      "brightGreen",
      "brightYellow",
      "brightBlue",
      "brightMagenta",
      "brightCyan",
      "brightWhite",
    ] as const;
    for (const key of keys) {
      expect(contrastRatio(theme[key]!, theme.background!), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses the optional glass colour as a translucent background", () => {
    const glass = buildTerminalTheme({ ...DEFAULT_TOKENS, glass: "rgba(0, 0, 0, 0.55)" });
    expect(glass.background).toBe("rgba(0, 0, 0, 0.55)");
    expect(glass.cursorAccent).toBe(DEFAULT_TOKENS.bg);
    expect(readTokens(() => undefined).glass).toBeUndefined();
  });

  it("never renders ANSI black invisibly", () => {
    expect(theme.black).not.toBe(theme.background);
  });
});

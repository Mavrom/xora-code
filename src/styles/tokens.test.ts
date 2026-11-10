import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.|\.d\.ts$/.test(entry.name) ? [path] : [];
  });
}

/**
 * Colours that live in code on purpose: the Monaco and xterm themes (they take literal
 * colours), each agent's identity colour, the window's black base and the canvas fill.
 */
const OWN_COLOURS = [
  join("features", "editor", "monaco", "theme.ts"),
  join("features", "terminal", "theme.ts"),
  join("features", "chat", "agentTint.ts"),
  join("app", "windowLook.ts"),
  join("features", "backdrop", "effects.ts"),
];

const RAW_COLOUR =
  /#[0-9a-fA-F]{3,8}\b|-(?:red|emerald|amber|green|blue|yellow|orange|rose|sky)-\d/;

describe("design tokens", () => {
  it("are the only colours components use", () => {
    const offenders = sources(SRC)
      .filter((file) => !OWN_COLOURS.some((own) => file.endsWith(own)))
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .split("\n")
          .map((line) => line.replace(/(^|\s)\/\/.*$/, ""))
          .filter((line) => RAW_COLOUR.test(line))
          .map((line) => `${file.slice(SRC.length + 1)}: ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});

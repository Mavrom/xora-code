/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./contrast";

// Read from disk: Vitest stubs CSS imports (even `?raw`) to an empty module.
const globalsCss = readFileSync(new URL("../../styles/globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{3,6})\\b`, "i").exec(globalsCss);
  if (!match) throw new Error(`Token --color-${name} not found`);
  return match[1];
}

describe("contrastRatio", () => {
  it("matches the WCAG reference points", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777", "#777")).toBe(1);
    expect(relativeLuminance("#fff")).toBe(1);
  });

  it("rejects malformed colours", () => {
    expect(() => relativeLuminance("#12")).toThrow();
  });
});

describe("colour tokens", () => {
  // Placeholder and meta text use fg-subtle on these backgrounds; keep it at AA (4.5:1).
  it.each(["bg", "surface", "elevated"])("fg-subtle reads at 4.5:1 on %s", (background) => {
    expect(contrastRatio(token("fg-subtle"), token(background))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps fg-muted clearly above fg-subtle", () => {
    const bg = token("elevated");
    expect(contrastRatio(token("fg-muted"), bg)).toBeGreaterThan(
      contrastRatio(token("fg-subtle"), bg) + 2,
    );
  });
});

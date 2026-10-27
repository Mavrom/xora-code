import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { systemLanguage, translate } from ".";
import { TR } from "./tr";

const SRC = join(__dirname, "..", "..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.|\.d\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** Every literal first argument of t() / msg() in the source. */
function messageIds(): Set<string> {
  const ids = new Set<string>();
  const call = /(?<![\w.])(?:t|msg)\(\s*(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)')/g;
  for (const file of sources(SRC)) {
    if (file.includes("i18n")) continue;
    for (const match of readFileSync(file, "utf8").matchAll(call)) {
      // Prettier picks single quotes when the message holds double ones.
      const body = match[1] ?? match[2].replace(/\\'/g, "'").replace(/"/g, '\\"');
      ids.add(JSON.parse(`"${body}"`) as string);
    }
  }
  return ids;
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");

describe("Turkish catalog", () => {
  const ids = messageIds();

  it("covers every message in the source", () => {
    expect([...ids].filter((id) => !(id in TR))).toEqual([]);
  });

  it("has no entries the source no longer uses", () => {
    expect(Object.keys(TR).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("keeps each message's placeholders", () => {
    const broken = Object.entries(TR).filter(([en, tr]) => placeholders(en) !== placeholders(tr));
    expect(broken).toEqual([]);
  });
});

describe("translate", () => {
  it("fills placeholders in either language and falls back to the English", () => {
    expect(translate("en", "Continue with {name}", { name: "Codex" })).toBe("Continue with Codex");
    expect(translate("tr", "Continue with {name}", { name: "Codex" })).toBe("Codex ile devam et");
    expect(translate("tr", "Not in the catalog")).toBe("Not in the catalog");
  });

  it("picks Turkish only for a Turkish system language", () => {
    expect(systemLanguage(["tr-TR", "en-US"])).toBe("tr");
    expect(systemLanguage(["de-DE", "tr-TR"])).toBe("en");
    expect(systemLanguage([])).toBe(systemLanguage([]));
  });
});

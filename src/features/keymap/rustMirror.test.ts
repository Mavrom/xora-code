import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIONS } from "./actions";

// The settings file keeps only known action ids (src-tauri/src/settings/keybindings.rs).
describe("Rust mirror of the action list", () => {
  it("lists the same action ids", () => {
    const rust = readFileSync(
      join(__dirname, "..", "..", "..", "src-tauri", "src", "settings", "keybindings.rs"),
      "utf8",
    );
    const block = /pub const ACTION_IDS: &\[&str\] = &\[([\s\S]*?)\];/.exec(rust)?.[1] ?? "";
    const ids = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(ACTIONS.map((a) => a.id));
  });
});

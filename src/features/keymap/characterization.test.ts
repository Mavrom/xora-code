import { describe, expect, it } from "vitest";
import type { Platform } from "@/shared/ui/keys";
import { ACTIONS } from "./actions";
import { CASE_ACTIONS, CASES } from "./characterization.cases";
import { matchesAction, resolve } from "./keymap";

// The table was first checked against the hand-written predicates the keymap replaced
// (commit "test(keymap): characterize today's global shortcuts"); the default keymap has
// to fire exactly the same actions, on both platforms.
const PLATFORMS: Platform[] = ["other", "mac"];

describe("default keymap fires what the old handlers fired", () => {
  for (const platform of PLATFORMS) {
    for (const { note, event, fires } of CASES) {
      it(`${platform}: ${note} fires ${fires.join(", ") || "nothing"}`, () => {
        const fired = CASE_ACTIONS.filter((id) => matchesAction(event, id, platform, {}));
        expect(fired).toEqual(fires);
        expect(resolve(event, platform, {})).toBe(fires[0] ?? null);
      });
    }
  }

  it("covers every global and composer action", () => {
    const covered = new Set<string>(CASE_ACTIONS);
    // The editor's own action is a Monaco keybinding, checked in keymap.test.ts.
    expect(ACTIONS.filter((a) => !covered.has(a.id)).map((a) => a.id)).toEqual([
      "editor.addToChat",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { COMMANDS } from "@/features/commands/registry";
import { ACTIONS, isWellFormedActionId } from "./actions";

// The settings file keeps an override only for an id of the right shape (`is_action_id` in
// src-tauri/src/settings/keybindings.rs); which ids exist is checked here, on the frontend.
describe("action ids and the settings file", () => {
  it("every action and every palette command has an id the settings file keeps", () => {
    const ids = [...ACTIONS.map((a) => a.id), ...COMMANDS.map((c) => c.id)];
    expect(ids.filter((id) => !isWellFormedActionId(id))).toEqual([]);
  });

  it("checks the shape with the same rule as Rust (same examples as its test)", () => {
    for (const id of [
      "chat.new",
      "view.toggleSidebar",
      "git.stageAll",
      "workspace.openFolder",
      "a.b.c2",
    ]) {
      expect(isWellFormedActionId(id), id).toBe(true);
    }
    const long = `a.${"b".repeat(63)}`;
    for (const id of [
      "",
      "chat",
      ".new",
      "chat.",
      "chat..new",
      "Chat.new",
      "chat.New",
      "chat.2x",
      "chat new",
      "chat.new!",
      "çat.new",
      long,
    ]) {
      expect(isWellFormedActionId(id), id).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import { isOverridden, sanitizeOverrides, withBindings, withoutOverride } from "./overrides";

describe("sanitizeOverrides", () => {
  it("drops unknown actions and unreadable bindings, normalizes the rest", () => {
    expect(
      sanitizeOverrides({
        "chat.new": "Shift+Ctrl+J",
        "editor.save": null,
        "no.such": "mod+j",
        "view.inbox": "mod+k+l",
      }),
    ).toEqual({ "chat.new": "ctrl+shift+j", "editor.save": null });
  });
});

describe("withBindings", () => {
  it("sets, unbinds, and drops an entry that equals the default", () => {
    const next = withBindings(
      { "chat.new": "mod+j" },
      { "editor.save": null, "chat.new": "mod+n" },
    );
    expect(next).toEqual({ "editor.save": null });
    expect(isOverridden(next, "editor.save")).toBe(true);
    expect(isOverridden(next, "chat.new")).toBe(false);
  });

  it("keeps an entry for an action with two defaults set to one of them", () => {
    expect(withBindings({}, { "palette.open": "mod+k" })).toEqual({ "palette.open": "mod+k" });
  });

  it("reassigns in one go", () => {
    expect(withBindings({}, { "view.changes": "ctrl+`", "view.toggleTerminal": null })).toEqual({
      "view.changes": "ctrl+`",
      "view.toggleTerminal": null,
    });
  });
});

describe("withoutOverride", () => {
  it("puts one action back on its defaults", () => {
    expect(withoutOverride({ "chat.new": "mod+j", "editor.save": null }, "chat.new")).toEqual({
      "editor.save": null,
    });
  });
});

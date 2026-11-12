import { describe, expect, it } from "vitest";
import type { SelectControl } from "./controls";
import { addProblem, defaultModels, effectiveModels, pickerModels } from "./myModels";

const catalog = [
  { value: "opus", name: "Opus" },
  { value: "default", name: "Default", description: "Sonnet 5" },
  { value: "sonnet[1m]", name: "Sonnet (1M)" },
  { value: "haiku", name: "Haiku" },
];

const control = (current: string): SelectControl => ({
  key: "model",
  via: "config",
  label: "Model",
  current,
  options: catalog,
});

describe("defaultModels", () => {
  it("puts the agent's default entry first, then two more", () => {
    expect(defaultModels(catalog)).toEqual(["default", "opus", "sonnet[1m]"]);
  });

  it("starts with the first model when there is no default entry", () => {
    expect(
      defaultModels([
        { value: "a", name: "A" },
        { value: "b", name: "B" },
      ]),
    ).toEqual(["a", "b"]);
    expect(defaultModels([])).toEqual([]);
  });
});

describe("effectiveModels", () => {
  it("uses the user's own list as it is, even an empty one", () => {
    expect(effectiveModels("claude", ["haiku", "x-old"], catalog, [])).toEqual(["haiku", "x-old"]);
    expect(effectiveModels("claude", [], catalog, [])).toEqual([]);
  });

  it("carries an older hidden-models setting over without losing a model", () => {
    const hidden = ["claude:opus", "codex:gpt-5"];
    expect(effectiveModels("claude", null, catalog, hidden)).toEqual([
      "default",
      "sonnet[1m]",
      "haiku",
    ]);
    // A hidden model the agent no longer lists changes nothing for the rest.
    expect(effectiveModels("codex", null, [{ value: "o3", name: "o3" }], hidden)).toEqual(["o3"]);
  });

  it("falls back to the defaults for an agent never customised", () => {
    expect(effectiveModels("gemini", null, catalog, ["claude:opus"])).toEqual([
      "default",
      "opus",
      "sonnet[1m]",
    ]);
  });
});

describe("pickerModels", () => {
  it("follows the user's order and adds hand-typed ids by name", () => {
    expect(pickerModels(control("haiku"), ["haiku", "claude-old-1"])).toEqual([
      { value: "haiku", name: "Haiku" },
      { value: "claude-old-1", name: "claude-old-1", custom: true },
    ]);
  });

  it("keeps the model in use even when the user removed it", () => {
    expect(pickerModels(control("opus"), ["haiku"]).map((o) => o.value)).toEqual(["haiku", "opus"]);
    expect(pickerModels(control("opus"), []).map((o) => o.value)).toEqual(["opus"]);
  });
});

describe("addProblem", () => {
  it("refuses an empty or repeated id", () => {
    expect(addProblem("  ", ["a"])).toBe("empty");
    expect(addProblem(" a ", ["a"])).toBe("duplicate");
    expect(addProblem("b", ["a"])).toBeNull();
  });
});

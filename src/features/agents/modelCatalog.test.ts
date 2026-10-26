import { describe, expect, it } from "vitest";
import type { SelectControl } from "./controls";
import { modelKey, useModelCatalog, visibleModels } from "./modelCatalog";

const control: SelectControl = {
  key: "model",
  via: "config",
  label: "Model",
  current: "opus",
  options: [
    { value: "opus", name: "Opus" },
    { value: "sonnet", name: "Sonnet" },
    { value: "haiku", name: "Haiku" },
  ],
};

describe("visibleModels", () => {
  it("drops hidden models of that agent only", () => {
    const hidden = [modelKey("claude", "haiku"), modelKey("codex", "sonnet")];
    expect(visibleModels("claude", control, hidden).map((o) => o.value)).toEqual([
      "opus",
      "sonnet",
    ]);
  });

  it("keeps the model in use even when hidden", () => {
    const hidden = [modelKey("claude", "opus")];
    expect(visibleModels("claude", control, hidden).map((o) => o.value)).toContain("opus");
  });
});

describe("model catalog", () => {
  it("remembers an agent's models and ignores unchanged lists", () => {
    const { remember } = useModelCatalog.getState();
    remember("claude", control.options);
    const first = useModelCatalog.getState().models;
    expect(first.claude?.map((m) => m.value)).toEqual(["opus", "sonnet", "haiku"]);
    remember("claude", control.options);
    expect(useModelCatalog.getState().models).toBe(first);
  });
});

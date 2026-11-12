import { describe, expect, it } from "vitest";
import type { SelectControl } from "./controls";
import { modelKey, useModelCatalog } from "./modelCatalog";

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

describe("model catalog", () => {
  it("remembers an agent's models and ignores unchanged lists", () => {
    const { remember } = useModelCatalog.getState();
    remember("claude", control.options);
    const first = useModelCatalog.getState().models;
    expect(first.claude?.map((m) => m.value)).toEqual(["opus", "sonnet", "haiku"]);
    remember("claude", control.options);
    expect(useModelCatalog.getState().models).toBe(first);
  });

  it("keys a model by agent the way the older hidden list stored it", () => {
    expect(modelKey("codex", "o3")).toBe("codex:o3");
  });
});

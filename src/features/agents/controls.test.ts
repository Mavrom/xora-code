import { describe, expect, it } from "vitest";
import { applyControlValue, deriveControls, findControl, type ControlSource } from "./controls";
import type { AcpConfigOption } from "./types";

const claudeConfig: AcpConfigOption[] = [
  {
    id: "model",
    name: "Model",
    category: "model",
    type: "select",
    currentValue: "default",
    options: [
      { value: "default", name: "Default", description: "Sonnet" },
      { value: "opus", name: "Opus" },
    ],
  },
  {
    id: "mode",
    name: "Mode",
    category: "mode",
    type: "select",
    currentValue: "default",
    options: [
      { value: "default", name: "Manual" },
      { value: "acceptEdits", name: "Accept edits" },
    ],
  },
  {
    id: "effort",
    name: "Effort",
    category: "thought_level",
    type: "select",
    currentValue: "default",
    options: [
      { value: "default", name: "Default" },
      { value: "low", name: "Low" },
      { value: "high", name: "High" },
    ],
  },
];

const src = (over: Partial<ControlSource>): ControlSource => ({
  configOptions: null,
  modes: null,
  models: null,
  ...over,
});

describe("deriveControls", () => {
  it("maps config options by category and sets them via config", () => {
    const c = deriveControls(src({ configOptions: claudeConfig }));
    expect(c.model).toMatchObject({
      key: "model",
      via: "config",
      label: "Model",
      current: "default",
    });
    expect(c.model?.options).toEqual([
      { value: "default", name: "Default", description: "Sonnet" },
      { value: "opus", name: "Opus" },
    ]);
    expect(c.mode).toMatchObject({ key: "mode", via: "config", current: "default" });
    expect(c.effort).toMatchObject({ key: "effort", via: "config", label: "Effort" });
    expect(c.extra).toEqual([]);
  });

  it("ignores legacy modes and models when config options exist", () => {
    const c = deriveControls(
      src({
        configOptions: claudeConfig,
        modes: { currentModeId: "x", availableModes: [{ id: "x", name: "X" }] },
        models: { currentModelId: "m", availableModels: [{ modelId: "m", name: "M" }] },
      }),
    );
    expect(c.mode?.via).toBe("config");
    expect(c.model?.via).toBe("config");
  });

  it("puts model_config, custom and duplicate categories into extra, keeping order", () => {
    const c = deriveControls(
      src({
        configOptions: [
          claudeConfig[0],
          {
            id: "fast-mode",
            name: "Fast",
            category: "model_config",
            type: "boolean",
            currentValue: false,
          },
          {
            id: "collaboration_mode",
            name: "Collaboration",
            category: "_codex",
            type: "select",
            currentValue: "default",
            options: [
              { value: "default", name: "Default" },
              { value: "plan", name: "Plan" },
            ],
          },
          { ...claudeConfig[0], id: "model2", name: "Second model" },
          { id: "nocat", name: "No category", type: "boolean", currentValue: true },
        ],
      }),
    );
    expect(c.model?.key).toBe("model");
    expect(c.extra.map((x) => x.key)).toEqual([
      "fast-mode",
      "collaboration_mode",
      "model2",
      "nocat",
    ]);
    expect(c.extra[0]).toEqual({
      key: "fast-mode",
      via: "config",
      label: "Fast",
      current: false,
      boolean: true,
    });
  });

  it("flattens grouped select options with the group name", () => {
    const c = deriveControls(
      src({
        configOptions: [
          {
            id: "model",
            name: "Model",
            category: "model",
            type: "select",
            currentValue: "gpt-5",
            options: [
              { group: "openai", name: "OpenAI", options: [{ value: "gpt-5", name: "GPT-5" }] },
              {
                group: "other",
                name: "Other",
                options: [{ value: "o3", name: "o3", description: "d" }],
              },
            ],
          },
        ],
      }),
    );
    expect(c.model?.options).toEqual([
      { value: "gpt-5", name: "GPT-5", group: "OpenAI" },
      { value: "o3", name: "o3", description: "d", group: "Other" },
    ]);
  });

  it("maps Gemini legacy modes and models, with no effort control", () => {
    const c = deriveControls(
      src({
        configOptions: null,
        modes: {
          currentModeId: "default",
          availableModes: [
            { id: "default", name: "Default" },
            { id: "yolo", name: "YOLO", description: "Auto-approve all" },
          ],
        },
        models: {
          currentModelId: "auto",
          availableModels: [
            { modelId: "auto", name: "Auto" },
            { modelId: "gemini-2.5-pro", name: "Pro", description: null },
          ],
        },
      }),
    );
    expect(c.mode).toEqual({
      key: "legacy-mode",
      via: "mode",
      label: "Mod",
      current: "default",
      options: [
        { value: "default", name: "Default" },
        { value: "yolo", name: "YOLO", description: "Auto-approve all" },
      ],
    });
    expect(c.model).toMatchObject({ key: "legacy-model", via: "model", current: "auto" });
    expect(c.model?.options[1]).toEqual({ value: "gemini-2.5-pro", name: "Pro" });
    expect(c.effort).toBeUndefined();
    expect(c.extra).toEqual([]);
  });

  it("falls back to legacy when config options are empty", () => {
    const c = deriveControls(
      src({
        configOptions: [],
        modes: { currentModeId: "a", availableModes: [{ id: "a", name: "A" }] },
      }),
    );
    expect(c.mode?.via).toBe("mode");
  });

  it("returns no controls for an empty source", () => {
    expect(deriveControls(src({}))).toEqual({ extra: [] });
  });
});

describe("findControl", () => {
  it("finds a control by key in any slot", () => {
    const c = deriveControls(
      src({
        configOptions: [
          ...claudeConfig,
          { id: "fast-mode", name: "Fast", type: "boolean", currentValue: false },
        ],
      }),
    );
    expect(findControl(c, "effort")?.label).toBe("Effort");
    expect(findControl(c, "fast-mode")?.key).toBe("fast-mode");
    expect(findControl(c, "nope")).toBeUndefined();
  });
});

describe("applyControlValue", () => {
  it("updates a config option's current value", () => {
    const next = applyControlValue(
      src({ configOptions: claudeConfig }),
      "mode",
      "config",
      "acceptEdits",
    );
    expect(deriveControls(next).mode?.current).toBe("acceptEdits");
    // input untouched
    expect(claudeConfig[1].currentValue).toBe("default");
  });

  it("updates legacy mode and model ids", () => {
    const s = src({
      modes: { currentModeId: "default", availableModes: [{ id: "yolo", name: "Y" }] },
      models: { currentModelId: "auto", availableModels: [{ modelId: "pro", name: "Pro" }] },
    });
    const a = applyControlValue(s, "legacy-mode", "mode", "yolo");
    const b = applyControlValue(a, "legacy-model", "model", "pro");
    expect(b.modes?.currentModeId).toBe("yolo");
    expect(b.models?.currentModelId).toBe("pro");
  });

  it("returns the same source for an unknown key", () => {
    const s = src({ configOptions: claudeConfig });
    expect(applyControlValue(s, "missing", "config", "x")).toBe(s);
  });
});

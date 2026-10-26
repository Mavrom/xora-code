import { describe, expect, it } from "vitest";
import { deriveControls, type ControlSource } from "./controls";
import {
  DEFAULT_AGENT_SETTINGS,
  normalizeAgentSettings,
  planDefaults,
  type AgentSettings,
} from "./defaults";
import type { AcpConfigOption } from "./types";

const select = (
  id: string,
  category: string,
  current: string,
  values: string[],
): AcpConfigOption => ({
  id,
  name: id,
  category,
  type: "select",
  currentValue: current,
  options: values.map((v) => ({ value: v, name: v })),
});

const config = (...configOptions: AcpConfigOption[]) =>
  deriveControls({ configOptions, modes: null, models: null });

const settings = (over: Partial<AgentSettings> = {}): AgentSettings => ({
  ...DEFAULT_AGENT_SETTINGS,
  ...over,
});

const claude = config(
  select("model", "model", "default", ["default", "opus"]),
  select("mode", "mode", "default", ["default", "acceptEdits", "plan", "auto"]),
  select("effort", "thought_level", "default", ["default", "low", "medium", "high", "max"]),
);

describe("planDefaults", () => {
  it("maps approval policy to each agent's mode", () => {
    expect(
      planDefaults(
        "claude",
        claude,
        settings({ approvalPolicy: "autoEdits", defaultEffort: "low" }),
      ),
    ).toEqual([
      { key: "mode", via: "config", value: "acceptEdits" },
      { key: "effort", via: "config", value: "low" },
    ]);
    const codex = config(
      select("mode", "mode", "agent", [
        "read-only",
        "workspace-write",
        "agent",
        "agent-full-access",
      ]),
    );
    expect(planDefaults("codex", codex, settings({ approvalPolicy: "ask" }))).toEqual([
      { key: "mode", via: "config", value: "read-only" },
    ]);
    expect(planDefaults("codex", codex, settings({ approvalPolicy: "full" }))).toEqual([
      { key: "mode", via: "config", value: "agent-full-access" },
    ]);
  });

  it("falls back to auto when bypassPermissions is not offered", () => {
    expect(
      planDefaults("claude", claude, settings({ approvalPolicy: "full", defaultEffort: "medium" })),
    ).toEqual([
      { key: "mode", via: "config", value: "auto" },
      { key: "effort", via: "config", value: "medium" },
    ]);
  });

  it("uses legacy modes for Gemini and never sets effort", () => {
    const source: ControlSource = {
      configOptions: null,
      modes: {
        currentModeId: "default",
        availableModes: ["default", "autoEdit", "yolo"].map((id) => ({ id, name: id })),
      },
      models: null,
    };
    const c = deriveControls(source);
    expect(
      planDefaults("gemini", c, settings({ approvalPolicy: "full", defaultEffort: "high" })),
    ).toEqual([{ key: "legacy-mode", via: "mode", value: "yolo" }]);
  });

  it("skips values that are already current or not offered", () => {
    const c = config(
      select("mode", "mode", "default", ["default"]),
      select("effort", "thought_level", "x", ["x", "y"]),
    );
    expect(
      planDefaults("claude", c, settings({ approvalPolicy: "autoEdits", defaultEffort: "high" })),
    ).toEqual([]);
    expect(planDefaults("claude", c, settings({ approvalPolicy: "ask" }))).toEqual([]);
  });

  it("restores the last model first, unless asked to skip it", () => {
    const s = settings({ approvalPolicy: "ask", defaultEffort: "medium" });
    expect(planDefaults("claude", claude, s, { lastModel: "opus" })[0]).toEqual({
      key: "model",
      via: "config",
      value: "opus",
    });
    expect(planDefaults("claude", claude, s, { lastModel: "gone" })[0]?.key).toBe("effort");
    expect(planDefaults("claude", claude, s, { lastModel: "opus", skipModel: true })[0]?.key).toBe(
      "effort",
    );
  });

  it("prefers plan mode when the default mode is plan", () => {
    expect(
      planDefaults("claude", claude, settings({ defaultMode: "plan", defaultEffort: "medium" }))[0],
    ).toEqual({
      key: "mode",
      via: "config",
      value: "plan",
    });
    const codex = config(
      select("mode", "mode", "agent", ["read-only", "agent"]),
      select("collaboration_mode", "_codex", "default", ["default", "plan"]),
    );
    expect(
      planDefaults("codex", codex, settings({ defaultMode: "plan", approvalPolicy: "ask" })),
    ).toEqual([
      { key: "mode", via: "config", value: "read-only" },
      { key: "collaboration_mode", via: "config", value: "plan" },
    ]);
  });
});

describe("normalizeAgentSettings", () => {
  it("fills defaults and drops invalid values", () => {
    expect(normalizeAgentSettings(undefined)).toEqual(DEFAULT_AGENT_SETTINGS);
    expect(
      normalizeAgentSettings({
        defaultAgent: "codex",
        approvalPolicy: "nope",
        defaultEffort: "high",
        debugLogs: 1,
      }),
    ).toEqual({ ...DEFAULT_AGENT_SETTINGS, defaultAgent: "codex", defaultEffort: "high" });
  });
});

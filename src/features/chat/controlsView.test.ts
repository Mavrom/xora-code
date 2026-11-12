import { describe, expect, it } from "vitest";
import type { SelectControl } from "@/features/agents/controls";
import { effortLabel, fitsSegments, modelLabel, pickerSummary, statusNote } from "./controlsView";

const select = (current: string, options: [string, string][]): SelectControl => ({
  key: "k",
  via: "config",
  label: "L",
  current,
  options: options.map(([value, name]) => ({ value, name })),
});

describe("effortLabel", () => {
  it("translates known levels and keeps unknown names", () => {
    expect(effortLabel("high")).toBe("Yüksek");
    expect(effortLabel("XHIGH")).toBe("Çok yüksek");
    expect(effortLabel("turbo", "Turbo")).toBe("Turbo");
    expect(effortLabel("turbo")).toBe("turbo");
  });
});

describe("modelLabel", () => {
  it("drops the agent name and localises the default entry", () => {
    expect(modelLabel(select("s", [["s", "Claude Sonnet 4.5"]]), "Claude")).toBe("Sonnet 4.5");
    expect(modelLabel(select("default", [["default", "Default"]]), "Claude")).toBe("Varsayılan");
    expect(modelLabel(select("gpt", [["gpt", "gpt-5.2-codex"]]), "Codex")).toBe("gpt-5.2-codex");
    expect(modelLabel(select("missing", []), "Gemini")).toBe("missing");
  });
});

describe("pickerSummary", () => {
  it("lists only the parts the session has", () => {
    const model = select("pro", [["pro", "Gemini 2.5 Pro"]]);
    const effort = select("medium", [["medium", "Medium"]]);
    const mode = select("plan", [["plan", "Plan mode"]]);
    expect(pickerSummary("Gemini", model, undefined, undefined)).toEqual(["2.5 Pro"]);
    expect(pickerSummary("Codex", undefined, effort, undefined)).toEqual(["Codex", "Orta"]);
    expect(pickerSummary("Claude", model, effort, mode)).toEqual([
      "Gemini 2.5 Pro",
      "Orta",
      "Plan mode",
    ]);
    expect(pickerSummary("Claude", undefined, undefined, undefined)).toEqual(["Claude"]);
  });
});

describe("fitsSegments", () => {
  it("takes a few short names in one row", () => {
    expect(fitsSegments(["Manual", "Plan", "Auto"])).toBe(true);
    expect(fitsSegments(["Varsayılan", "Düşük", "Orta", "Yüksek", "En yüksek"], 6)).toBe(true);
  });

  it("falls back to a list for many options or long names", () => {
    expect(fitsSegments(["a", "b", "c", "d", "e"])).toBe(false);
    expect(fitsSegments(["Workspace access", "Read only"])).toBe(false);
    expect(fitsSegments([])).toBe(false);
  });
});

describe("statusNote", () => {
  it("summarises each status in a word or two", () => {
    expect(statusNote({ state: "ready", agentInfo: null, capabilities: {}, authMethods: [] })).toBe(
      "Hazır",
    );
    expect(statusNote({ state: "notInstalled", reason: "node-missing" })).toBe("Node.js gerekli");
    expect(statusNote({ state: "authRequired", authMethods: [] })).toBe("Giriş gerekli");
    expect(statusNote({ state: "stopped" })).toBe("");
  });
});

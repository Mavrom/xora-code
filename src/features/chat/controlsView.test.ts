import { describe, expect, it } from "vitest";
import type { SelectControl } from "@/features/agents/controls";
import {
  effortLabel,
  modeLabels,
  modelLabel,
  modelOptionLabel,
  pickerSummary,
  statusNote,
} from "./controlsView";

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
    const zen = select("zen", [["zen", "Zen mode"]]);
    expect(pickerSummary("Gemini", model, undefined, undefined)).toEqual(["2.5 Pro"]);
    expect(pickerSummary("Codex", undefined, effort, undefined)).toEqual(["Codex", "Orta"]);
    expect(pickerSummary("Claude", model, effort, mode)).toEqual([
      "Gemini 2.5 Pro",
      "Orta",
      "Plan",
    ]);
    expect(pickerSummary("Claude", undefined, undefined, zen)).toEqual(["Claude", "Zen mode"]);
    expect(pickerSummary("Claude", undefined, undefined, undefined)).toEqual(["Claude"]);
  });
});

describe("modelOptionLabel", () => {
  it("names the model behind a Default entry when its description does", () => {
    const def = (description?: string) => ({ value: "default", name: "Default", description });
    expect(modelOptionLabel(def("Sonnet 5 (önerilen)"), "Claude")).toBe("Sonnet 5");
    expect(modelOptionLabel(def("Use the default model (currently Opus 4.5)"), "Claude")).toBe(
      "Opus 4.5",
    );
    expect(modelOptionLabel(def("Her görev için önerilen"), "Claude")).toBe("Varsayılan");
    expect(modelOptionLabel(def(), "Claude")).toBe("Varsayılan");
    expect(modelOptionLabel({ value: "opus", name: "Opus" }, "Claude")).toBe("Opus");
  });
});

describe("modeLabels", () => {
  it("translates the agents' known modes", () => {
    const opts = (...values: string[]) => values.map((value) => ({ value, name: `${value}!` }));
    expect(modeLabels(opts("default", "acceptEdits", "plan", "auto"))).toEqual([
      "Onay iste",
      "Düzenlemeler",
      "Plan",
      "Otomatik",
    ]);
    expect(modeLabels(opts("read-only", "workspace-write", "agent-full-access", "zen"))).toEqual([
      "Salt okunur",
      "Çalışma alanı",
      "Tam erişim",
      "zen!",
    ]);
  });

  it("keeps the agent's names where two modes would read the same", () => {
    const options = [
      { value: "auto", name: "Auto" },
      { value: "agent", name: "Auto review" },
    ];
    expect(modeLabels(options)).toEqual(["Auto", "Auto review"]);
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

// Session defaults from the user's settings. Applied once
// when a session opens; later picker changes stay within the session.

import type { Control, SessionControls } from "./controls";
import { findControl } from "./controls";
import type { AgentId } from "./types";

export type ApprovalPolicy = "ask" | "autoEdits" | "full";
export type Effort = "auto" | "low" | "medium" | "high" | "xhigh" | "max";
export type DefaultMode = "agent" | "plan" | "chat";

/** Mirrors `settings.agent` from the settings feature (`@/features/settings/types`). */
export interface AgentSettings {
  defaultAgent: AgentId;
  defaultMode: DefaultMode;
  approvalPolicy: ApprovalPolicy;
  defaultEffort: Effort;
  claudeIgnoreApiKey: boolean;
  debugLogs: boolean;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  defaultAgent: "claude",
  defaultMode: "agent",
  approvalPolicy: "ask",
  defaultEffort: "medium",
  claudeIgnoreApiKey: true,
  debugLogs: false,
};

const oneOf =
  <T extends string>(values: readonly T[]) =>
  (v: unknown, fallback: T): T =>
    typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : fallback;

const agentId = oneOf<AgentId>(["claude", "codex", "gemini"]);
const mode = oneOf<DefaultMode>(["agent", "plan", "chat"]);
const policy = oneOf<ApprovalPolicy>(["ask", "autoEdits", "full"]);
const effort = oneOf<Effort>(["auto", "low", "medium", "high", "xhigh", "max"]);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Tolerant parse of `settings.agent` (unknown or invalid values fall back to defaults). */
export function normalizeAgentSettings(raw: unknown): AgentSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AGENT_SETTINGS;
  return {
    defaultAgent: agentId(r.defaultAgent, d.defaultAgent),
    defaultMode: mode(r.defaultMode, d.defaultMode),
    approvalPolicy: policy(r.approvalPolicy, d.approvalPolicy),
    defaultEffort: effort(r.defaultEffort, d.defaultEffort),
    claudeIgnoreApiKey: bool(r.claudeIgnoreApiKey, d.claudeIgnoreApiKey),
    debugLogs: bool(r.debugLogs, d.debugLogs),
  };
}

// --- Settings source -------------------------------------------------------------
// The settings feature owns the settings store; `useAgentEvents` wires it in with
// `setAgentSettingsSource(() => useSettingsStore.getState().settings.agent)`.

let settingsSource: () => unknown = () => DEFAULT_AGENT_SETTINGS;

export function setAgentSettingsSource(source: () => unknown) {
  settingsSource = source;
}

export function getAgentSettings(): AgentSettings {
  try {
    return normalizeAgentSettings(settingsSource());
  } catch {
    return DEFAULT_AGENT_SETTINGS;
  }
}

// --- Mapping -----------------------------------------------------------------------

/** Mode values per approval policy, in order of preference. */
export const MODE_BY_POLICY: Record<AgentId, Record<ApprovalPolicy, string[]>> = {
  claude: { ask: ["default"], autoEdits: ["acceptEdits"], full: ["bypassPermissions", "auto"] },
  codex: { ask: ["read-only"], autoEdits: ["workspace-write"], full: ["agent-full-access"] },
  gemini: { ask: ["default"], autoEdits: ["autoEdit"], full: ["yolo"] },
};

/** Plan mode as a mode value (Claude, Gemini) or Codex's collaboration mode. */
const PLAN_MODE: Record<AgentId, { key?: string; value: string }> = {
  claude: { value: "plan" },
  codex: { key: "collaboration_mode", value: "plan" },
  gemini: { value: "plan" },
};

/** Effort levels the agents use, lowest first; "auto" is the agent's own default. */
const EFFORT_LADDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

/**
 * The agent's levels to try for a setting, best first: the same level, else the nearest one
 * on the ladder (the lower one on a tie). "auto" asks for the agent's own default entry
 * and otherwise leaves the level alone.
 */
export function effortCandidates(effort: Effort, offered: readonly string[]): string[] {
  if (effort === "auto") return offered.filter((v) => v === "default" || v === "auto");
  const target = EFFORT_LADDER.indexOf(effort);
  return offered
    .map((v) => ({ v, at: EFFORT_LADDER.indexOf(v.toLowerCase()) }))
    .filter((o) => o.at !== -1)
    .sort((a, b) => Math.abs(a.at - target) - Math.abs(b.at - target) || a.at - b.at)
    .map((o) => o.v);
}

export interface ControlChange {
  key: string;
  via: Control["via"];
  value: string | boolean;
}

/** A change to `control` towards the first offered candidate, or null. */
function pick(control: Control | undefined, candidates: readonly string[]): ControlChange | null {
  if (!control || !("options" in control)) return null;
  const value = candidates.find((c) => control.options.some((o) => o.value === c));
  if (value === undefined || value === control.current) return null;
  return { key: control.key, via: control.via, value };
}

export interface PlanOptions {
  /** The model last chosen for this agent, restored when still offered. */
  lastModel?: string | null;
  /** Leave the model alone (it was applied already and controls re-derived). */
  skipModel?: boolean;
}

/**
 * The control changes that bring a fresh session in line with the settings,
 * in order: model (it can change the effort options), mode, effort, extras.
 */
export function planDefaults(
  agentId: AgentId,
  controls: SessionControls,
  settings: AgentSettings,
  opts: PlanOptions = {},
): ControlChange[] {
  const out: ControlChange[] = [];
  const push = (c: ControlChange | null) => c && out.push(c);

  if (!opts.skipModel && opts.lastModel) push(pick(controls.model, [opts.lastModel]));

  const plan = PLAN_MODE[agentId];
  const planInMode = settings.defaultMode === "plan" && !plan.key;
  const modeCandidates = planInMode
    ? [plan.value, ...MODE_BY_POLICY[agentId][settings.approvalPolicy]]
    : MODE_BY_POLICY[agentId][settings.approvalPolicy];
  push(pick(controls.mode, modeCandidates));

  if (controls.effort) {
    const offered = controls.effort.options.map((o) => o.value);
    push(pick(controls.effort, effortCandidates(settings.defaultEffort, offered)));
  }

  if (settings.defaultMode === "plan" && plan.key) {
    push(pick(findControl(controls, plan.key), [plan.value]));
  }
  return out;
}

// --- Last model per agent ----------------------------------------------------------

const LAST_MODEL_KEY = "xora.agents.lastModel";

export function loadLastModel(agentId: AgentId): string | null {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_MODEL_KEY) ?? "{}") as Record<string, unknown>;
    const v = all[agentId];
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export function saveLastModel(agentId: AgentId, model: string) {
  try {
    const all = JSON.parse(localStorage.getItem(LAST_MODEL_KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(LAST_MODEL_KEY, JSON.stringify({ ...all, [agentId]: model }));
  } catch {
    // Storage unavailable: the model is simply not remembered.
  }
}

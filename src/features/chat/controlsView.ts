// Labels for the composer's settings chip and panel, derived from the unified controls.
import type { SelectControl } from "@/features/agents/controls";
import type { AgentStatus } from "@/features/agents/types";
import { t } from "@/shared/i18n";

type Option = SelectControl["options"][number];

const EFFORT_TR: Record<string, string> = {
  none: t("Off"),
  off: t("Off"),
  minimal: t("Minimal"),
  low: t("Low"),
  medium: t("Medium"),
  high: t("High"),
  xhigh: t("Very high"),
  max: t("Max"),
  // The agent picks the level itself (per model); a real choice, not "nothing chosen".
  default: t("Auto level"),
};

/** Turkish name for well-known effort levels; the agent's own name otherwise. */
export function effortLabel(value: string, name?: string): string {
  return EFFORT_TR[value.toLowerCase()] ?? name ?? value;
}

/**
 * Turkish names for the approval modes Claude Code, Codex and Gemini report, by id. The
 * three agents share some ids ("default", "plan"); anything else keeps the agent's label.
 */
const MODE_TR: Record<string, string> = {
  default: t("Ask first"),
  "read-only": t("Read only"),
  acceptEdits: t("Edits"),
  autoEdit: t("Edits"),
  "workspace-write": t("Workspace"),
  plan: t("Plan"),
  auto: t("Automatic"),
  agent: t("Automatic"),
  yolo: t("Automatic"),
  bypassPermissions: t("Full access"),
  "agent-full-access": t("Full access"),
};

/**
 * Modes that skip every approval (Claude's bypass, Codex's full access, Gemini's YOLO): the
 * panel and the chip show them in warning tone. Kept to ids the agents are known to send.
 */
const FULL_ACCESS_MODES = new Set(["bypassPermissions", "agent-full-access", "yolo"]);

export const isFullAccessMode = (value: string): boolean => FULL_ACCESS_MODES.has(value);

const ON = new Set(["on", "true", "enabled", "enable", "yes"]);
const OFF = new Set(["off", "false", "disabled", "disable", "no"]);

/**
 * The two values of an on/off choice reported as a select ("On" / "Off", "enabled" /
 * "disabled"), so it can be a switch; null for any other select.
 */
export function onOffValues(options: readonly Option[]): { on: string; off: string } | null {
  if (options.length !== 2) return null;
  const is = (set: Set<string>, o: Option) =>
    set.has(o.value.toLowerCase()) || set.has(o.name.trim().toLowerCase());
  const on = options.find((o) => is(ON, o));
  const off = options.find((o) => is(OFF, o));
  return on && off && on !== off ? { on: on.value, off: off.value } : null;
}

/** Turkish names for the agent extras Codex reports, by config id; others keep theirs. */
const EXTRA_TR: Record<string, string> = {
  "fast-mode": t("Fast mode"),
  collaboration_mode: t("Collaboration"),
};

export const extraLabel = (key: string, label: string): string => EXTRA_TR[key] ?? label;

/** Name of the selected option, or the raw value when the list does not include it. */
export function currentName(control: SelectControl): string {
  return control.options.find((o) => o.value === control.current)?.name ?? control.current;
}

/**
 * The real model behind a "Default" entry, when its description names one: "Sonnet 5
 * (önerilen)", "Use the default model (currently Opus 4.5)". Null when it does not.
 */
function modelInDescription(description: string | undefined): string | null {
  if (!description) return null;
  const currently = /\(currently ([^)]+)\)/i.exec(description);
  if (currently) return currently[1].trim();
  const lead = /^([A-Z][\w.-]*(?: [\w.-]+){0,2}?)(?:\s*[(·,—–-]|$)/.exec(description.trim());
  return lead && /\d/.test(lead[1]) ? lead[1].trim() : null;
}

/**
 * Compact model name: drops a leading agent name ("Claude Sonnet 4.5" -> "Sonnet 4.5"); a
 * "Default" entry shows the model its description names, else "Varsayılan".
 */
export function modelOptionLabel(option: Option, agentName: string): string {
  const name = option.name.trim();
  if (/^default$/i.test(name) || option.value === "default") {
    return modelInDescription(option.description) ?? t("Default");
  }
  const prefix = `${agentName} `;
  return name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
}

/** The selected model's compact name (see `modelOptionLabel`). */
export function modelLabel(control: SelectControl, agentName: string): string {
  const option = control.options.find((o) => o.value === control.current);
  return modelOptionLabel(option ?? { value: control.current, name: control.current }, agentName);
}

/**
 * Button labels for a mode list: the Turkish name for a known id, else the agent's own. A
 * label two modes would share (e.g. "auto" and "agent") keeps the agent's name instead.
 */
export function modeLabels(options: readonly Option[]): string[] {
  const mapped = options.map((o) => MODE_TR[o.value] ?? o.name);
  return mapped.map((label, i) =>
    mapped.indexOf(label) === i && mapped.lastIndexOf(label) === i ? label : options[i].name,
  );
}

/** The selected mode's label (see `modeLabels`). */
export function modeLabel(control: SelectControl): string {
  const i = control.options.findIndex((o) => o.value === control.current);
  return i === -1 ? control.current : modeLabels(control.options)[i];
}

/**
 * "Sonnet 5 · Orta · Onay iste": the parts the session actually has, model first (the
 * agent's name when it reports no model; its mark sits beside the chip's text).
 */
export function pickerSummary(
  agentName: string,
  model: SelectControl | undefined,
  effort: SelectControl | undefined,
  mode: SelectControl | undefined,
): string[] {
  const parts = [model ? modelLabel(model, agentName) : agentName];
  if (effort) {
    const option = effort.options.find((o) => o.value === effort.current);
    parts.push(effortLabel(effort.current, option?.name));
  }
  if (mode) parts.push(modeLabel(mode));
  return parts;
}

/** Short status note next to an agent in the picker; empty when there is nothing to say. */
export function statusNote(status: AgentStatus): string {
  switch (status.state) {
    case "ready":
      return t("Ready");
    case "notInstalled":
      return status.reason === "package-missing" ? t("Not installed") : t("Needs Node.js");
    case "installing":
      return t("Installing");
    case "starting":
      return t("Connecting");
    case "authRequired":
      return t("Sign-in needed");
    case "crashed":
      return t("Stopped");
    default:
      return "";
  }
}

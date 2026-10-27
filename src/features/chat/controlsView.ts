// Labels for the composer's agent / model / effort chip, derived from the unified controls.
import type { SelectControl } from "@/features/agents/controls";
import type { AgentStatus } from "@/features/agents/types";
import { t } from "@/shared/i18n";

const EFFORT_TR: Record<string, string> = {
  none: t("Off"),
  off: t("Off"),
  minimal: t("Minimal"),
  low: t("Low"),
  medium: t("Medium"),
  high: t("High"),
  xhigh: t("Very high"),
  max: t("Max"),
  default: t("Default"),
};

/** Turkish name for well-known effort levels; the agent's own name otherwise. */
export function effortLabel(value: string, name?: string): string {
  return EFFORT_TR[value.toLowerCase()] ?? name ?? value;
}

/** Name of the selected option, or the raw value when the list does not include it. */
export function currentName(control: SelectControl): string {
  return control.options.find((o) => o.value === control.current)?.name ?? control.current;
}

/**
 * Compact model name for the chip: drops a leading agent name ("Claude Sonnet 4.5" ->
 * "Sonnet 4.5") and turns a bare "Default" into "Varsayılan".
 */
export function modelLabel(control: SelectControl, agentName: string): string {
  const name = currentName(control).trim();
  if (/^default$/i.test(name) || control.current === "default") return t("Default");
  const prefix = `${agentName} `;
  return name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
}

/** "Claude · Sonnet 4.5 · Yüksek": the parts the session actually has. */
export function pickerSummary(
  agentName: string,
  model: SelectControl | undefined,
  effort: SelectControl | undefined,
): string[] {
  const parts = [agentName];
  if (model) parts.push(modelLabel(model, agentName));
  if (effort) {
    const option = effort.options.find((o) => o.value === effort.current);
    parts.push(effortLabel(effort.current, option?.name));
  }
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

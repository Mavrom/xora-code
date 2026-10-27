import { useId, type KeyboardEvent } from "react";
import { Hand, PencilLine, Zap, type LucideIcon } from "lucide-react";
import { modelKey, useModelCatalog } from "@/features/agents/modelCatalog";
import { cn } from "@/shared/ui/cn";
import { useAccountsStore } from "../accountsStore";
import { stepIndex } from "../controls/keyboard";
import { Segmented } from "../controls/Segmented";
import { Select } from "../controls/Select";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Toggle } from "../controls/Toggle";
import { PROVIDERS } from "../providers";
import { useSettingsStore } from "../store";
import type { AgentMode, ApprovalPolicy, Effort } from "../types";
import { t } from "@/shared/i18n";

const MODES: { value: AgentMode; label: string }[] = [
  { value: "agent", label: t("Agent") },
  { value: "plan", label: t("Plan") },
  { value: "chat", label: t("Chat") },
];

const EFFORTS: { value: Effort; label: string }[] = [
  { value: "low", label: t("Low") },
  { value: "medium", label: t("Medium") },
  { value: "high", label: t("High") },
];

const POLICIES: { value: ApprovalPolicy; title: string; description: string; icon: LucideIcon }[] =
  [
    {
      value: "ask",
      title: t("Ask for everything"),
      description: t("Asks for your approval on every file edit and command."),
      icon: Hand,
    },
    {
      value: "autoEdits",
      title: t("Auto-approve file edits"),
      description: t("Edits inside the working folder apply right away; commands still ask."),
      icon: PencilLine,
    },
    {
      value: "full",
      title: t("Fully automatic"),
      description: t(
        "The agent edits and runs commands without asking. Only turn this on for projects you trust.",
      ),
      icon: Zap,
    },
  ];

export function AgentSection() {
  const agent = useSettingsStore((s) => s.settings.agent);
  const update = useSettingsStore((s) => s.update);
  const statuses = useAccountsStore((s) => s.statuses);
  const detected = useAccountsStore((s) => s.detectedAt !== null);

  return (
    <>
      <SectionHeader
        title={t("Agent")}
        description={t(
          "Choose which agent a new chat starts with, in which mode, and how freely it may act.",
        )}
      />

      <SettingGroup title={t("Defaults")}>
        <SettingRow
          label={t("Default agent")}
          setting="agent.defaultAgent"
          description={t("New chats start with this agent.")}
          control={(id) => (
            <Select
              labelledBy={id}
              value={agent.defaultAgent}
              options={PROVIDERS.map((p) => ({
                value: p.id,
                label: p.name,
                hint: detected && !statuses[p.id]?.path ? t("not installed") : undefined,
              }))}
              onChange={(defaultAgent) => update({ agent: { defaultAgent } })}
            />
          )}
        />
        <SettingRow
          label={t("Default mode")}
          setting="agent.defaultMode"
          description={t("Agent acts, Plan drafts a plan first, Chat only answers.")}
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={agent.defaultMode}
              options={MODES}
              onChange={(defaultMode) => update({ agent: { defaultMode } })}
            />
          )}
        />
        <SettingRow
          label={t("Thinking effort")}
          setting="agent.defaultEffort"
          description={t(
            "Applied where the agent supports it. Higher effort is slower but more thorough.",
          )}
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={agent.defaultEffort}
              options={EFFORTS}
              onChange={(defaultEffort) => update({ agent: { defaultEffort } })}
            />
          )}
        />
      </SettingGroup>

      <ModelVisibility
        hidden={agent.hiddenModels}
        onChange={(hiddenModels) => update({ agent: { hiddenModels } })}
      />

      <SettingGroup title={t("Approval policy")} setting="agent.approvalPolicy">
        <PolicyPicker
          value={agent.approvalPolicy}
          onChange={(approvalPolicy) => update({ agent: { approvalPolicy } })}
        />
      </SettingGroup>

      <SettingGroup title={t("Diagnostics")}>
        <SettingRow
          label={t("Verbose agent logs")}
          setting="agent.debugLogs"
          description={t("Logs the protocol traffic with the agent, for troubleshooting.")}
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={agent.debugLogs}
              onChange={(debugLogs) => update({ agent: { debugLogs } })}
            />
          )}
        />
      </SettingGroup>
    </>
  );
}

/**
 * One switch per model each agent has offered, so rarely used ones leave the composer's
 * picker. The lists come from the agents themselves: an agent shows up here after its
 * first chat.
 */
function ModelVisibility({
  hidden,
  onChange,
}: {
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) {
  const catalog = useModelCatalog((s) => s.models);
  const agents = PROVIDERS.filter((p) => (catalog[p.id]?.length ?? 0) > 0);

  const set = (key: string, visible: boolean) =>
    onChange(visible ? hidden.filter((k) => k !== key) : [...hidden, key]);

  if (agents.length === 0) {
    return (
      <SettingGroup title={t("Visible models")} setting="agent.hiddenModels">
        <p className="px-4 py-3 text-xs text-fg-subtle">
          {t("The models an agent offers are listed here once you start your first chat with it.")}
        </p>
      </SettingGroup>
    );
  }

  return (
    <>
      {agents.map((provider, i) => (
        <SettingGroup
          key={provider.id}
          title={t("Visible models · {name}", { name: provider.name })}
          setting={i === 0 ? "agent.hiddenModels" : undefined}
        >
          {catalog[provider.id]?.map((model) => {
            const key = modelKey(provider.id, model.value);
            return (
              <SettingRow
                key={key}
                label={model.name}
                description={model.description}
                control={(id) => (
                  <Toggle
                    labelledBy={id}
                    checked={!hidden.includes(key)}
                    onChange={(visible) => set(key, visible)}
                  />
                )}
              />
            );
          })}
        </SettingGroup>
      ))}
    </>
  );
}

function PolicyPicker({
  value,
  onChange,
}: {
  value: ApprovalPolicy;
  onChange: (value: ApprovalPolicy) => void;
}) {
  const name = useId();
  const index = Math.max(
    0,
    POLICIES.findIndex((p) => p.value === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = stepIndex(e.key, index, POLICIES.length);
    if (next === null) return;
    e.preventDefault();
    onChange(POLICIES[next].value);
    document.getElementById(`${name}-${next}`)?.focus();
  };

  return (
    <div role="radiogroup" aria-label={t("Approval policy")} onKeyDown={onKeyDown}>
      {POLICIES.map((policy, i) => {
        const selected = i === index;
        const Icon = policy.icon;
        return (
          <button
            key={policy.value}
            id={`${name}-${i}`}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(policy.value)}
            className={cn(
              "group flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors duration-fast first:rounded-t-lg last:rounded-b-lg",
              "border-b border-border last:border-b-0",
              "focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-subtle",
              selected ? "bg-elevated" : "hover:bg-hover/60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-md border transition-colors duration-fast",
                selected
                  ? "border-border-strong bg-bg text-fg"
                  : "border-border bg-bg text-fg-subtle group-hover:text-fg-muted",
              )}
            >
              <Icon size={15} strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-ui", selected ? "text-fg" : "text-fg-muted")}>
                {policy.title}
              </span>
              <span className="mt-0.5 block text-xs text-pretty text-fg-subtle">
                {policy.description}
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-fast",
                selected ? "border-fg bg-fg" : "border-border-strong",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full bg-bg transition-[scale] duration-base ease-out-quint",
                  selected ? "scale-100" : "scale-0",
                )}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

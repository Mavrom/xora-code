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

const MODES: { value: AgentMode; label: string }[] = [
  { value: "agent", label: "Ajan" },
  { value: "plan", label: "Plan" },
  { value: "chat", label: "Sohbet" },
];

const EFFORTS: { value: Effort; label: string }[] = [
  { value: "low", label: "Düşük" },
  { value: "medium", label: "Orta" },
  { value: "high", label: "Yüksek" },
];

const POLICIES: { value: ApprovalPolicy; title: string; description: string; icon: LucideIcon }[] =
  [
    {
      value: "ask",
      title: "Her şeyi sor",
      description: "Dosya düzenlemeleri ve komutlar için her seferinde onayınızı ister.",
      icon: Hand,
    },
    {
      value: "autoEdits",
      title: "Dosya düzenlemelerini otomatik onayla",
      description: "Çalışma klasöründeki düzenlemeler hemen uygulanır; komutlar için yine sorar.",
      icon: PencilLine,
    },
    {
      value: "full",
      title: "Tam otomatik",
      description:
        "Ajan sormadan düzenler ve komut çalıştırır. Yalnızca güvendiğiniz projelerde açın.",
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
        title="Agent"
        description="Yeni bir sohbet başlarken Xora'nın hangi ajanı, hangi modda ve ne kadar serbestçe çalıştıracağını seçin."
      />

      <SettingGroup title="Varsayılanlar">
        <SettingRow
          label="Varsayılan ajan"
          description="Yeni sohbetler bu ajanla başlar."
          control={(id) => (
            <Select
              labelledBy={id}
              value={agent.defaultAgent}
              options={PROVIDERS.map((p) => ({
                value: p.id,
                label: p.name,
                hint: detected && !statuses[p.id]?.path ? "kurulu değil" : undefined,
              }))}
              onChange={(defaultAgent) => update({ agent: { defaultAgent } })}
            />
          )}
        />
        <SettingRow
          label="Varsayılan mod"
          description="Ajan uygular, Plan önce bir plan çıkarır, Sohbet yalnızca yanıtlar."
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
          label="Düşünme eforu"
          description="Destekleyen ajanlarda uygulanır. Yüksek efor daha yavaş ama daha titizdir."
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

      <SettingGroup title="Onay politikası">
        <PolicyPicker
          value={agent.approvalPolicy}
          onChange={(approvalPolicy) => update({ agent: { approvalPolicy } })}
        />
      </SettingGroup>

      <SettingGroup title="Tanılama">
        <SettingRow
          label="Ayrıntılı ajan günlükleri"
          description="Ajanla yapılan protokol trafiğini sorun gidermek için günlüğe yazar."
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
      <SettingGroup title="Görünen modeller">
        <p className="px-4 py-3 text-xs text-fg-subtle">
          Bir ajanla ilk sohbeti başlattığınızda sunduğu modeller burada listelenir.
        </p>
      </SettingGroup>
    );
  }

  return (
    <>
      {agents.map((provider) => (
        <SettingGroup key={provider.id} title={`Görünen modeller · ${provider.name}`}>
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
    <div role="radiogroup" aria-label="Onay politikası" onKeyDown={onKeyDown}>
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

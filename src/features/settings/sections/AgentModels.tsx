import { useId, useState, type FormEvent } from "react";
import { Check, Plus, X } from "lucide-react";
import { useModelCatalog, type ModelEntry } from "@/features/agents/modelCatalog";
import { addProblem, effectiveModels } from "@/features/agents/myModels";
import { modelOptionLabel } from "@/features/chat/controlsView";
import { cn } from "@/shared/ui/cn";
import { SettingGroup } from "../controls/SettingRow";
import { PROVIDERS, type ProviderInfo } from "../providers";
import { useSettingsStore } from "../store";
import { t } from "@/shared/i18n";

/**
 * "My models", one block per agent: the short list the composer's Model row offers, each
 * removable, and "Model ekle" to pick more from what the agent has reported or to type an
 * id it does not list.
 */
export function AgentModels() {
  return (
    <>
      {PROVIDERS.map((provider, i) => (
        <AgentModelBlock key={provider.id} provider={provider} first={i === 0} />
      ))}
    </>
  );
}

function AgentModelBlock({ provider, first }: { provider: ProviderInfo; first: boolean }) {
  const agent = useSettingsStore((s) => s.settings.agent);
  const update = useSettingsStore((s) => s.update);
  const catalog = useModelCatalog((s) => s.models[provider.id]) ?? [];
  const [adding, setAdding] = useState(false);
  const pickerId = useId();
  const mine = effectiveModels(
    provider.id,
    agent.myModels[provider.id],
    catalog,
    agent.hiddenModels,
  );
  const set = (list: string[]) =>
    update({ agent: { myModels: { ...agent.myModels, [provider.id]: list } } });
  const nameOf = (id: string) => {
    const entry = catalog.find((m) => m.value === id);
    return entry ? modelOptionLabel(entry, provider.name.split(" ")[0]) : id;
  };

  return (
    <div data-setting={`agent.myModels.${provider.id}`}>
      <SettingGroup
        title={t("Models · {name}", { name: provider.name })}
        setting={first ? "agent.myModels" : undefined}
      >
        <div className="flex flex-col gap-2.5 px-4 py-3">
          <ul aria-label={t("My models")} className="flex flex-wrap items-center gap-1">
            {mine.length === 0 && (
              <li className="text-xs text-fg-subtle">
                {agent.myModels[provider.id] === null && catalog.length === 0
                  ? t("Filled in after the first chat with {name}.", { name: provider.name })
                  : t("None: the composer offers only the model in use.")}
              </li>
            )}
            {mine.map((id) => (
              <li
                key={id}
                title={catalog.find((m) => m.value === id)?.description ?? id}
                className="inline-flex items-center gap-0.5 rounded-md bg-hover py-[3px] pr-1 pl-2 text-[12.5px] text-fg"
              >
                {nameOf(id)}
                <button
                  type="button"
                  aria-label={t("Remove {name}", { name: nameOf(id) })}
                  onClick={() => set(mine.filter((m) => m !== id))}
                  className="grid size-4 place-items-center rounded-sm text-fg-subtle transition-colors duration-fast outline-none hover:bg-border-strong hover:text-fg focus-visible:ring-1 focus-visible:ring-fg-subtle"
                >
                  <X size={11} strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-expanded={adding}
                aria-controls={adding ? pickerId : undefined}
                onClick={() => setAdding((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[12.5px] transition-colors duration-fast outline-none focus-visible:ring-1 focus-visible:ring-fg-subtle",
                  adding ? "bg-hover text-fg" : "text-fg-subtle hover:bg-hover hover:text-fg-muted",
                )}
              >
                <Plus size={12} strokeWidth={2} aria-hidden />
                {t("Add model")}
              </button>
            </li>
          </ul>
          {adding && (
            <AddModelPicker
              id={pickerId}
              agentName={provider.name}
              nameOf={nameOf}
              catalog={catalog}
              mine={mine}
              onToggle={(value) =>
                set(mine.includes(value) ? mine.filter((m) => m !== value) : [...mine, value])
              }
              onAdd={(value) => set([...mine, value])}
              onClose={() => setAdding(false)}
            />
          )}
        </div>
      </SettingGroup>
    </div>
  );
}

interface AddModelPickerProps {
  id: string;
  agentName: string;
  /** The short name the composer shows ("Sonnet 5" for a Default entry). */
  nameOf: (id: string) => string;
  catalog: readonly ModelEntry[];
  mine: readonly string[];
  onToggle: (value: string) => void;
  onAdd: (value: string) => void;
  onClose: () => void;
}

/**
 * Every model the agent has reported (name and description, added ones checked; a click
 * adds or removes), then a field for an id the agent does not list.
 */
function AddModelPicker({
  id,
  agentName,
  nameOf,
  catalog,
  mine,
  onToggle,
  onAdd,
  onClose,
}: AddModelPickerProps) {
  const [typed, setTyped] = useState("");
  const [tried, setTried] = useState(false);
  const fieldId = useId();
  const problem = addProblem(typed, mine);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem) return;
    onAdd(typed.trim());
    setTyped("");
    setTried(false);
  };

  return (
    <div
      id={id}
      role="group"
      aria-label={t("Add model")}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      className="rounded-lg border border-border bg-bg p-1.5"
    >
      {catalog.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-pretty text-fg-subtle">
          {t(
            "{name} has not reported its models yet; they appear here after its first chat. You can add an id by hand meanwhile.",
            { name: agentName },
          )}
        </p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-px overflow-y-auto">
          {catalog.map((model) => {
            const added = mine.includes(model.value);
            return (
              <li key={model.value}>
                <button
                  type="button"
                  aria-pressed={added}
                  onClick={() => onToggle(model.value)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1 text-left transition-colors duration-fast outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-fg-subtle"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn("block truncate text-xs", added ? "text-fg" : "text-fg-muted")}
                    >
                      {nameOf(model.value)}
                      <span className="ml-1.5 font-mono text-3xs text-fg-subtle">
                        {model.value}
                      </span>
                    </span>
                    {model.description && (
                      <span className="block truncate text-2xs text-fg-subtle">
                        {model.description}
                      </span>
                    )}
                  </span>
                  <Check
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                    className={cn("shrink-0 text-fg", added ? "opacity-100" : "opacity-0")}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form
        onSubmit={submit}
        className="mt-1 flex items-center gap-1.5 border-t border-border px-1 pt-1.5"
      >
        <label htmlFor={fieldId} className="sr-only">
          {t("Model id")}
        </label>
        <input
          id={fieldId}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t("Model id, e.g. an older or newer one")}
          spellCheck={false}
          aria-invalid={tried && problem !== null}
          aria-describedby={tried && problem ? `${fieldId}-problem` : undefined}
          className="h-7 min-w-0 flex-1 rounded-md bg-elevated px-2 font-mono text-xs text-fg outline-none placeholder:font-sans placeholder:text-fg-subtle focus-visible:ring-1 focus-visible:ring-fg-subtle"
        />
        <button
          type="submit"
          className="h-7 shrink-0 rounded-md px-2.5 text-xs text-fg-muted transition-colors duration-fast outline-none hover:bg-hover hover:text-fg focus-visible:ring-1 focus-visible:ring-fg-subtle"
        >
          {t("Add")}
        </button>
      </form>
      {tried && problem && (
        <p id={`${fieldId}-problem`} role="alert" className="px-2 pt-1 text-2xs text-danger">
          {problem === "empty" ? t("Type a model id.") : t("This model is already in the list.")}
        </p>
      )}
    </div>
  );
}

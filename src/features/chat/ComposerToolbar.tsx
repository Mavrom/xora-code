import type { ReactNode } from "react";
import { Folder, GitBranch, ShieldCheck, Zap } from "lucide-react";
import type { Control, SelectControl, SessionControls } from "@/features/agents/controls";
import { AGENT_IDS } from "@/features/agents/reducer";
import type { AgentId, AgentInfo } from "@/features/agents/types";
import { cn } from "@/shared/ui/cn";
import { AgentGlyph } from "./AgentGlyph";
import { ChipMenu, type ChipOption, type ChipSection } from "./ChipMenu";
import { chipClass } from "./chipStyles";
import { effortLabel, pickerSummary, statusNote } from "./controlsView";
import { contextRatio, formatTokens } from "./format";

type SetControl = (key: string, value: string | boolean) => void;

/** Which chip a fixture screenshot opens on mount. */
export type OpenChip = "picker" | "mode" | null;

const toOptions = (control: SelectControl): ChipOption[] =>
  control.options.map((o) => ({
    value: o.value,
    name: o.name,
    description: o.description,
    group: o.group,
  }));

const selectSection = (
  key: string,
  label: string,
  control: SelectControl,
  onSet: SetControl,
  options: ChipOption[] = toOptions(control),
): ChipSection => ({
  key,
  label,
  value: control.current,
  options,
  onSelect: (value) => onSet(control.key, value),
});

interface ComposerToolbarProps {
  controls: SessionControls | null;
  onSetControl: SetControl;
  openChip?: OpenChip;
  /** The hero composer has room below; the docked one opens upwards. */
  side: "top" | "bottom";
}

/** Chips inside the composer: approval mode and agent-specific extras (e.g. Codex fast mode). */
export function ComposerToolbar({ controls, onSetControl, openChip, side }: ComposerToolbarProps) {
  if (!controls) return null;
  const { mode, extra } = controls;
  return (
    <>
      {mode && (
        <ChipMenu
          label={`Mod: ${mode.label}`}
          leading={
            <ShieldCheck size={13} strokeWidth={1.75} aria-hidden className="text-fg-subtle" />
          }
          display={mode.options.find((o) => o.value === mode.current)?.name ?? mode.current}
          sections={[selectSection("mode", mode.label || "Mod", mode, onSetControl)]}
          defaultOpen={openChip === "mode"}
          side={side}
        />
      )}
      {extra.map((control) => (
        <ExtraControl key={control.key} control={control} onSet={onSetControl} side={side} />
      ))}
    </>
  );
}

function ExtraControl({
  control,
  onSet,
  side,
}: {
  control: Control;
  onSet: SetControl;
  side: "top" | "bottom";
}) {
  if ("boolean" in control) {
    return (
      <button
        type="button"
        aria-pressed={control.current}
        title={control.label}
        onClick={() => onSet(control.key, !control.current)}
        className={cn(chipClass(false, "quiet"), control.current && "bg-hover text-fg")}
      >
        <Zap
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className={control.current ? "text-fg" : "text-fg-subtle"}
        />
        {control.label}
      </button>
    );
  }
  return (
    <ChipMenu
      label={control.label}
      display={control.options.find((o) => o.value === control.current)?.name ?? control.current}
      sections={[selectSection(control.key, control.label, control, onSet)]}
      side={side}
    />
  );
}

/** Small ring that fills with the context window; turns warm near the limit. */
export function ContextMeter({ used, size }: { used: number; size: number }) {
  const ratio = contextRatio(used, size);
  const percent = Math.round(ratio * 100);
  const r = 6;
  const circumference = 2 * Math.PI * r;
  const label = `Bağlam: %${percent} · ${formatTokens(used)} / ${formatTokens(size)}`;
  return (
    <span role="img" aria-label={label} title={label} className="grid size-7 place-items-center">
      <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden>
        <circle cx="8" cy="8" r={r} fill="none" strokeWidth="2" className="stroke-border-strong" />
        <circle
          cx="8"
          cy="8"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={cn(
            "transition-[stroke-dashoffset] duration-slow ease-out-quint",
            ratio > 0.95 ? "stroke-danger" : ratio > 0.8 ? "stroke-warning" : "stroke-fg-muted",
          )}
        />
      </svg>
    </span>
  );
}

interface ContextRowProps {
  agents: Record<AgentId, AgentInfo>;
  agentId: AgentId;
  controls: SessionControls | null;
  onSelectAgent: (id: AgentId) => void;
  onSetControl: SetControl;
  folderName: string | null;
  onOpenFolder: () => void;
  branch: string | null;
  openChip?: OpenChip;
  side: "top" | "bottom";
  /** Right-aligned quiet content (shortcut hints, a refused-send notice). */
  aside?: ReactNode;
}

/**
 * The line under the composer: one chip for agent · model · effort, then the folder and git
 * branch the agent works in.
 */
export function ContextRow({
  agents,
  agentId,
  controls,
  onSelectAgent,
  onSetControl,
  folderName,
  onOpenFolder,
  branch,
  openChip,
  side,
  aside,
}: ContextRowProps) {
  const agent = agents[agentId];
  const summary = pickerSummary(agent.displayName, controls?.model, controls?.effort);

  const sections: ChipSection[] = [
    {
      key: "agent",
      label: "Agent",
      value: agentId,
      onSelect: (value) => onSelectAgent(value as AgentId),
      options: AGENT_IDS.map((id) => ({
        value: id,
        name: agents[id].displayName,
        leading: <AgentGlyph agent={id} className="text-fg-muted" />,
        meta: statusNote(agents[id].status),
      })),
    },
  ];
  if (controls?.model) sections.push(selectSection("model", "Model", controls.model, onSetControl));
  if (controls?.effort) {
    const effort = controls.effort;
    sections.push(
      selectSection(
        "effort",
        "Düşünme düzeyi",
        effort,
        onSetControl,
        effort.options.map((o) => ({ value: o.value, name: effortLabel(o.value, o.name) })),
      ),
    );
  }

  return (
    <div className="mt-2 flex min-h-7 items-center gap-1 px-1 @container">
      <ChipMenu
        label="Agent, model ve düşünme düzeyi"
        tone="outline"
        side={side}
        defaultOpen={openChip === "picker"}
        leading={<AgentGlyph agent={agentId} className="text-fg" />}
        display={summary.map((part, i) => (
          <span key={i} className={i === 0 ? "text-fg" : undefined}>
            {i > 0 && (
              <span aria-hidden className="px-1 text-fg-subtle">
                ·
              </span>
            )}
            {part}
          </span>
        ))}
        sections={sections}
      />
      <button
        type="button"
        onClick={onOpenFolder}
        title={folderName ? "Başka bir klasör aç" : "Klasör aç"}
        className={cn(chipClass(false, "outline"), "shrink")}
      >
        <Folder size={13} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
        <span className="truncate">{folderName ?? "Klasör seç"}</span>
      </button>
      {branch && (
        <span
          title={`Git dalı: ${branch}`}
          className="inline-flex h-7 min-w-0 shrink items-center gap-1.5 px-2 text-xs text-fg-subtle"
        >
          <GitBranch size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span className="truncate font-mono text-2xs">{branch}</span>
        </span>
      )}
      <span className="flex-1" />
      {aside && <div className="hidden shrink-0 @[34rem]:block">{aside}</div>}
    </div>
  );
}

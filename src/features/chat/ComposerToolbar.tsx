import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  FileCode,
  FilePlus,
  Folder,
  FolderPlus,
  GitBranch,
  Monitor,
  Paperclip,
} from "lucide-react";
import type { Control, SelectControl, SessionControls } from "@/features/agents/controls";
import { visibleModels } from "@/features/agents/modelCatalog";
import { AGENT_IDS } from "@/features/agents/reducer";
import type { AgentId, AgentInfo } from "@/features/agents/types";
import { useSettingsStore } from "@/features/settings/store";
import { openSettings } from "@/features/settings/viewStore";
import { cn } from "@/shared/ui/cn";
import { ContextMenu } from "@/shared/ui/ContextMenu";
import type { MenuEntry } from "@/shared/ui/menuModel";
import { AgentGlyph } from "./AgentGlyph";
import { ChipMenu, type ChipOption, type ChipSection } from "./ChipMenu";
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

/** Agent-specific extras (e.g. Codex fast mode): a toggle becomes an Açık/Kapalı choice. */
function extraSection(control: Control, onSet: SetControl): ChipSection {
  if ("boolean" in control) {
    return {
      key: control.key,
      label: control.label,
      value: control.current ? "on" : "off",
      options: [
        { value: "on", name: "Açık" },
        { value: "off", name: "Kapalı" },
      ],
      onSelect: (value) => onSet(control.key, value === "on"),
    };
  }
  return selectSection(control.key, control.label, control, onSet);
}

/**
 * Agent options left out of the picker. `agent` is Claude Code's persona list (custom
 * subagents with paragraph-long descriptions); it needs its own, roomier UI.
 */
const HIDDEN_EXTRAS = new Set(["agent"]);

/** Muted chip look of the line above and below the composer. */
const quietChip =
  "inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-xs text-fg-muted transition-colors duration-fast hover:bg-glass hover:text-fg";

interface ModelPickerProps {
  agents: Record<AgentId, AgentInfo>;
  agentId: AgentId;
  controls: SessionControls | null;
  onSelectAgent: (id: AgentId) => void;
  onSetControl: SetControl;
  openChip?: OpenChip;
  side: "top" | "bottom";
}

/**
 * The one chip inside the composer: the agent's mark, model and effort ("Opus 5.5 Orta").
 * Its menu also holds the agent, the approval mode and any agent-specific extras.
 */
export function ModelPicker({
  agents,
  agentId,
  controls,
  onSelectAgent,
  onSetControl,
  openChip,
  side,
}: ModelPickerProps) {
  const agent = agents[agentId];
  const summary = pickerSummary(agent.displayName, controls?.model, controls?.effort);
  const hiddenModels = useSettingsStore((s) => s.settings.agent.hiddenModels);

  const sections: ChipSection[] = [
    {
      key: "agent",
      label: "Agent",
      value: agentId,
      onSelect: (value) => onSelectAgent(value as AgentId),
      options: AGENT_IDS.map((id) => ({
        value: id,
        name: agents[id].displayName,
        leading: <AgentGlyph agent={id} tinted />,
        meta: statusNote(agents[id].status),
      })),
    },
  ];
  if (controls?.model) {
    const model = controls.model;
    const options = toOptions({ ...model, options: visibleModels(agentId, model, hiddenModels) });
    sections.push(selectSection("model", "Model", model, onSetControl, options));
  }
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
  if (controls?.mode) {
    sections.push(selectSection("mode", controls.mode.label || "Mod", controls.mode, onSetControl));
  }
  for (const control of controls?.extra ?? []) {
    if (!HIDDEN_EXTRAS.has(control.key)) sections.push(extraSection(control, onSetControl));
  }
  if (controls?.model) {
    // Never checked: a link to the list of models the picker shows.
    sections.push({
      key: "models",
      label: "Liste",
      value: "",
      options: [{ value: "edit", name: "Görünen modelleri seç…" }],
      onSelect: () => openSettings("agent"),
    });
  }

  // The mark already names the agent: show model and effort, like "Opus 5.5 Orta".
  const parts = summary.length > 1 ? summary.slice(1) : summary;
  return (
    <ChipMenu
      label="Agent, model ve ayarlar"
      side={side}
      defaultOpen={openChip === "picker" || openChip === "mode"}
      chevron={false}
      buttonClassName="inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 text-xs transition-colors duration-fast hover:bg-hover"
      leading={<AgentGlyph agent={agentId} size={13} tinted />}
      display={parts.map((part, i) => (
        <span key={i} className={i === 0 ? "font-medium text-fg" : "ml-1.5 text-fg-subtle"}>
          {part}
        </span>
      ))}
      sections={sections}
    />
  );
}

interface AttachMenuProps {
  onPickFiles: () => void;
  onPickFolder: () => void;
  /** The file open in the editor, offered as a one-click mention. */
  openFile: { name: string; onAdd: () => void } | null;
}

/** The paperclip: a small menu of things to mention in the message (`@path`). */
export function AttachMenu({ onPickFiles, onPickFolder, openFile }: AttachMenuProps) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const items: MenuEntry[] = [
    { label: "Dosya…", icon: FilePlus, onSelect: onPickFiles },
    { label: "Klasör…", icon: FolderPlus, onSelect: onPickFolder },
  ];
  if (openFile) {
    items.push("separator", {
      label: `Açık dosya: ${openFile.name}`,
      icon: FileCode,
      onSelect: openFile.onAdd,
    });
  }
  return (
    <>
      <button
        type="button"
        aria-label="Ekle"
        aria-haspopup="menu"
        aria-expanded={at !== null}
        title="Ekle"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { x: r.left, y: r.bottom + 6 });
        }}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md transition-colors duration-fast",
          at ? "bg-hover text-fg" : "text-fg-subtle hover:bg-hover hover:text-fg",
        )}
      >
        <Paperclip size={15} strokeWidth={1.75} aria-hidden />
      </button>
      {at && (
        <ContextMenu x={at.x} y={at.y} label="Ekle" items={items} onClose={() => setAt(null)} />
      )}
    </>
  );
}

/** Small ring that fills with the context window; turns warm near the limit. */
/** Below this share of the context window the meter stays hidden. */
const CONTEXT_METER_MIN = 0.5;

export function ContextMeter({ used, size }: { used: number; size: number }) {
  const ratio = contextRatio(used, size);
  // Only worth a glance once the window starts to fill; a near-empty ring reads as a spinner.
  if (ratio < CONTEXT_METER_MIN) return null;
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

/** Where the agent runs: this computer. The only place for now, so the menu has one entry. */
export function HostChip({ hostname }: { hostname: string | null }) {
  const name = hostname ?? "Bu bilgisayar";
  return (
    <ChipMenu
      label="Çalışma ortamı"
      side="top"
      align="end"
      buttonClassName={cn(quietChip, "uppercase")}
      leading={<Monitor size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />}
      display={name}
      sections={[
        {
          key: "host",
          label: "Çalışma ortamı",
          value: "local",
          options: [{ value: "local", name, description: "Agent bu bilgisayarda çalışır." }],
          onSelect: () => {},
        },
      ]}
    />
  );
}

/** Opens another folder; the folder the agent works in. */
export function FolderChip({
  folderName,
  onOpenFolder,
}: {
  folderName: string | null;
  onOpenFolder: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenFolder}
      title={folderName ? "Başka bir klasör aç" : "Klasör aç"}
      className={cn(quietChip, "shrink")}
    >
      <Folder size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <span className="truncate">{folderName ?? "Klasör seç"}</span>
      <ChevronDown size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
    </button>
  );
}

interface ContextRowProps {
  /** Shown first in the row when the composer has no folder chip above it. */
  folder?: ReactNode;
  /** Where the agent works: the repository or one of its worktrees. */
  checkout?: ReactNode;
  branch: string | null;
  /** Right-aligned quiet content (the stop hint while a turn runs). */
  aside?: ReactNode;
}

/**
 * The line under the composer: the folder (docked), the checkout and the git branch the
 * agent works on.
 */
export function ContextRow({ folder, checkout, branch, aside }: ContextRowProps) {
  return (
    <div className="mt-2 flex min-h-7 items-center gap-1 @container">
      {folder}
      {checkout}
      {branch && (
        <span
          title={`Git dalı: ${branch}`}
          className={cn(quietChip, "shrink hover:bg-transparent")}
        >
          <GitBranch size={13} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span className="truncate">{branch}</span>
        </span>
      )}
      <span className="flex-1" />
      {aside && <div className="hidden shrink-0 @[34rem]:block">{aside}</div>}
    </div>
  );
}

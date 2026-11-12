import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import type { Control, SelectControl, SessionControls } from "@/features/agents/controls";
import { visibleModels } from "@/features/agents/modelCatalog";
import { AGENT_IDS } from "@/features/agents/reducer";
import type { AgentId, AgentInfo } from "@/features/agents/types";
import { useSettingsStore } from "@/features/settings/store";
import { openSettings } from "@/features/settings/viewStore";
import { cn } from "@/shared/ui/cn";
import { AgentGlyph } from "./AgentGlyph";
import { effortLabel, fitsSegments, pickerSummary, statusNote } from "./controlsView";
import { t } from "@/shared/i18n";

type SetControl = (key: string, value: string | boolean) => void;

interface Choice {
  value: string;
  name: string;
  description?: string;
  group?: string;
  leading?: ReactNode;
  /** Tooltip (an agent's status on a segment). */
  title?: string;
}

interface PanelSection {
  key: string;
  label: string;
  value: string;
  options: Choice[];
  layout: "list" | "segments";
  onSelect: (value: string) => void;
  /** A quiet action at the end of a list ("Modelleri düzenle…"). */
  footer?: { label: string; onSelect: () => void };
}

/** Space kept between the panel and the window's top edge. */
const PANEL_MARGIN = 16;

/** Effort levels get a little more room in one row than modes do. */
const EFFORT_SEGMENTS = 6;

/**
 * Agent options left out of the panel. `agent` is Claude Code's persona list (custom
 * subagents with paragraph-long descriptions); it needs its own, roomier UI.
 */
const HIDDEN_EXTRAS = new Set(["agent"]);

const choices = (control: SelectControl): Choice[] =>
  control.options.map((o) => ({
    value: o.value,
    name: o.name,
    description: o.description,
    group: o.group,
  }));

const layoutFor = (options: Choice[], max?: number): PanelSection["layout"] =>
  fitsSegments(
    options.map((o) => o.name),
    max,
  )
    ? "segments"
    : "list";

/** Agent-specific extras (e.g. Codex fast mode): a toggle becomes an Açık/Kapalı choice. */
function extraSection(control: Control, onSet: SetControl): PanelSection {
  if ("boolean" in control) {
    return {
      key: control.key,
      label: control.label,
      value: control.current ? "on" : "off",
      options: [
        { value: "on", name: t("On") },
        { value: "off", name: t("Off") },
      ],
      layout: "segments",
      onSelect: (value) => onSet(control.key, value === "on"),
    };
  }
  const options = choices(control);
  return {
    key: control.key,
    label: control.label,
    value: control.current,
    options,
    layout: layoutFor(options),
    onSelect: (value) => onSet(control.key, value),
  };
}

interface SettingsChipProps {
  agents: Record<AgentId, AgentInfo>;
  agentId: AgentId;
  controls: SessionControls | null;
  onSelectAgent: (id: AgentId) => void;
  onSetControl: SetControl;
  /** Opens on mount (fixture screenshots). */
  defaultOpen?: boolean;
}

/**
 * The one chip inside the composer: the agent's mark, then model · effort · mode (only the
 * parts the agent reports). It opens a panel above it with the agent, the model list and
 * the effort and mode as segmented rows; a choice applies at once and the panel stays open,
 * so several can be changed in one go.
 */
export function SettingsChip({
  agents,
  agentId,
  controls,
  onSelectAgent,
  onSetControl,
  defaultOpen = false,
}: SettingsChipProps) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  /** Room above the chip, so the panel never runs off the window's top edge. */
  const [room, setRoom] = useState<number | null>(null);
  const hiddenModels = useSettingsStore((s) => s.settings.agent.hiddenModels);
  const agent = agents[agentId];
  const model = controls?.model;
  const effort = controls?.effort;
  const mode = controls?.mode;
  const parts = pickerSummary(agent.displayName, model, effort, mode);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const top = buttonRef.current?.getBoundingClientRect().top;
    if (top !== undefined) setRoom(Math.max(160, top - PANEL_MARGIN));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Into the first group, on its current choice.
    panelRef.current
      ?.querySelector<HTMLElement>("[data-choice][tabindex='0']")
      ?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const sections: PanelSection[] = [
    {
      key: "agent",
      label: t("Agent"),
      value: agentId,
      layout: "segments",
      onSelect: (value) => onSelectAgent(value as AgentId),
      options: AGENT_IDS.map((id) => ({
        value: id,
        name: agents[id].displayName,
        leading: <AgentGlyph agent={id} size={12} tinted />,
        title: statusNote(agents[id].status) || undefined,
      })),
    },
  ];
  if (model) {
    sections.push({
      key: "model",
      label: t("Model"),
      value: model.current,
      options: choices({ ...model, options: visibleModels(agentId, model, hiddenModels) }),
      layout: "list",
      onSelect: (value) => onSetControl(model.key, value),
      footer: {
        label: t("Edit models…"),
        onSelect: () => {
          setOpen(false);
          openSettings("agent");
        },
      },
    });
  }
  if (effort) {
    const options = effort.options.map((o) => ({
      value: o.value,
      name: effortLabel(o.value, o.name),
      description: o.description,
    }));
    sections.push({
      key: "effort",
      label: t("Effort"),
      value: effort.current,
      options,
      layout: layoutFor(options, EFFORT_SEGMENTS),
      onSelect: (value) => onSetControl(effort.key, value),
    });
  }
  if (mode) {
    const options = choices(mode);
    sections.push({
      key: "mode",
      label: t("Mode"),
      value: mode.current,
      options,
      layout: layoutFor(options),
      onSelect: (value) => onSetControl(mode.key, value),
    });
  }
  for (const control of controls?.extra ?? []) {
    if (!HIDDEN_EXTRAS.has(control.key)) sections.push(extraSection(control, onSetControl));
  }

  const label = t("Agent, model and settings");
  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      onBlur={(e) => {
        // Tabbing past the last group leaves the panel: it closes behind the focus.
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${label}: ${[agent.displayName, ...parts].join(", ")}`}
        title={label}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 text-xs transition-colors duration-fast hover:bg-hover aria-expanded:bg-hover"
      >
        <AgentGlyph agent={agentId} size={13} tinted />
        {/* One run of text: the end (mode, then effort) is cut before the model. */}
        <span className="min-w-0 truncate">
          {parts.map((part, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span aria-hidden className="mx-1.5 text-fg-subtle/60">
                  ·
                </span>
              )}
              <span className={i === 0 ? "font-medium text-fg" : "text-fg-subtle"}>{part}</span>
            </Fragment>
          ))}
        </span>
        <SlidersHorizontal
          size={13}
          strokeWidth={1.75}
          aria-hidden
          className="shrink-0 text-fg-subtle"
        />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          style={room === null ? undefined : { maxHeight: Math.min(room, 512) }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }}
          className="absolute bottom-full left-0 z-30 mb-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-border-strong bg-elevated p-2 shadow-2xl shadow-black/60 transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
        >
          {sections.map((section) => (
            <SectionView key={section.key} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One titled choice. Arrows move between its options (Up/Down in a list, also Left/Right
 * in a row); Enter, Space or a click applies one. Tab moves on to the next section, which
 * is entered on its current choice.
 */
function SectionView({ section }: { section: PanelSection }) {
  const headingId = useId();
  const selected = Math.max(
    0,
    section.options.findIndex((o) => o.value === section.value),
  );
  const [focus, setFocus] = useState(selected);
  const groupRef = useRef<HTMLDivElement>(null);
  const segments = section.layout === "segments";
  const tabStop = section.options[focus] ? focus : selected;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = section.options.length - 1;
    const back = event.key === "ArrowUp" || (segments && event.key === "ArrowLeft");
    const forward = event.key === "ArrowDown" || (segments && event.key === "ArrowRight");
    let next: number | null = null;
    if (back) next = tabStop <= 0 ? last : tabStop - 1;
    else if (forward) next = tabStop >= last ? 0 : tabStop + 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setFocus(next);
    groupRef.current?.querySelectorAll<HTMLElement>("[data-choice]")[next]?.focus();
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h3
        id={headingId}
        className="px-1.5 text-3xs font-medium tracking-wide text-fg-subtle uppercase"
      >
        {section.label}
      </h3>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={headingId}
        onKeyDown={onKeyDown}
        className={
          segments
            ? "flex gap-0.5 rounded-lg border border-border bg-bg p-0.5"
            : "flex flex-col gap-px"
        }
      >
        {section.options.map((option, index) => {
          const checked = option.value === section.value;
          const prev = section.options[index - 1];
          const showGroup = !segments && option.group && option.group !== prev?.group;
          return (
            <Fragment key={option.value}>
              {showGroup && (
                <div role="presentation" className="px-2 pt-1 pb-0.5 text-3xs text-fg-subtle">
                  {option.group}
                </div>
              )}
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                data-choice
                tabIndex={index === tabStop ? 0 : -1}
                title={option.title ?? option.description}
                onFocus={() => setFocus(index)}
                onClick={() => {
                  if (!checked) section.onSelect(option.value);
                }}
                className={cn(
                  "transition-colors duration-fast outline-none focus-visible:ring-1 focus-visible:ring-border-strong",
                  segments
                    ? cn(
                        "inline-flex h-7 min-w-0 flex-auto items-center justify-center gap-1 rounded-md px-1.5 text-2xs whitespace-nowrap",
                        checked
                          ? "bg-hover text-fg shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
                          : "text-fg-subtle hover:text-fg",
                      )
                    : cn(
                        "flex min-h-7 w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left",
                        checked ? "text-fg" : "text-fg-muted hover:bg-hover/80 hover:text-fg",
                      ),
                )}
              >
                {option.leading}
                {segments ? (
                  <span className="truncate">{option.name}</span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{option.name}</span>
                      {option.description && (
                        <span className="mt-px block truncate text-2xs leading-4 text-fg-subtle">
                          {option.description}
                        </span>
                      )}
                    </span>
                    <Check
                      size={13}
                      strokeWidth={2}
                      aria-hidden
                      className={cn("shrink-0", checked ? "opacity-100" : "opacity-0")}
                    />
                  </>
                )}
              </button>
            </Fragment>
          );
        })}
      </div>
      {section.footer && (
        <button
          type="button"
          onClick={section.footer.onSelect}
          className="mt-0.5 flex h-7 w-full items-center rounded-lg px-2 text-left text-2xs text-fg-subtle transition-colors duration-fast hover:bg-hover/80 hover:text-fg"
        >
          {section.footer.label}
        </button>
      )}
    </section>
  );
}

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
import { Settings2, SlidersHorizontal } from "lucide-react";
import type { SelectControl, SessionControls } from "@/features/agents/controls";
import { visibleModels } from "@/features/agents/modelCatalog";
import { AGENT_IDS } from "@/features/agents/reducer";
import type { AgentId, AgentInfo } from "@/features/agents/types";
import { useSettingsStore } from "@/features/settings/store";
import { openSettings } from "@/features/settings/viewStore";
import { cn } from "@/shared/ui/cn";
import { AgentGlyph } from "./AgentGlyph";
import {
  effortLabel,
  modeLabels,
  modelOptionLabel,
  pickerSummary,
  statusNote,
} from "./controlsView";
import { t } from "@/shared/i18n";

type SetControl = (key: string, value: string | boolean) => void;

interface Choice {
  value: string;
  label: string;
  /** The tooltip: the agent's description, or an agent's status. */
  title?: string;
  leading?: ReactNode;
}

interface Row {
  key: string;
  /** Accessible name of the row's radiogroup. */
  label: string;
  value: string;
  choices: Choice[];
  onSelect: (value: string) => void;
  /** A small control at the end of the row (the gear that edits the model list). */
  trailing?: ReactNode;
}

/** Space kept between the panel and the window's top edge. */
const PANEL_MARGIN = 16;

/**
 * Agent options left out of the panel. `agent` is Claude Code's persona list (custom
 * subagents with paragraph-long descriptions); it needs its own, roomier UI.
 */
const HIDDEN_EXTRAS = new Set(["agent"]);

/** One small button of a row: thin border, filled when it is the current choice. */
const pill = (on: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-md border px-[9px] py-[3px] text-xs whitespace-nowrap transition-colors duration-fast outline-none focus-visible:ring-1 focus-visible:ring-fg-subtle",
    on
      ? "border-fg-subtle/50 bg-border-strong text-fg"
      : "border-border text-fg-muted hover:border-border-strong hover:text-fg",
  );

const selectRow = (
  key: string,
  label: string,
  control: SelectControl,
  onSet: SetControl,
  labels: string[] = control.options.map((o) => o.name),
): Row => ({
  key,
  label,
  value: control.current,
  choices: control.options.map((o, i) => ({
    value: o.value,
    label: labels[i],
    title: o.description,
  })),
  onSelect: (value) => onSet(control.key, value),
});

interface SettingsChipProps {
  agents: Record<AgentId, AgentInfo>;
  agentId: AgentId;
  controls: SessionControls | null;
  onSelectAgent: (id: AgentId) => void;
  onSetControl: SetControl;
  /** A new chat, before its first message: the agent can still be switched. */
  canSwitchAgent: boolean;
  /** Opens on mount (fixture screenshots). */
  defaultOpen?: boolean;
}

/**
 * The one chip inside the composer: the agent's mark, then model · effort · mode (only the
 * parts the agent reports). It opens a small panel above it: one row of buttons each for
 * the agent (new chat only), model, effort and mode, then any agent extras as toggles. A
 * click applies at once and the panel stays open, so several can be changed in one go.
 */
export function SettingsChip({
  agents,
  agentId,
  controls,
  onSelectAgent,
  onSetControl,
  canSwitchAgent,
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
    if (top !== undefined) setRoom(Math.max(120, top - PANEL_MARGIN));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Into the first row, on its current choice.
    panelRef.current
      ?.querySelector<HTMLElement>("[data-choice][tabindex='0']")
      ?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const rows: Row[] = [];
  if (canSwitchAgent) {
    rows.push({
      key: "agent",
      label: t("Agent"),
      value: agentId,
      onSelect: (value) => onSelectAgent(value as AgentId),
      choices: AGENT_IDS.map((id) => ({
        value: id,
        label: agents[id].displayName,
        leading: <AgentGlyph agent={id} size={12} tinted />,
        title: statusNote(agents[id].status) || undefined,
      })),
    });
  }
  if (model) {
    const shown = { ...model, options: visibleModels(agentId, model, hiddenModels) };
    const editLabel = t("Edit models…");
    rows.push({
      ...selectRow(
        "model",
        t("Model"),
        shown,
        onSetControl,
        shown.options.map((o) => modelOptionLabel(o, agent.displayName)),
      ),
      trailing: (
        <button
          type="button"
          aria-label={editLabel}
          title={editLabel}
          onClick={() => {
            setOpen(false);
            openSettings("agent");
          }}
          className="grid size-[26px] shrink-0 place-items-center rounded-md text-fg-subtle transition-colors duration-fast outline-none hover:bg-hover hover:text-fg focus-visible:ring-1 focus-visible:ring-fg-subtle"
        >
          <Settings2 size={13} strokeWidth={1.75} aria-hidden />
        </button>
      ),
    });
  }
  if (effort) {
    rows.push(
      selectRow(
        "effort",
        t("Effort"),
        effort,
        onSetControl,
        effort.options.map((o) => effortLabel(o.value, o.name)),
      ),
    );
  }
  if (mode) rows.push(selectRow("mode", t("Mode"), mode, onSetControl, modeLabels(mode.options)));
  const extras = (controls?.extra ?? []).filter((c) => !HIDDEN_EXTRAS.has(c.key));

  const label = t("Agent, model and settings");
  return (
    <div
      ref={rootRef}
      className="relative min-w-0"
      onBlur={(e) => {
        // Tabbing past the last row leaves the panel: it closes behind the focus.
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
          style={room === null ? undefined : { maxHeight: room }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }}
          className="absolute bottom-full left-0 z-30 mb-2 flex w-max max-w-[min(36rem,calc(100vw-2rem))] flex-col gap-[5px] overflow-y-auto rounded-lg border border-border-strong bg-elevated p-1.5 shadow-2xl shadow-black/60 transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
        >
          {rows.map((row) => (
            <RowView key={row.key} row={row} />
          ))}
          {extras.length > 0 && (
            <div className="flex flex-wrap gap-[3px]">
              {extras.map((control) =>
                "boolean" in control ? (
                  <button
                    key={control.key}
                    type="button"
                    aria-pressed={control.current}
                    onClick={() => onSetControl(control.key, !control.current)}
                    className={pill(control.current)}
                  >
                    {control.label}
                  </button>
                ) : (
                  <RowView
                    key={control.key}
                    row={selectRow(control.key, control.label, control, onSetControl)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One row of buttons, a radiogroup. Arrows move between its buttons; Enter, Space or a
 * click applies one. Tab moves on to the next row, entered on its current choice.
 */
function RowView({ row }: { row: Row }) {
  const selected = Math.max(
    0,
    row.choices.findIndex((c) => c.value === row.value),
  );
  const [focus, setFocus] = useState(selected);
  const groupRef = useRef<HTMLDivElement>(null);
  const tabStop = row.choices[focus] ? focus : selected;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = row.choices.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = tabStop <= 0 ? last : tabStop - 1;
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = tabStop >= last ? 0 : tabStop + 1;
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    setFocus(next);
    groupRef.current?.querySelectorAll<HTMLElement>("[data-choice]")[next]?.focus();
  };

  return (
    <div className="flex items-center gap-[3px]">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={row.label}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-[3px]"
      >
        {row.choices.map((choice, index) => {
          const checked = choice.value === row.value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={checked}
              data-choice
              tabIndex={index === tabStop ? 0 : -1}
              title={choice.title}
              onFocus={() => setFocus(index)}
              onClick={() => {
                if (!checked) row.onSelect(choice.value);
              }}
              className={pill(checked)}
            >
              {choice.leading}
              {choice.label}
            </button>
          );
        })}
      </div>
      {row.trailing}
    </div>
  );
}

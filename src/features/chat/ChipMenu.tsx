import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { chipClass, type ChipTone } from "./chipStyles";

export interface ChipOption {
  value: string;
  name: string;
  description?: string | null;
  /** Sub-heading inside a section (ACP grouped select options). */
  group?: string;
  /** Small leading mark (an agent glyph, a status dot). */
  leading?: ReactNode;
  /** Quiet text on the right ("Kurulu değil"). */
  meta?: string;
}

/** One single-choice list inside the popover (Agent, Model, Effort ...). */
export interface ChipSection {
  key: string;
  label: string;
  value: string;
  options: ChipOption[];
  onSelect: (value: string) => void;
}

interface ChipMenuProps {
  /** Accessible name of the chip, e.g. "Agent ve model". */
  label: string;
  /** Content of the chip. */
  display: ReactNode;
  leading?: ReactNode;
  sections: ChipSection[];
  /** Opens on mount (fixture screenshots). */
  defaultOpen?: boolean;
  align?: "start" | "end";
  /** Composer chips open upwards; the hero composer has room below. */
  side?: "top" | "bottom";
  /** `quiet` for chips inside the composer, `outline` for the context row under it. */
  tone?: ChipTone;
  className?: string;
}

interface Row {
  section: ChipSection;
  option: ChipOption;
  /** First row of its section (draws the section heading). */
  first: boolean;
}

/**
 * A chip that opens a glass popover with one or more single-choice sections; the
 * composer's agent/model/effort picker and mode selector. Arrows move through every row,
 * Enter/Space pick, Esc/Tab close.
 */
export function ChipMenu({
  label,
  display,
  leading,
  sections,
  defaultOpen = false,
  align = "start",
  side = "top",
  tone = "quiet",
  className,
}: ChipMenuProps) {
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);

  const rows = useMemo<Row[]>(
    () =>
      sections.flatMap((section) =>
        section.options.map((option, i) => ({ section, option, first: i === 0 })),
      ),
    [sections],
  );
  const selectedIndex = Math.max(
    0,
    rows.findIndex((r) => r.option.value === r.section.value),
  );
  const [active, setActive] = useState(selectedIndex);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const pick = (index: number) => {
    const row = rows[index];
    if (!row) return;
    // Several sections: stay open so agent, model and effort can be set in one go.
    if (sections.length === 1) close(true);
    else setActive(index);
    if (row.option.value !== row.section.value) row.section.onSelect(row.option.value);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = rows.length - 1;
    const moves: Record<string, () => number> = {
      ArrowDown: () => (active >= last ? 0 : active + 1),
      ArrowUp: () => (active <= 0 ? last : active - 1),
      Home: () => 0,
      End: () => last,
    };
    if (moves[event.key]) {
      event.preventDefault();
      setActive(moves[event.key]());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            show();
          }
        }}
        className={chipClass(open, tone)}
      >
        {leading}
        <span className="min-w-0 truncate">{display}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className={cn(
            "-mr-0.5 shrink-0 text-fg-subtle transition-transform duration-base ease-out-quint",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKeyDown}
          className={cn(
            "absolute z-30 max-h-[min(26rem,60vh)] w-max max-w-80 min-w-60 overflow-y-auto rounded-xl border border-glass-border bg-glass-strong p-1 shadow-2xl shadow-black/60 backdrop-blur-2xl outline-none",
            "transition-[opacity,translate] duration-base ease-out-quint starting:opacity-0",
            side === "top"
              ? "bottom-full mb-2 starting:translate-y-1"
              : "top-full mt-2 starting:-translate-y-1",
            align === "start" ? "left-0" : "right-0",
          )}
        >
          {rows.map((row, index) => {
            const { option, section } = row;
            const selected = option.value === section.value;
            const prev = rows[index - 1];
            const showGroup = option.group && (row.first || option.group !== prev?.option.group);
            return (
              <Fragment key={`${section.key}:${option.value}`}>
                {row.first && (
                  <div
                    role="presentation"
                    className={cn(
                      "px-2.5 pt-2 pb-1 text-3xs font-medium tracking-wide text-fg-subtle uppercase",
                      index > 0 && "mt-1 border-t border-glass-border pt-2.5",
                    )}
                  >
                    {section.label}
                  </div>
                )}
                {showGroup && (
                  <div role="presentation" className="px-2.5 pt-1.5 pb-0.5 text-3xs text-fg-subtle">
                    {option.group}
                  </div>
                )}
                <div
                  id={`${id}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={index === active ? undefined : () => setActive(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(index)}
                  className={cn(
                    "flex min-h-8 cursor-default items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors duration-100",
                    index === active && "bg-hover/80",
                  )}
                >
                  {option.leading}
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs",
                        selected || index === active ? "text-fg" : "text-fg-muted",
                      )}
                    >
                      {option.name}
                    </span>
                    {option.description && (
                      <span className="mt-px block text-2xs leading-4 text-fg-subtle">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {option.meta && (
                    <span className="shrink-0 text-2xs text-fg-subtle">{option.meta}</span>
                  )}
                  <Check
                    size={13}
                    strokeWidth={2}
                    aria-hidden
                    className={cn("shrink-0 text-fg", selected ? "opacity-100" : "opacity-0")}
                  />
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

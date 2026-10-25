import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import { Search } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { Kbd } from "@/shared/ui/Kbd";
import { setPaletteOpen } from "./paletteGuard";
import { COMMANDS, type Command } from "./registry";
import { flatten, moveIndex, rankCommands, type Ranked } from "./results";

interface CommandPaletteProps {
  onClose: () => void;
}

/**
 * Ctrl+K overlay. Focus stays in the input (options are reached via aria-activedescendant),
 * so trapping focus only means swallowing Tab. Mount it only while open.
 */
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const groups = useMemo(() => rankCommands(COMMANDS, query), [query]);
  const results = useMemo(() => flatten(groups), [groups]);
  // Row index = position in the flattened list that keyboard navigation walks.
  const indexOf = useMemo(() => new Map(results.map((r, i) => [r.item.id, i])), [results]);
  const optionId = (index: number) => `${baseId}-option-${index}`;

  // Focus the input on open and give focus back to whatever had it on close.
  useLayoutEffect(() => {
    setPaletteOpen(true);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    input.current?.focus();
    return () => {
      setPaletteOpen(false);
      previous?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  const execute = (command: Command | undefined) => {
    if (!command) return;
    // Unmount first so focus is restored before the command moves it (e.g. "Yeni not").
    flushSync(onClose);
    command.run();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => moveIndex(i, e.key === "ArrowDown" ? 1 : -1, results.length));
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      execute(results[active]?.item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/60 px-4 pt-[16vh] transition-opacity duration-150 ease-out-quint starting:opacity-0"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Komut paleti"
        onKeyDown={onKeyDown}
        // Clicks on padding, headers or the footer must not pull focus out of the input,
        // or Esc and the arrows would stop working.
        onMouseDown={(e) => {
          if (e.target !== input.current) e.preventDefault();
        }}
        className="flex h-fit max-h-[min(480px,70vh)] w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-border-strong bg-surface shadow-2xl shadow-black/70 transition-[opacity,scale,translate] duration-150 ease-out-quint starting:translate-y-1 starting:scale-[.98] starting:opacity-0"
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${baseId}-list`}
            aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
            aria-autocomplete="list"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Bir komut ara…"
            className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
          />
          <Kbd keys="esc" />
        </div>

        <div
          ref={list}
          id={`${baseId}-list`}
          role="listbox"
          aria-label="Komutlar"
          className="min-h-0 flex-1 scroll-py-1.5 overflow-y-auto py-1.5"
        >
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-fg">Sonuç yok</p>
              <p className="mt-1 truncate text-[12px] text-fg-muted">
                “{query.trim()}” ile eşleşen bir komut bulunamadı.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.group}
                role="group"
                aria-labelledby={`${baseId}-${group.group}`}
                className="pb-1"
              >
                <div
                  id={`${baseId}-${group.group}`}
                  className="px-4 pt-2 pb-1 text-[11px] font-medium tracking-wide text-fg-subtle uppercase"
                >
                  {group.group}
                </div>
                {group.items.map((result) => {
                  const i = indexOf.get(result.item.id) ?? -1;
                  return (
                    <CommandRow
                      key={result.item.id}
                      id={optionId(i)}
                      result={result}
                      active={i === active}
                      onHover={() => setActive(i)}
                      onRun={() => execute(result.item)}
                    />
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex h-9 shrink-0 items-center gap-4 border-t border-border px-4 text-[11px] text-fg-subtle">
          <span className="flex items-center gap-1.5">
            <Kbd keys="up" />
            <Kbd keys="down" />
            gez
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd keys="enter" />
            çalıştır
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd keys="esc" />
            kapat
          </span>
        </div>
      </div>
    </div>
  );
}

interface CommandRowProps {
  id: string;
  result: Ranked<Command>;
  active: boolean;
  onHover: () => void;
  onRun: () => void;
}

function CommandRow({ id, result, active, onHover, onRun }: CommandRowProps) {
  const { item, positions } = result;
  const Icon = item.icon;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-active={active || undefined}
      // Pointer moves (not mouseenter) so a list scrolled by the keyboard keeps its cursor.
      onPointerMove={active ? undefined : onHover}
      // Keep focus in the input.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={cn(
        "group mx-1.5 flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] transition-colors duration-100",
        active ? "bg-hover text-fg" : "text-fg-muted",
      )}
    >
      {Icon && (
        <Icon
          size={15}
          strokeWidth={1.75}
          aria-hidden
          className={cn("shrink-0", active ? "text-fg-muted" : "text-fg-subtle")}
        />
      )}
      <span className="min-w-0 flex-1 truncate">
        <Highlight text={item.title} positions={positions} />
      </span>
      {item.shortcut && <Kbd keys={item.shortcut} className="shrink-0" />}
    </div>
  );
}

/** Matched characters read brighter than the rest of the title. */
function Highlight({ text, positions }: { text: string; positions: number[] }) {
  if (positions.length === 0) return text;
  const hit = new Set(positions);
  const parts: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === hit.has(i)) last.text += text[i];
    else parts.push({ text: text[i], hit: hit.has(i) });
  }
  return parts.map((p, i) =>
    p.hit ? (
      <span key={i} className="font-medium text-fg">
        {p.text}
      </span>
    ) : (
      p.text
    ),
  );
}

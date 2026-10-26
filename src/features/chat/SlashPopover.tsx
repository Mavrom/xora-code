import { Fragment } from "react";
import { cn } from "@/shared/ui/cn";
import { slashOptionId, type SlashItem } from "./slash";

interface SlashPopoverProps {
  id: string;
  items: SlashItem[];
  active: number;
  onHover: (index: number) => void;
  onPick: (item: SlashItem) => void;
}

const GROUP_LABEL = { agent: "Agent komutları", xora: "Xora" } as const;

/**
 * Command list above the composer while the message starts with "/". Focus stays in the
 * textarea (it owns aria-activedescendant); rows only respond to the pointer.
 */
export function SlashPopover({ id, items, active, onHover, onPick }: SlashPopoverProps) {
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Komutlar"
      className="absolute inset-x-0 bottom-full z-30 mb-2 max-h-72 overflow-y-auto rounded-xl border border-glass-border bg-glass-strong p-1 shadow-2xl shadow-black/60 backdrop-blur-2xl transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
    >
      {items.length === 0 ? (
        <p className="px-3 py-2.5 text-xs text-fg-subtle">Eşleşen komut yok</p>
      ) : (
        items.map((item, index) => (
          <Fragment key={item.id}>
            {item.group !== items[index - 1]?.group && (
              <div
                role="presentation"
                className={cn(
                  "px-2.5 pt-2 pb-1 text-3xs font-medium tracking-wide text-fg-subtle uppercase",
                  index > 0 && "mt-1 border-t border-glass-border",
                )}
              >
                {GROUP_LABEL[item.group]}
              </div>
            )}
            <div
              id={slashOptionId(id, index)}
              role="option"
              aria-selected={index === active}
              onPointerMove={index === active ? undefined : () => onHover(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(item)}
              className={cn(
                "flex h-8 cursor-default items-center gap-3 rounded-lg px-2.5 transition-colors duration-100",
                index === active && "bg-hover/80",
              )}
            >
              <span className="shrink-0 font-mono text-xs text-fg-muted">
                /<Highlight text={item.name} positions={item.positions} />
              </span>
              <span className="min-w-0 flex-1 truncate text-2xs text-fg-subtle">
                {item.description}
              </span>
            </div>
          </Fragment>
        ))
      )}
    </div>
  );
}

function Highlight({ text, positions }: { text: string; positions: number[] }) {
  if (positions.length === 0) return text;
  const hit = new Set(positions);
  return [...text].map((ch, i) =>
    hit.has(i) ? (
      <span key={i} className="text-fg">
        {ch}
      </span>
    ) : (
      ch
    ),
  );
}

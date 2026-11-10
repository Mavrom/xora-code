import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { t } from "@/shared/i18n";

/**
 * The row's title as a text field: Enter keeps the name, Esc gives up, leaving the field
 * keeps it too. A blank name hands the title back to the agent.
 */
export function RenameField({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (name: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };
  return (
    <input
      autoFocus
      aria-label={t("Chat name")}
      value={value}
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(value.trim());
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(null);
        }
      }}
      onBlur={() => finish(value.trim())}
      placeholder={t("Uses the agent's title")}
      className="h-8 w-full rounded-lg bg-white/[0.06] px-2.5 text-[13px] text-fg outline-none ring-1 ring-white/15 placeholder:text-fg-subtle"
    />
  );
}

interface RowActionProps {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

export function RowAction({ icon: Icon, label, danger, onClick }: RowActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-6 place-items-center rounded-md text-fg-subtle transition-colors duration-fast",
        danger ? "hover:bg-red-500/15 hover:text-red-300" : "hover:bg-white/[0.08] hover:text-fg",
      )}
    >
      <Icon size={13} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

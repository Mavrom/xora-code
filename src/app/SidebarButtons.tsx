import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { describeShortcut } from "@/shared/ui/keys";
import type { ActionId } from "@/features/keymap/actions";
import { PLATFORM, useShortcut } from "@/features/keymap/keymap";

export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="rounded-full bg-white/[0.08] px-1.5 text-[11px] leading-4.5 font-medium text-fg-muted tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  /** The keymap action that opens this view; its binding goes in the tooltip. */
  action: ActionId;
  active: boolean;
  meta?: ReactNode;
  onClick: () => void;
}

export function NavItem({ icon: Icon, label, action, active, meta, onClick }: NavItemProps) {
  const shortcut = useShortcut(action);
  const keys = shortcut ? describeShortcut(shortcut, PLATFORM) : undefined;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      aria-keyshortcuts={keys}
      title={keys ? `${label} (${keys})` : label}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-[background-color,color] duration-fast",
        active
          ? "bg-white/[0.07] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]"
          : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
      )}
    >
      <Icon
        size={15}
        strokeWidth={1.75}
        aria-hidden
        className={active ? "text-fg" : "text-fg-subtle"}
      />
      {label}
      {meta && <span className="ml-auto">{meta}</span>}
    </button>
  );
}

interface BarButtonProps {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

export function BarButton({ icon: Icon, label, disabled, onClick }: BarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-white/[0.05] hover:text-fg disabled:text-fg-subtle/40 disabled:hover:bg-transparent"
    >
      <Icon size={15} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

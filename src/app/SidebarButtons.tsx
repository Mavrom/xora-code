import type { LucideIcon } from "lucide-react";

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

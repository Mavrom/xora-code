import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional call to action rendered under the text. */
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      {Icon && (
        <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-fg-subtle">
          <Icon size={18} strokeWidth={1.5} aria-hidden />
        </div>
      )}
      <p className="text-[13px] font-medium text-fg">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-64 text-[12px] leading-relaxed text-fg-subtle">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

import { RotateCcw } from "lucide-react";
import { t } from "@/shared/i18n";

/**
 * The mark beside a setting that differs from its default: a dot that turns into a reset
 * arrow on hover, and puts the setting back when clicked.
 */
export function ResetButton({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <button
      type="button"
      title={t("Reset to default")}
      aria-label={t("{label}: reset to default", { label })}
      onClick={onReset}
      className="group/reset inline-flex h-5 items-center gap-1 rounded-md px-1 text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-fg-muted group-hover/reset:hidden" />
      <RotateCcw size={11} strokeWidth={2} aria-hidden className="hidden group-hover/reset:block" />
    </button>
  );
}

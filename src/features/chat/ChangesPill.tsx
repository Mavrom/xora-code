import { useMemo } from "react";
import type { ReviewChange } from "@/features/agents/reducer";
import { openReview } from "@/app/sidebarView";
import { useUiStore } from "@/app/uiStore";
import { DiffStat } from "./DiffPreview";
import { totalStats } from "./turnChanges";
import { t } from "@/shared/i18n";

interface ChangesPillProps {
  changes: ReviewChange[];
  onAccept: () => void;
}

/**
 * After a turn, one slim line above the composer: how much the agent changed, "Accept" and
 * "Review" (the sidebar's Changes view, where each file can be opened, accepted or
 * reverted). It steps aside while that view is on screen, which shows the same files.
 */
export function ChangesPill({ changes, onAccept }: ChangesPillProps) {
  const stats = useMemo(() => totalStats(changes), [changes]);
  const reviewing = useUiStore((s) => s.sidebarShown && s.sidebarView === "changes");
  if (changes.length === 0 || reviewing) return null;
  return (
    <section
      aria-label={t("Changes")}
      className="mb-2 flex h-9 items-center gap-2 rounded-xl border border-glass-border bg-glass pr-1 pl-3.5 text-xs backdrop-blur-xl transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
    >
      <span className="min-w-0 truncate text-fg-muted">
        {changes.length === 1 ? t("1 file changed") : t("{n} files changed", { n: changes.length })}
      </span>
      <DiffStat {...stats} />
      <span className="flex-1" />
      <button
        type="button"
        onClick={onAccept}
        className="inline-flex h-7 shrink-0 items-center rounded-lg px-2.5 text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
      >
        {t("Accept")}
      </button>
      <button
        type="button"
        onClick={openReview}
        className="inline-flex h-7 shrink-0 items-center rounded-lg bg-glass-border px-3 font-medium text-fg transition-colors duration-fast hover:bg-border-strong"
      >
        {t("Review")}
      </button>
    </section>
  );
}

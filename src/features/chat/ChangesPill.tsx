import { useMemo } from "react";
import type { ReviewChange } from "@/features/agents/reducer";
import { useReviewStore } from "@/features/review/store";
import { DiffStat } from "./DiffPreview";
import { diffLines, diffStats } from "./diff";
import { t } from "@/shared/i18n";

interface ChangesPillProps {
  changes: ReviewChange[];
  onAccept: () => void;
}

/** "+12 −4" over every change whose two sides are known. */
function totalStats(changes: readonly ReviewChange[]) {
  let added = 0;
  let removed = 0;
  for (const c of changes) {
    if (c.oldText === undefined || c.newText === undefined) continue;
    const s = diffStats(diffLines(c.oldText, c.newText));
    added += s.added;
    removed += s.removed;
  }
  return { added, removed };
}

/**
 * After a turn, one slim line above the composer: what the agent changed, "Review" (the
 * Review panel, on the first file) and "Accept". The file list lives in the panel.
 */
export function ChangesPill({ changes, onAccept }: ChangesPillProps) {
  const stats = useMemo(() => totalStats(changes), [changes]);
  // While the panel is open it says all of this, with its own Accept.
  const reviewing = useReviewStore((s) => s.open);
  if (changes.length === 0 || reviewing) return null;
  return (
    <section
      aria-label={t("Changes")}
      className="mb-2 flex h-9 items-center gap-2 rounded-xl border border-glass-border bg-glass pr-1 pl-3.5 text-xs backdrop-blur-xl transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
    >
      <span className="text-fg-muted">{t("{n} file(s) changed", { n: changes.length })}</span>
      <DiffStat {...stats} />
      <span className="flex-1" />
      <button
        type="button"
        onClick={onAccept}
        className="inline-flex h-7 items-center rounded-lg px-2.5 text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
      >
        {t("Accept")}
      </button>
      <button
        type="button"
        onClick={() => useReviewStore.getState().show({ kind: "turn", path: changes[0].path })}
        className="inline-flex h-7 items-center rounded-lg bg-white/[0.07] px-3 font-medium text-fg transition-colors duration-fast hover:bg-white/[0.11]"
      >
        {t("Review")}
      </button>
    </section>
  );
}

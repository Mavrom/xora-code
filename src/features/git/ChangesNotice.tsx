import { X } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { useChangesStore } from "./changesStore";
import { t } from "@/shared/i18n";

/**
 * The Changes view's notice line: the last action's result or error (a git action, or
 * accepting or reverting a turn's file), until dismissed or the next action.
 */
export function ChangesNotice({ className }: { className?: string }) {
  const notice = useChangesStore((s) => s.notice);
  const busy = useChangesStore((s) => s.busy);
  const store = useChangesStore.getState;
  if (!notice || busy) return null;
  return (
    <div
      role={notice.error ? "alert" : "status"}
      className={cn(
        className,
        "mt-1 flex items-start gap-1 rounded-md border px-2 py-1.5 text-2xs",
        notice.error
          ? "border-danger/25 bg-danger/[0.06] text-danger"
          : "border-border bg-elevated text-fg-muted",
      )}
    >
      <p className="max-h-24 min-w-0 flex-1 overflow-y-auto break-words whitespace-pre-line select-text">
        {notice.text}
      </p>
      <button
        type="button"
        aria-label={t("Dismiss")}
        title={t("Dismiss")}
        onClick={() => store().setNotice(null)}
        className="-my-0.5 grid size-5 shrink-0 place-items-center rounded-sm text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
      >
        <X size={12} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

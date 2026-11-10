import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpFromLine, GitBranch, X } from "lucide-react";
import { IconButton } from "@/shared/ui/IconButton";
import { cn } from "@/shared/ui/cn";
import type { GitStatus } from "./ipc";
import { useChangesStore } from "./changesStore";
import { t } from "@/shared/i18n";

/** Branch, ahead/behind against its upstream, Pull and Push; then the last action's result. */
export function BranchBar({ status }: { status: GitStatus }) {
  const busy = useChangesStore((s) => s.busy);
  const notice = useChangesStore((s) => s.notice);
  const store = useChangesStore.getState;
  const { branch, head, upstream, ahead, behind } = status;
  const name = branch ?? (head ? t("Detached at {head}", { head }) : t("Detached HEAD"));

  return (
    <div className="shrink-0 px-2.5 pb-2">
      <div className="flex h-8 items-center gap-1.5 pl-1">
        <GitBranch size={13} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
        <span
          className="min-w-0 truncate text-xs text-fg"
          title={upstream ? `${name} → ${upstream}` : name}
        >
          {name}
        </span>
        {upstream && (ahead > 0 || behind > 0) && (
          <span className="flex shrink-0 items-center gap-1.5 text-2xs text-fg-muted tabular-nums">
            {ahead > 0 && (
              <span
                className="inline-flex items-center"
                title={t("{n} to push", { n: ahead })}
                aria-label={t("{n} to push", { n: ahead })}
              >
                <ArrowUp size={11} strokeWidth={2} aria-hidden />
                {ahead}
              </span>
            )}
            {behind > 0 && (
              <span
                className="inline-flex items-center"
                title={t("{n} to pull", { n: behind })}
                aria-label={t("{n} to pull", { n: behind })}
              >
                <ArrowDown size={11} strokeWidth={2} aria-hidden />
                {behind}
              </span>
            )}
          </span>
        )}
        <span className="flex-1" />
        <IconButton
          size="sm"
          icon={ArrowDownToLine}
          label={upstream ? t("Pull (fast-forward only)") : t("Pull: the branch has no upstream")}
          disabled={!upstream || busy !== null}
          onClick={() => void store().pull()}
        />
        <IconButton
          size="sm"
          icon={ArrowUpFromLine}
          label={upstream ? t("Push") : t("Publish branch")}
          disabled={!branch || busy !== null}
          onClick={() => void store().push()}
        />
      </div>
      {(busy === "push" || busy === "pull") && (
        <p role="status" className="shimmer px-1 text-2xs">
          {busy === "push" ? t("Pushing…") : t("Pulling…")}
        </p>
      )}
      {notice && !busy && (
        <div
          role={notice.error ? "alert" : "status"}
          className={cn(
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
      )}
    </div>
  );
}

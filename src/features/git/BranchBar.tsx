import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpFromLine, GitBranch } from "lucide-react";
import { IconButton } from "@/shared/ui/IconButton";
import type { GitStatus } from "./ipc";
import { useChangesStore } from "./changesStore";
import { ChangesNotice } from "./ChangesNotice";
import { t } from "@/shared/i18n";

/** Branch, ahead/behind against its upstream, Pull and Push; then the last action's result. */
export function BranchBar({ status }: { status: GitStatus }) {
  const busy = useChangesStore((s) => s.busy);
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
      <ChangesNotice />
    </div>
  );
}

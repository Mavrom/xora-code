import { useId, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { isImeComposing } from "@/shared/lib/ime";
import { Button } from "@/shared/ui/Button";
import { Kbd } from "@/shared/ui/Kbd";
import { commitBlocker } from "./changes";
import { useChangesStore } from "./changesStore";
import { t } from "@/shared/i18n";

/** Message field and Commit button; Ctrl+Enter (Cmd+Enter) commits from the field. */
export function CommitBox() {
  const status = useChangesStore((s) => s.status);
  const busy = useChangesStore((s) => s.busy);
  const [message, setMessage] = useState("");
  const reasonId = useId();
  const blocker = commitBlocker(status, message);
  const disabled = blocker !== null || busy !== null;

  const commit = async () => {
    if (disabled) return;
    if (await useChangesStore.getState().commit(message)) setMessage("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || isImeComposing(e.nativeEvent)) return;
    e.preventDefault();
    void commit();
  };

  return (
    <div className="shrink-0 px-2.5 pb-2">
      <div className="rounded-md border border-border bg-elevated transition-[border-color,box-shadow] duration-200 ease-out-quint focus-within:border-border-strong focus-within:shadow-halo">
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={t("Commit message")}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          placeholder={t("Commit message")}
          spellCheck={false}
          className="block max-h-40 min-h-13 w-full resize-none bg-transparent px-2.5 py-2 text-ui text-fg [field-sizing:content] outline-none placeholder:text-fg-subtle focus-visible:outline-none"
        />
      </div>
      <Button
        variant="primary"
        icon={Check}
        disabled={disabled}
        aria-describedby={blocker ? reasonId : undefined}
        onClick={() => void commit()}
        className="mt-2 w-full"
      >
        {busy === "commit" ? t("Committing…") : t("Commit")}
      </Button>
      {blocker ? (
        <p id={reasonId} className="mt-1.5 px-0.5 text-2xs text-fg-subtle">
          {blocker}
        </p>
      ) : (
        <p className="mt-1.5 flex items-center gap-1 px-0.5 text-2xs text-fg-subtle" aria-hidden>
          <Kbd keys="mod+enter" />
          <span>{t("commits from the message field")}</span>
        </p>
      )}
    </div>
  );
}

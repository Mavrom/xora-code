import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { t } from "@/shared/i18n";

export type ConfirmChoice = "save" | "discard" | "cancel";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** Primary action (Enter). Default "Kaydet". */
  confirmLabel?: string;
  /** Secondary, destructive action. Default "Kaydetme"; `null` hides it. */
  discardLabel?: string | null;
  /** Default "İptal" (Esc). */
  cancelLabel?: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
  onChoose: (choice: ConfirmChoice) => void;
}

/** Three-way confirmation: Kaydet (primary, focused, Enter) / Kaydetme / İptal (Esc). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = t("Save"),
  discardLabel = t("Don't save"),
  cancelLabel = t("Cancel"),
  onChoose,
}: ConfirmDialogProps) {
  // A second click while the dialog animates out must not report twice.
  const [done, setDone] = useState(false);
  const choose = (choice: ConfirmChoice) => {
    if (done) return;
    setDone(true);
    onChoose(choice);
  };

  return (
    <Dialog
      role="alertdialog"
      title={title}
      description={message}
      onCancel={() => choose("cancel")}
      actions={
        <>
          {discardLabel !== null && (
            <Button variant="ghost" className="mr-auto" onClick={() => choose("discard")}>
              {discardLabel}
            </Button>
          )}
          <Button variant="secondary" onClick={() => choose("cancel")}>
            {cancelLabel}
          </Button>
          <Button variant="primary" data-autofocus onClick={() => choose("save")}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

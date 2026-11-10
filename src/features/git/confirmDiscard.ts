import { confirmDialog } from "@/shared/ui/confirm";
import { discardPrompt, type ChangeRow } from "./changes";
import { t } from "@/shared/i18n";

/** Asks before throwing work away; resolves true when the user confirmed. */
export async function confirmDiscard(rows: readonly ChangeRow[]): Promise<boolean> {
  const { title, message } = discardPrompt(rows);
  const choice = await confirmDialog({
    title,
    message,
    confirmLabel: t("Discard"),
    discardLabel: null,
  });
  return choice === "save";
}

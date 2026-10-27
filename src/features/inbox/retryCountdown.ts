/** Whole seconds until `nextRetryAt` (rounded up), never negative. */
import { t } from "@/shared/i18n";

export function secondsUntil(nextRetryAt: number, now: number): number {
  return Math.max(0, Math.ceil((nextRetryAt - now) / 1_000));
}

/** Calm save-failure line, e.g. "Kaydedilemedi · 15 sn içinde tekrar denenecek". */
export function saveErrorMessage(nextRetryAt: number | null, now: number): string {
  if (nextRetryAt === null) return t("Could not save · will retry");
  const seconds = secondsUntil(nextRetryAt, now);
  return seconds > 0
    ? t("Could not save · retrying in {seconds}s", { seconds })
    : t("Could not save · retrying…");
}

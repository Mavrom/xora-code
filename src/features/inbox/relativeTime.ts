import { localeOf } from "@/shared/i18n";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const relative = new Intl.RelativeTimeFormat(localeOf(), { numeric: "auto" });
const narrow = new Intl.RelativeTimeFormat(localeOf(), { style: "narrow" });
const dayMonth = new Intl.DateTimeFormat(localeOf(), { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat(localeOf(), {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "5 dk. önce" -> "5 dk": a quiet, compact label for list rows. */
const compact = (value: number, unit: "minute" | "hour") =>
  narrow
    .format(-value, unit)
    .replace(/\s*(önce|ago)$/, "")
    .replace(/\.$/, "");

const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);

/** Compact Turkish relative time: "şimdi", "5 dk", "2 sa", "dün", "12 Eki", "3 Oca 2025". */
export function relativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  if (diff < MINUTE) return relative.format(0, "second");
  if (diff < HOUR) return compact(Math.floor(diff / MINUTE), "minute");

  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / (24 * HOUR));
  if (days === 0) return compact(Math.floor(diff / HOUR), "hour");
  if (days === 1) return relative.format(-1, "day");

  const sameYear = new Date(timestamp).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dayMonth : dayMonthYear).format(timestamp);
}

// Small display formatters for the conversation (durations, token counts, context fill).
import { localeOf, t } from "@/shared/i18n";

/** "0,4 sn" under ten seconds, then "12 sn", "1 dk 5 sn", "2 dk". */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 10_000) {
    const tenths = Math.max(1, Math.round(safe / 100)) / 10;
    return t("{s}s", { s: tenths.toLocaleString(localeOf(), { maximumFractionDigits: 1 }) });
  }
  const seconds = Math.round(safe / 1000);
  if (seconds < 60) return t("{s}s", { s: seconds });
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? t("{m}m", { m: minutes }) : t("{m}m {s}s", { m: minutes, s: rest });
}

/** Compact token counts: 950, 12,3k, 200k, 1,2M. */
export function formatTokens(count: number): string {
  const fmt = (value: number) => value.toLocaleString(localeOf(), { maximumFractionDigits: 1 });
  if (count < 1000) return String(Math.max(0, Math.round(count)));
  if (count < 1_000_000) {
    const k = count / 1000;
    return `${k >= 100 ? Math.round(k) : fmt(Math.round(k * 10) / 10)}k`;
  }
  return `${fmt(Math.round(count / 100_000) / 10)}M`;
}

/** Context window fill in [0, 1]; 0 when the size is unknown. */
export function contextRatio(used: number, size: number): number {
  if (!(size > 0)) return 0;
  return Math.min(1, Math.max(0, used / size));
}

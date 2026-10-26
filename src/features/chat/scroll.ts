/** Distance from the bottom (px) that still counts as "following" the stream. */
export const STICK_THRESHOLD = 48;

/** Whether a scroll container is at (or close enough to) its bottom edge. */
export function isNearBottom(
  el: Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">,
  threshold = STICK_THRESHOLD,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

/** Vertical gap class before an item, by what precedes it: tool steps sit tight together. */
export function gapBefore(prev: string | undefined, kind: string): string {
  if (prev === undefined) return "";
  if (kind === "user") return "mt-8";
  if (prev === "tool" && kind === "tool") return "mt-0.5";
  if ((prev === "thought" || prev === "tool") && (kind === "tool" || kind === "thought")) {
    return "mt-1.5";
  }
  return "mt-4";
}

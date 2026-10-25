import { useLayoutEffect, type RefObject } from "react";

/**
 * Auto-growing textareas.
 *
 * Chromium (WebView2) sizes a textarea to its content with `field-sizing: content`; WebKit
 * (macOS / Linux webviews) does not support it yet, so there we sync the height from
 * `scrollHeight` in JS. Consumers keep the `[field-sizing:content]` class and their CSS
 * `min-h-*` / `max-h-*` caps; `useAutoGrow` only steps in where the CSS can't.
 */

export interface AutoGrowMetrics {
  /** `scrollHeight` measured with `height: auto` (content plus vertical padding). */
  scrollHeight: number;
  /** Computed line height in px. */
  lineHeight: number;
  /** Top + bottom padding in px. */
  paddingBlock: number;
  /** Top + bottom border in px. */
  borderBlock: number;
  /** CSS `min-height` in px (border box), if any. */
  minHeight?: number;
  /** CSS `max-height` in px (border box), if any. */
  maxHeight?: number;
  /** Optional cap in text rows, combined with `maxHeight` (the smaller wins). */
  maxRows?: number;
}

export interface AutoGrowSize {
  /** Border-box height to apply, in whole px. */
  height: number;
  /** True when the content is taller than the cap, so the field should scroll. */
  overflow: boolean;
}

/** Pure height computation for the JS fallback (border-box sizing, as Tailwind's preflight sets). */
export function computeAutoGrowHeight(metrics: AutoGrowMetrics): AutoGrowSize {
  const { scrollHeight, lineHeight, paddingBlock, borderBlock, minHeight = 0, maxRows } = metrics;
  const content = scrollHeight + borderBlock;
  let cap = metrics.maxHeight ?? Number.POSITIVE_INFINITY;
  if (maxRows !== undefined && maxRows > 0 && lineHeight > 0) {
    cap = Math.min(cap, maxRows * lineHeight + paddingBlock + borderBlock);
  }
  // A min-height above the cap still wins, matching how CSS resolves the two.
  const height = Math.max(minHeight, Math.min(content, cap));
  return { height: Math.ceil(height), overflow: content > cap + 0.5 };
}

let fieldSizingSupport: boolean | undefined;

/** Whether the engine sizes textareas to content natively (`field-sizing: content`). */
export function supportsFieldSizing(): boolean {
  if (fieldSizingSupport === undefined) {
    fieldSizingSupport =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("field-sizing", "content");
  }
  return fieldSizingSupport;
}

/** Parses a computed length such as `"56px"`; `"none"` / `"auto"` / `%` give `undefined`. */
export function parsePx(value: string): number | undefined {
  if (!value.endsWith("px")) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

type BoxMetrics = Omit<AutoGrowMetrics, "scrollHeight" | "maxRows">;

function readBox(el: HTMLTextAreaElement): BoxMetrics {
  const style = getComputedStyle(el);
  const px = (value: string) => parsePx(value) ?? 0;
  return {
    // `line-height: normal` is not a length; ~1.5em is close enough for a cap.
    lineHeight: parsePx(style.lineHeight) ?? (parsePx(style.fontSize) ?? 13) * 1.5,
    paddingBlock: px(style.paddingTop) + px(style.paddingBottom),
    borderBlock: px(style.borderTopWidth) + px(style.borderBottomWidth),
    minHeight: parsePx(style.minHeight),
    maxHeight: parsePx(style.maxHeight),
  };
}

function syncHeight(el: HTMLTextAreaElement, maxRows: number | undefined): void {
  const box = readBox(el);
  // Collapse first so scrollHeight reports the content, not the previous height.
  el.style.height = "auto";
  const { height, overflow } = computeAutoGrowHeight({
    ...box,
    scrollHeight: el.scrollHeight,
    maxRows,
  });
  el.style.height = `${height}px`;
  el.style.overflowY = overflow ? "auto" : "hidden";
}

export interface AutoGrowOptions {
  /** Extra cap in text rows on top of the CSS `max-height`. */
  maxRows?: number;
}

/**
 * Keeps a textarea as tall as its content. Pass the controlled `value` so the height follows
 * every edit; width changes (panel resize, wrapping) are tracked too.
 *
 * Usage: `const ref = useRef<HTMLTextAreaElement>(null); useAutoGrow(ref, value, { maxRows: 8 });`
 * and keep `rows={1}` plus the `[field-sizing:content]` class on the element.
 */
export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { maxRows }: AutoGrowOptions = {},
): void {
  const native = supportsFieldSizing();

  // Native path: CSS does the growing; only translate `maxRows` into a max-height.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !native || maxRows === undefined) return;
    const { lineHeight, paddingBlock, borderBlock } = readBox(el);
    el.style.maxHeight = `${Math.ceil(maxRows * lineHeight + paddingBlock + borderBlock)}px`;
    return () => {
      el.style.maxHeight = "";
    };
  }, [ref, native, maxRows]);

  // Fallback path: sync the height on every value change.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || native) return;
    syncHeight(el, maxRows);
  }, [ref, native, value, maxRows]);

  // Fallback path: re-measure when the width changes, since wrapping changes the height.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || native || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return; // ignore our own height writes
      width = el.clientWidth;
      syncHeight(el, maxRows);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, native, maxRows]);
}

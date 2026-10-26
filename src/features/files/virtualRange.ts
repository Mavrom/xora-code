/** Half-open range `[start, end)` of row indices to render. */
export interface RowRange {
  start: number;
  end: number;
}

/**
 * Rows to render for a fixed-height list: the ones intersecting the viewport plus
 * `overscan` on each side, clamped to `[0, count)`.
 */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan: number,
): RowRange {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const last = Math.ceil((Math.max(0, scrollTop) + Math.max(0, viewportHeight)) / rowHeight);
  return {
    start: Math.max(0, Math.min(count, first - overscan)),
    end: Math.max(0, Math.min(count, last + overscan)),
  };
}

/**
 * Scroll position that brings row `index` fully into view with the least movement, or
 * `null` when it already is. `offset` is the space above the first row (list padding).
 */
export function scrollToReveal(
  index: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  offset = 0,
): number | null {
  const top = offset + index * rowHeight;
  const bottom = top + rowHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return null;
}

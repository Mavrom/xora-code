/**
 * Next index for list-style keyboard navigation (radio groups, listboxes):
 * arrows wrap around, Home/End jump. `null` for keys that do not move.
 */
export function stepIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** Parses typed text into an integer inside [min, max]; `null` when it is not a number. */
export function parseClamped(text: string, min: number, max: number): number | null {
  const n = Number.parseInt(text.trim(), 10);
  if (Number.isNaN(n)) return null;
  return Math.min(max, Math.max(min, n));
}

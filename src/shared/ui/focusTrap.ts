/** Elements a dialog's focus trap cycles through (visible and not disabled). */
export const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Index that Tab (or Shift+Tab) should move to inside a trap of `count` elements, wrapping
 * at both ends. `current` is -1 when focus is outside the trap: Tab then lands on the
 * first element and Shift+Tab on the last.
 */
export function nextTrapIndex(current: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0 || current >= count) return backwards ? count - 1 : 0;
  return (current + (backwards ? -1 : 1) + count) % count;
}

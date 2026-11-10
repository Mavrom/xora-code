/**
 * Share of the picture's light that may reach the conversation column, after the user's
 * own dim. Half keeps the picture plainly there while `fg-muted` stays >= 4.5:1 and
 * `fg-subtle` meta text >= 3:1 over the brightest part of the default picture.
 */
const COLUMN_LIGHT = 0.5;

/**
 * How dark the readability scrim behind a conversation is (black alpha, 0-1), given the
 * wallpaper's `dim` (0-100). It only makes up what the dim leaves: a dim of 50 or more
 * already darkens the picture enough, so the scrim disappears.
 */
export function scrimAlpha(dim: number): number {
  const kept = 1 - Math.min(100, Math.max(0, dim)) / 100;
  if (kept <= COLUMN_LIGHT) return 0;
  return Math.round((1 - COLUMN_LIGHT / kept) * 1000) / 1000;
}

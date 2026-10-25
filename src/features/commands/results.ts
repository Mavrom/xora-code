import { fuzzyMatch } from "./fuzzy";

export interface Rankable {
  title: string;
  group: string;
  /** Hidden from the palette while this returns false. */
  when?: () => boolean;
}

export interface Ranked<T> {
  item: T;
  score: number;
  /** Matched character indices in `item.title`. */
  positions: number[];
}

export interface ResultGroup<T> {
  group: string;
  items: Ranked<T>[];
}

/**
 * Filters by `when` and the fuzzy query, then groups. Empty query: registry order.
 * Otherwise items sort by score (ties keep registry order) and groups follow their best item.
 */
export function rankCommands<T extends Rankable>(commands: T[], query: string): ResultGroup<T>[] {
  const ranked: Ranked<T>[] = [];
  for (const item of commands) {
    if (item.when && !item.when()) continue;
    const match = fuzzyMatch(query, item.title);
    if (match) ranked.push({ item, ...match });
  }
  ranked.sort((a, b) => b.score - a.score);

  const groups = new Map<string, Ranked<T>[]>();
  for (const r of ranked) {
    const list = groups.get(r.item.group);
    if (list) list.push(r);
    else groups.set(r.item.group, [r]);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

/** Results in on-screen order; keyboard navigation walks this list. */
export const flatten = <T>(groups: ResultGroup<T>[]) => groups.flatMap((g) => g.items);

/** Moves a list cursor by `delta`, wrapping around; 0 for an empty list. */
export const moveIndex = (index: number, delta: number, length: number) =>
  length === 0 ? 0 : (((index + delta) % length) + length) % length;

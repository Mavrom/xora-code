// Pure tab-list logic for the terminal panel (kept free of React and xterm for tests).

export type TabStatus = "starting" | "running" | "exited" | "failed";

export interface TerminalTab {
  /** Stable local key; the Rust session id arrives later and may never arrive. */
  key: number;
  /** Small number shown when tabs share a shell name; reused after a tab closes. */
  seq: number;
  /** Shell name reported by the backend (`pwsh`, `zsh`); null until spawned. */
  shell: string | null;
  status: TabStatus;
  exitCode?: number | null;
}

/** Lowest positive number not used by an open tab. */
export function nextSeq(tabs: readonly TerminalTab[]): number {
  const used = new Set(tabs.map((t) => t.seq));
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

/**
 * The tab that becomes active after `closing` closes: unchanged unless the active tab
 * closes, then its right neighbour, else its left one, else none.
 */
export function activeAfterClose(
  tabs: readonly TerminalTab[],
  closing: number,
  active: number | null,
): number | null {
  if (active !== closing) return active;
  const index = tabs.findIndex((t) => t.key === closing);
  if (index === -1) return active;
  const next = tabs[index + 1] ?? tabs[index - 1];
  return next ? next.key : null;
}

/**
 * Visible tab names: the shell name, plus the tab's number when another tab has the
 * same name. "Terminal" stands in until the shell is known.
 */
export function tabLabels(tabs: readonly TerminalTab[]): Map<number, string> {
  const name = (t: TerminalTab) => t.shell ?? "Terminal";
  const counts = new Map<string, number>();
  for (const t of tabs) counts.set(name(t), (counts.get(name(t)) ?? 0) + 1);
  return new Map(
    tabs.map((t) => [t.key, (counts.get(name(t)) ?? 0) > 1 ? `${name(t)} ${t.seq}` : name(t)]),
  );
}

/** The tab key `delta` steps from `active`, wrapping around (Ctrl+PageUp/PageDown). */
export function cycleTab(
  tabs: readonly TerminalTab[],
  active: number | null,
  delta: number,
): number | null {
  if (tabs.length === 0) return null;
  const index = Math.max(
    0,
    tabs.findIndex((t) => t.key === active),
  );
  return tabs[(((index + delta) % tabs.length) + tabs.length) % tabs.length].key;
}

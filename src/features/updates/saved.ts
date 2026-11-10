// What the update check remembers between starts, in localStorage (a per-machine UI
// memory, not a setting): when it last asked, the latest release it saw, and the
// version whose notice was dismissed.
import { isReleaseUrl, type Release } from "./releaseCheck";
import { parseVersion } from "./version";

export const SAVED_KEY = "xora.updates";

export interface Saved {
  /** Epoch ms of the last request, successful or not. */
  lastCheck: number | null;
  /** The latest release the last successful request saw. */
  latest: Release | null;
  /** The version whose notice was dismissed; a later one shows again. */
  dismissed: string | null;
}

export const EMPTY_SAVED: Saved = { lastCheck: null, latest: null, dismissed: null };

export type SavedStorage = Pick<Storage, "getItem" | "setItem">;

function asRelease(value: unknown): Release | null {
  if (typeof value !== "object" || value === null) return null;
  const { version, url } = value as Record<string, unknown>;
  if (typeof version !== "string" || parseVersion(version) === null) return null;
  if (typeof url !== "string" || !isReleaseUrl(url)) return null;
  return { version, url };
}

/** The stored state; anything missing or malformed reads as empty, field by field. */
export function parseSaved(raw: string | null): Saved {
  let value: unknown;
  try {
    value = raw === null ? null : JSON.parse(raw);
  } catch {
    return EMPTY_SAVED;
  }
  if (typeof value !== "object" || value === null) return EMPTY_SAVED;
  const { lastCheck, latest, dismissed } = value as Record<string, unknown>;
  return {
    lastCheck: typeof lastCheck === "number" && Number.isFinite(lastCheck) ? lastCheck : null,
    latest: asRelease(latest),
    dismissed: typeof dismissed === "string" ? dismissed : null,
  };
}

/** `localStorage` when reachable; access itself can throw (blocked site data). */
export function defaultStorage(): SavedStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readSaved(storage: SavedStorage | null = defaultStorage()): Saved {
  try {
    return parseSaved(storage?.getItem(SAVED_KEY) ?? null);
  } catch {
    return EMPTY_SAVED;
  }
}

/** Merges `patch` into the stored state. Best effort: a failed write is ignored. */
export function writeSaved(
  patch: Partial<Saved>,
  storage: SavedStorage | null = defaultStorage(),
): void {
  try {
    storage?.setItem(SAVED_KEY, JSON.stringify({ ...readSaved(storage), ...patch }));
  } catch {
    // Not remembered; the next start simply asks again.
  }
}

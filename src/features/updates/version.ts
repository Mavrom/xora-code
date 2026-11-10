// Release versions as major.minor.patch, with an optional leading "v" and an optional
// prerelease suffix ("-beta.1"). Build metadata ("+abc") is accepted and ignored.

export interface Version {
  major: number;
  minor: number;
  patch: number;
  /** Has a prerelease suffix. */
  pre: boolean;
}

const VERSION = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

/** The parsed version, or null when `text` is not one. */
export function parseVersion(text: string): Version | null {
  const match = VERSION.exec(text.trim());
  if (!match) return null;
  const [major, minor, patch] = [match[1], match[2], match[3]].map(Number);
  if (![major, minor, patch].every(Number.isSafeInteger)) return null;
  return { major, minor, patch, pre: match[4] !== undefined };
}

/** The version without its leading "v", for display: "v0.2.0" -> "0.2.0". */
export const displayVersion = (tag: string) => tag.trim().replace(/^v/, "");

/**
 * Whether `candidate` is a newer release than `current`. Malformed input is never newer.
 * A prerelease counts only when its numbers are higher; at equal numbers, a stable
 * release is newer than a prerelease of it and nothing else is.
 */
export function isNewer(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const now = parseVersion(current);
  if (!next || !now) return false;
  const order = next.major - now.major || next.minor - now.minor || next.patch - now.patch;
  if (order !== 0) return order > 0;
  return now.pre && !next.pre;
}

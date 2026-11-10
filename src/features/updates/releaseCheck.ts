// The daily "is there a newer release?" question, kept pure: when to ask, what to ask,
// and how to read the answer. Nothing here touches storage, timers or the UI.
import { REPO_SLUG } from "@/shared/lib/repo";
import { displayVersion, isNewer, parseVersion } from "./version";

/** Never asks more often than this. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** A request that takes longer is abandoned. */
export const REQUEST_TIMEOUT_MS = 10_000;

export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO_SLUG}/releases/latest`;

/** A published (non-draft, non-prerelease) release. */
export interface Release {
  /** Without the leading "v": "0.2.0". */
  version: string;
  /** Its page on GitHub. */
  url: string;
}

/**
 * Whether to ask now: only when enabled, and at most once per interval. A last check
 * in the future (the clock went back) counts as stale rather than blocking for days.
 */
export function shouldCheck({
  now,
  lastCheck,
  enabled,
}: {
  now: number;
  lastCheck: number | null;
  enabled: boolean;
}): boolean {
  if (!enabled) return false;
  if (lastCheck === null || lastCheck > now) return true;
  return now - lastCheck >= CHECK_INTERVAL_MS;
}

/** Only this repository's own pages on github.com, over https. */
export function isReleaseUrl(text: string): boolean {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === "github.com" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    url.pathname.startsWith(`/${REPO_SLUG}/`)
  );
}

/** The release in a `/releases/latest` answer, or null when the answer is not a usable one. */
export function releaseFrom(body: unknown): Release | null {
  if (typeof body !== "object" || body === null) return null;
  const { tag_name: tag, html_url: url, draft, prerelease } = body as Record<string, unknown>;
  if (draft === true || prerelease === true) return null;
  if (typeof tag !== "string" || parseVersion(tag) === null) return null;
  if (typeof url !== "string" || !isReleaseUrl(url)) return null;
  return { version: displayVersion(tag), url };
}

/** `release` when it is newer than the running `current` version, else null. */
export const newerThan = (release: Release | null, current: string): Release | null =>
  release && isNewer(release.version, current) ? release : null;

/**
 * Asks GitHub for the latest release. Resolves to it, or to null on every failure
 * (offline, rate limited, any non-200, bad JSON, timeout): the check is silent by design.
 * Never rejects.
 */
export async function fetchLatestRelease(
  fetchFn: typeof fetch = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Release | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetchFn(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: abort.signal,
    });
    if (response.status !== 200) {
      console.debug(`updates: release check answered ${response.status}`);
      return null;
    }
    return releaseFrom(await response.json());
  } catch (err) {
    console.debug("updates: release check failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

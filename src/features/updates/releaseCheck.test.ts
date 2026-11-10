import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHECK_INTERVAL_MS,
  fetchLatestRelease,
  isReleaseUrl,
  LATEST_RELEASE_API,
  newerThan,
  releaseFrom,
  shouldCheck,
} from "./releaseCheck";

const PAGE = "https://github.com/Mavrom/xora-code/releases/tag/v0.2.0";
const latest = (extra: Record<string, unknown> = {}) => ({
  tag_name: "v0.2.0",
  html_url: PAGE,
  draft: false,
  prerelease: false,
  ...extra,
});

describe("shouldCheck", () => {
  const now = 10 * CHECK_INTERVAL_MS;

  it("asks when never asked, and once the interval has passed", () => {
    expect(shouldCheck({ now, lastCheck: null, enabled: true })).toBe(true);
    expect(shouldCheck({ now, lastCheck: now - CHECK_INTERVAL_MS, enabled: true })).toBe(true);
    expect(shouldCheck({ now, lastCheck: now - CHECK_INTERVAL_MS + 1, enabled: true })).toBe(false);
  });

  it("never asks when turned off", () => {
    expect(shouldCheck({ now, lastCheck: null, enabled: false })).toBe(false);
  });

  it("treats a last check in the future as stale", () => {
    expect(shouldCheck({ now, lastCheck: now + 1000, enabled: true })).toBe(true);
  });
});

describe("isReleaseUrl", () => {
  it("accepts only this repository's pages on github.com over https", () => {
    expect(isReleaseUrl(PAGE)).toBe(true);
    expect(isReleaseUrl("http://github.com/Mavrom/xora-code/releases")).toBe(false);
    expect(isReleaseUrl("https://github.com/Mavrom/xora-codex/releases")).toBe(false);
    expect(isReleaseUrl("https://github.com/Other/xora-code/releases")).toBe(false);
    expect(isReleaseUrl("https://github.com.evil.io/Mavrom/xora-code/")).toBe(false);
    expect(isReleaseUrl("https://user@github.com/Mavrom/xora-code/releases")).toBe(false);
    expect(isReleaseUrl("https://github.com:8443/Mavrom/xora-code/releases")).toBe(false);
    expect(isReleaseUrl("javascript:alert(1)")).toBe(false);
    expect(isReleaseUrl("not a url")).toBe(false);
  });
});

describe("releaseFrom", () => {
  it("maps the answer to its version and page", () => {
    expect(releaseFrom(latest())).toEqual({ version: "0.2.0", url: PAGE });
  });

  it("ignores drafts, prereleases, malformed tags and foreign links", () => {
    expect(releaseFrom(latest({ draft: true }))).toBeNull();
    expect(releaseFrom(latest({ prerelease: true }))).toBeNull();
    expect(releaseFrom(latest({ tag_name: "nightly" }))).toBeNull();
    expect(releaseFrom(latest({ tag_name: 2 }))).toBeNull();
    expect(releaseFrom(latest({ html_url: "https://example.com/x" }))).toBeNull();
    expect(releaseFrom(null)).toBeNull();
    expect(releaseFrom("v0.2.0")).toBeNull();
  });
});

describe("newerThan", () => {
  const release = { version: "0.2.0", url: PAGE };

  it("keeps the release only when it is newer than the running version", () => {
    expect(newerThan(release, "0.1.0")).toBe(release);
    expect(newerThan(release, "0.2.0")).toBeNull();
    expect(newerThan(release, "0.3.0")).toBeNull();
    expect(newerThan(null, "0.1.0")).toBeNull();
  });
});

describe("fetchLatestRelease", () => {
  afterEach(() => vi.restoreAllMocks());

  const answer = (status: number, body: unknown) =>
    vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

  it("asks the latest-release endpoint with the GitHub media type and no credentials", async () => {
    const fetchFn = answer(200, latest());
    expect(await fetchLatestRelease(fetchFn)).toEqual({ version: "0.2.0", url: PAGE });
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/Mavrom/xora-code/releases/latest");
    expect(url).toBe(LATEST_RELEASE_API);
    expect(init?.headers).toEqual({ Accept: "application/vnd.github+json" });
    expect(init?.credentials).toBe("omit");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("is silent on rate limits, other statuses, bad JSON and network errors", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    expect(await fetchLatestRelease(answer(403, { message: "rate limit" }))).toBeNull();
    expect(await fetchLatestRelease(answer(429, {}))).toBeNull();
    expect(await fetchLatestRelease(answer(404, {}))).toBeNull();
    const badJson = vi.fn<typeof fetch>(async () => new Response("<html>", { status: 200 }));
    expect(await fetchLatestRelease(badJson)).toBeNull();
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await fetchLatestRelease(offline)).toBeNull();
    expect(debug).toHaveBeenCalledTimes(5);
  });

  it("gives up after the timeout", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const hang = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    expect(await fetchLatestRelease(hang, 5)).toBeNull();
  });
});

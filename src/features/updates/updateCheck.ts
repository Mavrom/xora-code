// Once per start, a little after it: asks GitHub for the latest release (at most once a
// day, only while Settings > General > "Check for updates" is on) and tells the store
// whether it is newer than the running app. A notice only: nothing is downloaded.
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@tauri-apps/api/core";
import { ensureSettingsLoaded, useSettingsStore } from "@/features/settings/store";
import { REPO_URL } from "@/shared/lib/repo";
import { fetchLatestRelease, newerThan, shouldCheck, type Release } from "./releaseCheck";
import { defaultStorage, readSaved, writeSaved, type SavedStorage } from "./saved";
import { useUpdateStore } from "./store";
import { displayVersion, parseVersion } from "./version";

/** Keeps the request out of the way of startup. */
export const START_DELAY_MS = 15_000;

export interface CheckDeps {
  now: () => number;
  fetchFn: typeof fetch;
  /** The running app's version. */
  currentVersion: () => Promise<string>;
  storage: SavedStorage | null;
  report: (release: Release | null) => void;
}

/**
 * One check: asks when the last request is a day old (recording the attempt first, so a
 * failure is not retried before tomorrow), keeps the latest release a successful answer
 * saw, and reports it when it is newer than the running app.
 */
export async function runUpdateCheck(deps: CheckDeps): Promise<void> {
  const saved = readSaved(deps.storage);
  const current = await deps.currentVersion();
  let latest = saved.latest;
  const now = deps.now();
  if (shouldCheck({ now, lastCheck: saved.lastCheck, enabled: true })) {
    writeSaved({ lastCheck: now }, deps.storage);
    const answer = await fetchLatestRelease(deps.fetchFn);
    if (answer) {
      latest = answer;
      writeSaved({ latest }, deps.storage);
    }
  }
  deps.report(newerThan(latest, current));
}

/** DEV only: `?fixture=…&update=0.9.0` shows a notice for that version, without a request. */
function seedFixture(): boolean {
  const q = new URLSearchParams(globalThis.location?.search ?? "");
  if (!q.has("fixture")) return false;
  const update = q.get("update");
  if (update && parseVersion(update)) {
    const version = displayVersion(update);
    useUpdateStore
      .getState()
      .setAvailable({ version, url: `${REPO_URL}/releases/tag/v${version}` });
  }
  return true;
}

const enabled = () => useSettingsStore.getState().settings.general.checkForUpdates;

/**
 * Schedules the check once per start. While the setting is off nothing is requested; if
 * it is turned on later in the session, the check runs then (still at most once a day).
 */
export function installUpdateCheck(): () => void {
  // Statically false in production builds, so the fixture hook is dropped.
  if (import.meta.env.DEV && seedFixture()) return () => undefined;
  if (!isTauri()) return () => undefined;

  let ran = false;
  let off: () => void = () => undefined;
  const run = () => {
    if (ran || !enabled()) return;
    ran = true;
    off();
    void runUpdateCheck({
      now: Date.now,
      fetchFn: (input, init) => fetch(input, init),
      currentVersion: getVersion,
      storage: defaultStorage(),
      report: (release) => useUpdateStore.getState().setAvailable(release),
    }).catch((err) => console.debug("updates: check skipped", err));
  };
  const timer = setTimeout(() => {
    void ensureSettingsLoaded().then(() => {
      run();
      if (!ran) off = useSettingsStore.subscribe(run);
    });
  }, START_DELAY_MS);
  return () => {
    clearTimeout(timer);
    off();
  };
}

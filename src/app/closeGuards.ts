import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Work that must finish before the window goes away (e.g. writing unsaved notes). */
export type CloseGuard = () => Promise<void> | void;

/** A hung guard must never keep the window from closing. */
export const CLOSE_GUARD_TIMEOUT_MS = 3_000;

export interface CloseGuardRegistry {
  /** Adds a guard; the returned function removes it again (safe to call twice). */
  register: (guard: CloseGuard) => () => void;
  /**
   * Starts every registered guard at once and resolves when all have settled or
   * the timeout has passed, whichever comes first. Never rejects: a throwing or
   * rejecting guard is logged and does not stop the others.
   */
  run: () => Promise<void>;
}

/** Pure registry (no window APIs), so it can be unit-tested. */
export function createCloseGuardRegistry(
  timeoutMs = CLOSE_GUARD_TIMEOUT_MS,
  onError: (err: unknown) => void = (err) => console.error("close guard failed", err),
): CloseGuardRegistry {
  const guards = new Set<CloseGuard>();

  const start = (guard: CloseGuard): Promise<void> => {
    try {
      // Called synchronously so each guard begins before the window can close.
      return Promise.resolve(guard());
    } catch (err) {
      return Promise.reject(err);
    }
  };

  return {
    register(guard) {
      // Wrap so registering the same function twice yields two independent entries.
      const entry: CloseGuard = () => guard();
      guards.add(entry);
      return () => {
        guards.delete(entry);
      };
    },

    async run() {
      const settled = Promise.allSettled([...guards].map(start)).then((results) => {
        for (const r of results) if (r.status === "rejected") onError(r.reason);
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      });
      try {
        await Promise.race([settled, timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

const registry = createCloseGuardRegistry();
let pageHideInstalled = false;
let closeInstalled = false;

/** Installs the single window-close listener (and a best-effort pagehide hook) once. */
function install() {
  if (typeof window === "undefined") return;
  if (!pageHideInstalled) {
    pageHideInstalled = true;
    // Reloads and plain-browser runs: cannot be awaited, but the guards still start.
    window.addEventListener("pagehide", () => void registry.run());
  }

  if (closeInstalled || !isTauri()) return;
  closeInstalled = true;
  // Tauri destroys the window once this handler settles (needs
  // `core:window:allow-destroy`); it must never throw or the window stays open.
  getCurrentWindow()
    .onCloseRequested(async () => {
      try {
        await registry.run();
      } catch (err) {
        console.error("close guards failed", err);
      }
    })
    .catch((err: unknown) => {
      closeInstalled = false; // the next registration tries again
      console.error("cannot watch window close", err);
    });
}

/**
 * Runs `guard` before the window closes. All guards run in parallel and the
 * window closes after they settle or after {@link CLOSE_GUARD_TIMEOUT_MS}.
 * Returns an unregister function.
 */
export function registerCloseGuard(guard: CloseGuard): () => void {
  install();
  return registry.register(guard);
}

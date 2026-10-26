import { create, type StoreApi, type UseBoundStore } from "zustand";
import { settingsIpc } from "./ipc";
import { applyPatch, isEmptyPatch, mergePatches } from "./merge";
import { DEFAULT_SETTINGS, type Settings, type SettingsPatch } from "./types";

export const SAVE_DELAY_MS = 300;

type Status = "idle" | "loading" | "ready" | "error";

export interface SettingsState {
  /** Always usable: defaults until the stored settings arrive. */
  settings: Settings;
  status: Status;
  /** Last load or save failure, cleared by the next successful save. */
  error: string | null;
  /** Starts the load once; later calls return the same promise. Never rejects. */
  load: () => Promise<Settings>;
  /** Applies the change at once (optimistic) and persists it after a short debounce. */
  update: (patch: SettingsPatch) => void;
  /** Writes any pending change now; resolves when it is on disk (or failed). Never rejects. */
  flush: () => Promise<void>;
}

export interface SettingsBackend {
  get: () => Promise<Settings>;
  update: (patch: SettingsPatch) => Promise<Settings>;
}

/**
 * Store factory (the app uses the singleton below; tests build their own).
 * Patches are queued and sent as one merged patch; Rust deep-merges them on
 * disk, so a write never needs the load to have finished first.
 */
export function createSettingsStore(
  backend: SettingsBackend,
  delayMs = SAVE_DELAY_MS,
): UseBoundStore<StoreApi<SettingsState>> {
  let pending: SettingsPatch = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: Promise<void> | null = null;
  let loading: Promise<Settings> | null = null;

  const store = create<SettingsState>((set, get) => {
    async function saveLoop() {
      while (!isEmptyPatch(pending)) {
        const patch = pending;
        pending = {};
        try {
          const saved = await backend.update(patch);
          // Re-apply anything queued meanwhile so the UI never jumps back.
          const settings = applyPatch(saved, pending);
          set({ settings, error: null });
        } catch (err) {
          // Keep the change in memory and queue it for the next save.
          pending = mergePatches(patch, pending);
          set({ error: String(err) });
          return;
        }
      }
    }

    function flush(): Promise<void> {
      clearTimeout(timer);
      timer = undefined;
      if (inflight) return inflight.then(() => (isEmptyPatch(pending) ? undefined : flush()));
      if (isEmptyPatch(pending)) return Promise.resolve();
      inflight = saveLoop().finally(() => {
        inflight = null;
      });
      return inflight;
    }

    return {
      settings: DEFAULT_SETTINGS,
      status: "idle",
      error: null,

      load: () => {
        loading ??= (async () => {
          set({ status: "loading" });
          try {
            const stored = await backend.get();
            set({ settings: applyPatch(stored, pending), status: "ready", error: null });
          } catch (err) {
            // Defaults keep the app usable; changes still save as patches.
            set({ status: "error", error: String(err) });
          }
          return get().settings;
        })();
        return loading;
      },

      update: (patch) => {
        const settings = applyPatch(get().settings, patch);
        if (settings === get().settings) return;
        set({ settings });
        pending = mergePatches(pending, patch);
        clearTimeout(timer);
        timer = setTimeout(() => void flush(), delayMs);
      },

      flush,
    };
  });
  return store;
}

export const useSettingsStore = createSettingsStore(settingsIpc);

/** Resolves with the stored settings (or defaults if they could not be read). Never rejects. */
export const ensureSettingsLoaded = () => useSettingsStore.getState().load();

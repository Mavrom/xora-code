import { create } from "zustand";
import { settingsIpc, type ProviderStatus } from "./ipc";
import type { AgentId } from "./types";

interface AccountsState {
  statuses: Partial<Record<AgentId, ProviderStatus>>;
  /** True while a detection runs; the first one shows skeletons, later ones keep the cards. */
  detecting: boolean;
  detectedAt: number | null;
  error: string | null;
  detect: () => Promise<void>;
}

let running: Promise<void> | null = null;

export const useAccountsStore = create<AccountsState>((set) => ({
  statuses: {},
  detecting: false,
  detectedAt: null,
  error: null,
  detect: () => {
    running ??= (async () => {
      set({ detecting: true });
      try {
        const list = await settingsIpc.detectAccounts();
        const statuses: Partial<Record<AgentId, ProviderStatus>> = {};
        for (const status of list) statuses[status.provider] = status;
        set({ statuses, error: null, detectedAt: Date.now() });
      } catch (err) {
        set({ error: String(err) });
      } finally {
        set({ detecting: false });
        running = null;
      }
    })();
    return running;
  },
}));

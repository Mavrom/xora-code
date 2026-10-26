import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { registerCloseGuard } from "@/app/closeGuards";
import { fixtureParams, startFixtureMode } from "./fixtureMode";
import { useAgentStore } from "./store";

/**
 * The single global agent event subscription. Mount once in an always-mounted
 * component (App). Also stops the agent processes before the window closes.
 *
 * Settings come from package S: wire them once with
 * `setAgentSettingsSource(() => useSettingsStore.getState().settings.agent)`
 * from `./defaults` (until then the documented defaults are used).
 */
export function useAgentEvents() {
  useEffect(() => {
    // Statically false in production builds, so the fixture chunk is dropped.
    if (import.meta.env.DEV) {
      const fixture = fixtureParams();
      if (fixture) {
        void startFixtureMode(fixture).catch((err) => console.error("agents: fixture mode", err));
        return;
      }
    }
    if (!isTauri()) return;
    void useAgentStore.getState().init();
    return registerCloseGuard(() => useAgentStore.getState().shutdown());
  }, []);
}

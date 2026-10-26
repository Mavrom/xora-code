import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { registerCloseGuard } from "@/app/closeGuards";
import { ensureSettingsLoaded, useSettingsStore } from "@/features/settings/store";
import { setAgentSettingsSource } from "./defaults";
import { fixtureParams, startFixtureMode } from "./fixtureMode";
import { useAgentStore } from "./store";

/**
 * The single global agent event subscription. Mount once in an always-mounted
 * component (App). Also stops the agent processes before the window closes.
 * Agent defaults (agent, mode, effort, approval) are read live from Settings.
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
    setAgentSettingsSource(() => useSettingsStore.getState().settings.agent);
    // The default agent is picked at init, so the stored choice must be in first.
    void ensureSettingsLoaded().then(() => useAgentStore.getState().init());
    return registerCloseGuard(() => useAgentStore.getState().shutdown());
  }, []);
}

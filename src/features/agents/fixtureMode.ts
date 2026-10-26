// `?fixture=` dev mode: runs the real store on the fake ipc, so the chat UI
// works in a plain browser (`npm run dev`). DEV builds only.
//
//   ?fixture=<scenario>   opens a session and plays the scenario
//                         (streaming | toolDiff | permission | plan | terminal)
//   ?fixture=welcome      fake ipc, no session (empty welcome)
//   &agent=codex          agent for the session (default claude)
//   &status=crashed       status of that agent (see FIXTURE_STATUSES)

import { setAgentIpc, useAgentStore } from "./store";
import type { AgentId } from "./types";

export interface FixtureParams {
  fixture: string;
  agent: AgentId;
  status: string | null;
}

/** Parsed `?fixture=` params, or null outside DEV or without the param. */
export function fixtureParams(
  search: string = globalThis.location?.search ?? "",
): FixtureParams | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(search);
  const fixture = q.get("fixture");
  if (fixture === null) return null;
  const agent = q.get("agent");
  return {
    fixture,
    agent: agent === "codex" || agent === "gemini" ? agent : "claude",
    status: q.get("status"),
  };
}

let started = false;

export async function startFixtureMode(params: FixtureParams): Promise<void> {
  if (started) return;
  started = true;
  const f = await import("./fixtures");
  const status = params.status && params.status in f.FIXTURE_STATUSES ? params.status : null;
  const agents = f.fixtureAgents(
    status ? { [params.agent]: status as keyof typeof f.FIXTURE_STATUSES } : {},
  );
  const scenario = f.isFixtureScenario(params.fixture) ? params.fixture : undefined;
  setAgentIpc(f.createFixtureIpc({ scenario, agents }));

  const store = useAgentStore.getState();
  await store.init();
  store.selectAgent(params.agent);
  await store.refreshHistory(f.FIXTURE_CWD);
  if (!scenario || status) return;
  const id = await store.newSession(params.agent, f.FIXTURE_CWD);
  await useAgentStore.getState().prompt(id, f.FIXTURE_SCENARIOS[scenario].prompt);
}

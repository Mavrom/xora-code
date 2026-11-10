// `?fixture=` dev mode: runs the real store on the fake ipc, so the chat UI
// works in a plain browser (`npm run dev`). DEV builds only.
//
//   ?fixture=<scenario>   opens a session and plays the scenario
//                         (streaming | toolDiff | permission | plan | terminal | toolRun)
//   ?fixture=welcome      fake ipc, no session (empty welcome)
//   &agent=codex          agent for the session (default claude)
//   &status=crashed       status of that agent (see FIXTURE_STATUSES)
//   &branch=1             plays a second turn, then "Edit and retry" on it (a fork for
//                         Claude and Codex, the summary fallback for Gemini)

import { useInboxStore } from "@/features/inbox/store";
import { t } from "@/shared/i18n";
import { setAgentIpc, useAgentStore } from "./store";
import type { AgentId } from "./types";

export interface FixtureParams {
  fixture: string;
  agent: AgentId;
  status: string | null;
  branch: boolean;
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
    branch: q.has("branch"),
  };
}

/** Resolves once `sessionId`'s turn is over. */
function turnEnded(sessionId: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => useAgentStore.getState().sessions[sessionId]?.turn === "idle";
    if (done()) return resolve();
    const off = useAgentStore.subscribe(() => {
      if (!done()) return;
      off();
      resolve();
    });
  });
}

/** Presses the last "Edit and retry" button once the transcript shows it. */
async function pressLastEditAndRetry() {
  const selector = `button[aria-label="${t("Edit and retry")}"]`;
  for (let i = 0; i < 100; i++) {
    const buttons = document.querySelectorAll<HTMLButtonElement>(selector);
    if (buttons.length > 1) {
      buttons[buttons.length - 1].click();
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
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
  // The Inbox has no IPC in a browser: give it notes so the welcome screen can show one.
  if (!scenario) useInboxStore.setState({ notes: f.FIXTURE_NOTES });
  if (!scenario || status) return;
  const id = await store.newSession(params.agent, f.FIXTURE_CWD);
  await useAgentStore.getState().prompt(id, f.FIXTURE_SCENARIOS[scenario].prompt);
  if (!params.branch) return;
  await turnEnded(id);
  await useAgentStore.getState().prompt(id, f.FIXTURE_BRANCH_PROMPT);
  await turnEnded(id);
  await pressLastEditAndRetry();
}

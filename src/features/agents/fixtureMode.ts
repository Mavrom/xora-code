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
//   &history=0            no saved conversations (a first run)
//   &view=<view>          the sidebar view to open on (sessions | inbox | changes)

import { useUiStore, type SidebarView } from "@/app/uiStore";
import { useChangesStore } from "@/features/git/changesStore";
import { gitIpc } from "@/features/git/ipc";
import { useInboxStore } from "@/features/inbox/store";
import { settingsIpc } from "@/features/settings/ipc";
import { ipc } from "@/shared/lib/ipc";
import { t } from "@/shared/i18n";
import { setAgentIpc, useAgentStore } from "./store";
import type { AgentId } from "./types";

export interface FixtureParams {
  fixture: string;
  agent: AgentId;
  status: string | null;
  branch: boolean;
  history: boolean;
  view: SidebarView | null;
}

const VIEWS: readonly SidebarView[] = ["sessions", "inbox", "changes"];

/** Parsed `?fixture=` params, or null outside DEV or without the param. */
export function fixtureParams(
  search: string = globalThis.location?.search ?? "",
): FixtureParams | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(search);
  const fixture = q.get("fixture");
  if (fixture === null) return null;
  const agent = q.get("agent");
  const view = q.get("view");
  return {
    fixture,
    agent: agent === "codex" || agent === "gemini" ? agent : "claude",
    status: q.get("status"),
    branch: q.has("branch"),
    history: q.get("history") !== "0",
    view: VIEWS.find((v) => v === view) ?? null,
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

/**
 * The git views have no IPC in a browser: point them at an in-memory working tree (the
 * fixture project with a few changes), and let a diff's disk side read from it too.
 */
async function startFixtureGit() {
  const g = await import("@/features/git/fixtures");
  Object.assign(gitIpc, g.fixtureGitIpc);
  Object.assign(ipc, { readFile: g.fixtureReadFile });
  await useChangesStore.getState().setDir(g.FIXTURE_GIT_ROOT);
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
  setAgentIpc(f.createFixtureIpc({ scenario, agents, history: params.history ? undefined : [] }));
  if (params.view) useUiStore.getState().setSidebarView(params.view);

  const store = useAgentStore.getState();
  await store.init();
  store.selectAgent(params.agent);
  await store.refreshHistory(f.FIXTURE_CWD);
  // The Inbox has no IPC in a browser: give it notes so the welcome screen can show one.
  useInboxStore.setState({ notes: f.FIXTURE_NOTES, status: "ready", error: null });
  // Nor does Settings > Accounts' detection.
  Object.assign(settingsIpc, { detectAccounts: () => Promise.resolve(f.FIXTURE_ACCOUNTS) });
  await startFixtureGit();
  if (!scenario || status) return;
  const id = await store.newSession(params.agent, f.FIXTURE_CWD);
  await useAgentStore.getState().prompt(id, f.FIXTURE_SCENARIOS[scenario].prompt);
  if (!params.branch) return;
  await turnEnded(id);
  await useAgentStore.getState().prompt(id, f.FIXTURE_BRANCH_PROMPT);
  await turnEnded(id);
  await pressLastEditAndRetry();
}

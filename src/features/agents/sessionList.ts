// Session list for the sidebar / history: agent history merged with the
// sessions open in this app run, grouped by project folder. Pure.

import { basename } from "@/shared/lib/path";
import type { SessionView } from "./reducer";
import type { AgentId, AgentSessionInfo } from "./types";

export interface SessionListEntry {
  agentId: AgentId;
  sessionId: string;
  cwd: string;
  title: string | null;
  /** ISO timestamp, or null when unknown. */
  updatedAt: string | null;
  /** Open in this app run (in the store). */
  open: boolean;
  active: boolean;
  /** A turn is in progress. */
  running: boolean;
  /** Moved to the archive by the user. */
  archived: boolean;
  /** Kept at the top by the user. */
  pinned: boolean;
  /** The user named it: the title is theirs, not the agent's. */
  renamed: boolean;
}

export interface ProjectGroup {
  cwd: string;
  /** Folder name for display. */
  name: string;
  sessions: SessionListEntry[];
  /** Newest `updatedAt` in the group. */
  latest: string | null;
}

const TITLE_MAX = 80;

/** Normalised project key: case-insensitive, `/` and `\` alike, no trailing slash. */
export const projectKey = (cwd: string) =>
  cwd.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

export const sameProject = (a: string, b: string) => projectKey(a) === projectKey(b);

/** First line of the first user message, as a stand-in title. */
function firstPrompt(view: SessionView): string | null {
  for (const item of view.items) {
    if (item.kind !== "user") continue;
    const text = item.blocks
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text;
  }
  return null;
}

const time = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);

const byNewest = (a: { updatedAt: string | null }, b: { updatedAt: string | null }) =>
  time(b.updatedAt) - time(a.updatedAt);

export function mergeSessionList(
  history: readonly AgentSessionInfo[],
  sessions: Record<string, SessionView>,
  activeSessionId: string | null,
): SessionListEntry[] {
  const map = new Map<string, SessionListEntry>();
  for (const h of history) {
    map.set(`${h.agentId}:${h.sessionId}`, {
      agentId: h.agentId,
      sessionId: h.sessionId,
      cwd: h.cwd,
      title: h.customTitle || h.title,
      updatedAt: h.updatedAt,
      open: false,
      active: false,
      running: false,
      archived: h.archived ?? false,
      pinned: h.pinned ?? false,
      renamed: Boolean(h.customTitle),
    });
  }
  for (const v of Object.values(sessions)) {
    const key = `${v.agentId}:${v.sessionId}`;
    const prev = map.get(key);
    map.set(key, {
      agentId: v.agentId,
      sessionId: v.sessionId,
      cwd: v.cwd || prev?.cwd || "",
      // A name the user gave wins over the agent's live title.
      title: prev?.renamed ? prev.title : (v.title ?? prev?.title ?? firstPrompt(v)),
      updatedAt: v.updatedAt ?? prev?.updatedAt ?? null,
      open: true,
      active: v.sessionId === activeSessionId,
      running: v.turn !== "idle",
      archived: prev?.archived ?? false,
      pinned: prev?.pinned ?? false,
      renamed: prev?.renamed ?? false,
    });
  }
  // Array.prototype.sort is stable, so equal dates keep insertion order.
  return [...map.values()].sort(byNewest);
}

export function groupByProject(entries: readonly SessionListEntry[]): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  for (const e of entries) {
    const key = projectKey(e.cwd);
    let g = groups.get(key);
    if (!g) {
      g = {
        cwd: e.cwd,
        name: basename(e.cwd.replace(/[\\/]+$/, "")) || e.cwd,
        sessions: [],
        latest: null,
      };
      groups.set(key, g);
    }
    g.sessions.push(e);
    if (time(e.updatedAt) > time(g.latest)) g.latest = e.updatedAt;
  }
  const out = [...groups.values()];
  for (const g of out) g.sessions.sort(byNewest);
  return out.sort((a, b) => time(b.latest) - time(a.latest));
}

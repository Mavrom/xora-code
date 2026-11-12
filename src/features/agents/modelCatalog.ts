// The models each agent offers, remembered from its sessions so Settings can offer them
// ("Model ekle") even when no chat is open.
import { create } from "zustand";
import type { SelectControl } from "./controls";
import { useAgentStore } from "./store";
import type { AgentId } from "./types";

export interface ModelEntry {
  value: string;
  name: string;
  description?: string;
}

const STORAGE_KEY = "xora.models";

/** How a model was stored in the older `agent.hiddenModels` setting. */
export const modelKey = (agent: AgentId, value: string) => `${agent}:${value}`;

type Catalog = Partial<Record<AgentId, ModelEntry[]>>;

// localStorage can be missing or throw (private mode, tests); fall back quietly.
function read(): Catalog {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Catalog) : {};
  } catch {
    return {};
  }
}

function write(catalog: Catalog) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // Not persisted; the list is learned again from the next session.
  }
}

const same = (a: readonly ModelEntry[] | undefined, b: readonly ModelEntry[]) =>
  a !== undefined &&
  a.length === b.length &&
  a.every((m, i) => m.value === b[i].value && m.name === b[i].name);

interface CatalogState {
  models: Catalog;
  remember: (agent: AgentId, options: SelectControl["options"]) => void;
}

export const useModelCatalog = create<CatalogState>((set, get) => ({
  models: read(),
  remember: (agent, options) => {
    const entries = options.map(({ value, name, description }) => ({ value, name, description }));
    if (entries.length === 0 || same(get().models[agent], entries)) return;
    const models = { ...get().models, [agent]: entries };
    set({ models });
    write(models);
  },
}));

/** Learns each agent's model list whenever a session reports one. */
export function installModelCatalog(store = useAgentStore) {
  const learn = (sessions: ReturnType<typeof store.getState>["sessions"]) => {
    for (const view of Object.values(sessions)) {
      const model = view.controls.model;
      if (model) useModelCatalog.getState().remember(view.agentId, model.options);
    }
  };
  learn(store.getState().sessions);
  return store.subscribe((state, prev) => {
    if (state.sessions !== prev.sessions) learn(state.sessions);
  });
}

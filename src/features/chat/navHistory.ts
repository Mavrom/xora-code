import { create } from "zustand";
import { useAgentStore } from "@/features/agents/store";

/** How many conversations back the sidebar's arrows can go. */
const LIMIT = 50;

interface NavState {
  /** Visited conversations; `null` is the new-chat screen. */
  stack: (string | null)[];
  index: number;
}

export const useNavHistory = create<NavState>(() => ({ stack: [null], index: 0 }));

/** True while back/forward itself changes the active session (not a new visit). */
let travelling = false;

/** Records every switch of the active conversation, like a browser's history. */
export function installNavHistory() {
  return useAgentStore.subscribe((state, prev) => {
    if (state.activeSessionId === prev.activeSessionId || travelling) return;
    useNavHistory.setState(({ stack, index }) => {
      const next = [...stack.slice(0, index + 1), state.activeSessionId].slice(-LIMIT);
      return { stack: next, index: next.length - 1 };
    });
  });
}

const exists = (id: string | null) => id === null || id in useAgentStore.getState().sessions;

/** Moves `step` places (-1 back, 1 forward), skipping conversations closed since. */
export function travel(step: -1 | 1) {
  const { stack, index } = useNavHistory.getState();
  let target = index + step;
  while (target >= 0 && target < stack.length && !exists(stack[target])) target += step;
  if (target < 0 || target >= stack.length) return;
  travelling = true;
  try {
    useAgentStore.getState().setActiveSession(stack[target]);
  } finally {
    travelling = false;
  }
  useNavHistory.setState({ index: target });
}

export const canTravel = (s: NavState, step: -1 | 1) => {
  const target = s.index + step;
  return target >= 0 && target < s.stack.length;
};

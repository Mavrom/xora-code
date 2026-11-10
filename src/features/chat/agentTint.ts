import type { AgentId } from "@/features/agents/types";

/**
 * Each agent's colour, used for its mark in lists and the model chip, and for the ring
 * around the account avatar. Identity colours, kept here rather than as theme tokens.
 */
export const AGENT_TINT: Record<AgentId, string> = {
  claude: "#d97757",
  codex: "#e8e8e8",
  gemini: "#7aa7f5",
};

import type { AcpAuthMethod, AgentId } from "./types";
import { t } from "@/shared/i18n";

/**
 * Sign-in methods that use the person's own subscription. API-key, console and
 * gateway methods bill differently and are out of scope (no API keys in Xora).
 */
const SUBSCRIPTION_METHODS: Record<AgentId, readonly string[]> = {
  claude: ["claude-ai-login", "claude-login"],
  codex: ["chat-gpt"],
  gemini: ["oauth-personal"],
};

/** The subscription methods an agent offers; falls back to all if none is known. */
export function subscriptionAuthMethods(
  agentId: AgentId,
  methods: AcpAuthMethod[],
): AcpAuthMethod[] {
  const allowed = SUBSCRIPTION_METHODS[agentId];
  const picked = methods.filter((m) => allowed.includes(m.id));
  return picked.length > 0 ? picked : methods;
}

const LABELS: Record<string, string> = {
  "claude-ai-login": t("Sign in with a Claude subscription"),
  "claude-login": t("Sign in with Claude"),
  "chat-gpt": t("Sign in with ChatGPT"),
  "oauth-personal": t("Sign in with Google"),
};

/** Button text for a sign-in method (the agent's own name for unknown ones). */
export function authMethodLabel(method: AcpAuthMethod): string {
  return LABELS[method.id] ?? method.name;
}

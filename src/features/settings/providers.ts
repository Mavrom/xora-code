import type { AgentStatus } from "@/features/agents/types";
import type { ProviderStatus, SignIn } from "./ipc";
import type { AgentId } from "./types";
import { t } from "@/shared/i18n";

export interface ProviderInfo {
  id: AgentId;
  name: string;
  vendor: string;
  /** Two-letter monogram for the card's mark (no third-party logos). */
  mark: string;
  /** Oldest Node.js major the agent's adapter runs on (`registry.rs` `min_node_major`). */
  minNode: number;
  /** What the user does in the console that "Giriş yap" opens. */
  loginHint: string;
}

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "claude",
    name: "Claude Code",
    vendor: "Anthropic",
    mark: "Cc",
    minNode: 22,
    loginHint: t("Type /login in the window that opens and confirm in your browser."),
  },
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    mark: "Cx",
    minNode: 20,
    loginHint: t("Follow the ChatGPT sign-in steps in the window that opens."),
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    vendor: "Google",
    mark: "Gm",
    minNode: 20,
    loginHint: t("Choose “Login with Google” in the window that opens."),
  },
];

export const providerInfo = (id: AgentId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

/**
 * One word for the card, from what Xora needs to run the agent (Node.js and the adapter it
 * installs itself, `runtime`) and the sign-in file the CLI leaves (`cli`); a global CLI on
 * PATH is not required.
 */
export type ProviderState =
  "needsNode" | "installable" | "installing" | "signedOut" | "ready" | "unknown";

export function providerState(
  cli: ProviderStatus | undefined,
  runtime: AgentStatus | undefined,
): ProviderState {
  if (runtime?.state === "notInstalled") {
    return runtime.reason === "package-missing" ? "installable" : "needsNode";
  }
  if (runtime?.state === "installing") return "installing";
  if (runtime?.state === "authRequired") return "signedOut";
  if (cli?.signIn === "signedIn") return "ready";
  if (cli?.signIn === "signedOut") return "signedOut";
  return "unknown";
}

/** Whether "Giriş yap" can open a sign-in console: a CLI on PATH or one Xora installed. */
export const canOpenLogin = (cli: ProviderStatus | undefined): boolean =>
  Boolean(cli?.path || cli?.bundledCli);

export const SIGN_IN_LABEL: Record<SignIn, string> = {
  signedIn: t("Signed in"),
  signedOut: t("Signed out"),
  unknown: t("Unknown"),
};

/** Paths longer than this lose their middle directories. */
const MAX_PATH_CHARS = 48;

/**
 * Keeps an executable path readable on one line: the home directory becomes `~`, and a
 * long path keeps its first two and last two segments (`C:\Program Files\…\bin\codex.cmd`).
 */
export function shortenPath(path: string, home?: string | null): string {
  let out = path;
  if (home && out.toLowerCase().startsWith(home.toLowerCase())) out = `~${out.slice(home.length)}`;
  if (out.length <= MAX_PATH_CHARS) return out;
  const sep = out.includes("\\") ? "\\" : "/";
  const parts = out.split(sep);
  if (parts.length <= 4) return out;
  return [parts[0], parts[1], "…", parts[parts.length - 2], parts[parts.length - 1]].join(sep);
}

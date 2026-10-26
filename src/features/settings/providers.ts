import type { ProviderStatus, SignIn } from "./ipc";
import type { AgentId } from "./types";

export interface ProviderInfo {
  id: AgentId;
  name: string;
  vendor: string;
  /** Two-letter monogram for the card's mark (no third-party logos). */
  mark: string;
  /** Global npm install command shown under "Kur". */
  install: string;
  /** What the user does in the console that "Giriş yap" opens. */
  loginHint: string;
}

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "claude",
    name: "Claude Code",
    vendor: "Anthropic",
    mark: "Cc",
    install: "npm i -g @anthropic-ai/claude-code",
    loginHint: "Açılan pencerede /login yazın ve tarayıcıda onaylayın.",
  },
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI",
    mark: "Cx",
    install: "npm i -g @openai/codex",
    loginHint: "Açılan pencerede ChatGPT ile giriş adımlarını izleyin.",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    vendor: "Google",
    mark: "Gm",
    install: "npm i -g @google/gemini-cli",
    loginHint: "Açılan pencerede “Login with Google” seçeneğini seçin.",
  },
];

export const providerInfo = (id: AgentId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

export type ProviderState = "missing" | "signedOut" | "ready" | "unknown";

/** One word for the card: not installed, needs sign-in, ready, or cannot tell. */
export function providerState(status: ProviderStatus | undefined): ProviderState {
  if (!status?.path) return "missing";
  if (status.signIn === "signedIn") return "ready";
  if (status.signIn === "signedOut") return "signedOut";
  return "unknown";
}

export const SIGN_IN_LABEL: Record<SignIn, string> = {
  signedIn: "Giriş yapılmış",
  signedOut: "Giriş yapılmamış",
  unknown: "Bilinmiyor",
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

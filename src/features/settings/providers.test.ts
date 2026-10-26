import { describe, expect, it } from "vitest";
import { PROVIDERS, providerInfo, providerState, shortenPath } from "./providers";

describe("PROVIDERS", () => {
  it("installs the official npm packages", () => {
    expect(PROVIDERS.map((p) => p.install)).toEqual([
      "npm i -g @anthropic-ai/claude-code",
      "npm i -g @openai/codex",
      "npm i -g @google/gemini-cli",
    ]);
  });

  it("looks providers up by id", () => {
    expect(providerInfo("codex").name).toBe("Codex");
  });
});

describe("providerState", () => {
  const status = (path: string | null, signIn: "signedIn" | "signedOut" | "unknown") => ({
    provider: "claude" as const,
    path,
    version: null,
    signIn,
  });

  it("is missing without a resolved CLI, whatever the sign-in file says", () => {
    expect(providerState(undefined)).toBe("missing");
    expect(providerState(status(null, "signedIn"))).toBe("missing");
  });

  it("maps the sign-in heuristic once the CLI is installed", () => {
    expect(providerState(status("/bin/claude", "signedIn"))).toBe("ready");
    expect(providerState(status("/bin/claude", "signedOut"))).toBe("signedOut");
    expect(providerState(status("/bin/claude", "unknown"))).toBe("unknown");
  });
});

describe("shortenPath", () => {
  it("replaces the home directory", () => {
    expect(shortenPath("C:\\Users\\me\\AppData\\Roaming\\npm\\claude.cmd", "C:\\Users\\me")).toBe(
      "~\\AppData\\Roaming\\npm\\claude.cmd",
    );
  });

  it("elides the middle of long paths", () => {
    expect(
      shortenPath("C:\\Program Files\\nodejs\\node_modules\\global\\packages\\bin\\codex.cmd"),
    ).toBe("C:\\Program Files\\…\\bin\\codex.cmd");
  });

  it("keeps short paths as they are", () => {
    expect(shortenPath("/usr/local/bin/codex")).toBe("/usr/local/bin/codex");
    expect(shortenPath("C:\\Users\\me\\claude.exe", "C:\\Users\\me")).toBe("~\\claude.exe");
  });
});

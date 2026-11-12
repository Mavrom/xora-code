import { describe, expect, it } from "vitest";
import type { AgentStatus } from "@/features/agents/types";
import { canOpenLogin, PROVIDERS, providerInfo, providerState, shortenPath } from "./providers";

describe("PROVIDERS", () => {
  it("knows each adapter's oldest Node.js", () => {
    expect(PROVIDERS.map((p) => p.minNode)).toEqual([22, 20, 20]);
  });

  it("looks providers up by id", () => {
    expect(providerInfo("codex").name).toBe("Codex");
  });
});

describe("providerState", () => {
  const cli = (
    path: string | null,
    signIn: "signedIn" | "signedOut" | "unknown",
    bundledCli: string | null = null,
  ) => ({ provider: "codex" as const, path, version: null, signIn, bundledCli });
  const ready: AgentStatus = { state: "ready", agentInfo: null, capabilities: {}, authMethods: [] };

  it("follows what Xora needs to run the agent, not a CLI on PATH", () => {
    expect(providerState(cli(null, "signedIn"), ready)).toBe("ready");
    expect(
      providerState(cli(null, "unknown"), { state: "notInstalled", reason: "package-missing" }),
    ).toBe("installable");
    expect(
      providerState(cli("/bin/codex", "signedIn"), {
        state: "notInstalled",
        reason: "node-missing",
      }),
    ).toBe("needsNode");
    expect(providerState(undefined, { state: "notInstalled", reason: "node-too-old" })).toBe(
      "needsNode",
    );
    expect(providerState(undefined, { state: "installing", progress: 0.5 })).toBe("installing");
  });

  it("maps sign-in from the agent, else from the CLI's sign-in file", () => {
    expect(providerState(cli(null, "signedIn"), { state: "authRequired", authMethods: [] })).toBe(
      "signedOut",
    );
    expect(providerState(cli(null, "signedOut"), ready)).toBe("signedOut");
    expect(providerState(cli(null, "unknown"), undefined)).toBe("unknown");
  });

  it("can open a sign-in console with a CLI on PATH or the one Xora installed", () => {
    expect(canOpenLogin(cli("/bin/codex", "signedOut"))).toBe(true);
    expect(canOpenLogin(cli(null, "signedOut", "C:/x/.bin/codex.cmd"))).toBe(true);
    expect(canOpenLogin(cli(null, "signedOut"))).toBe(false);
    expect(canOpenLogin(undefined)).toBe(false);
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

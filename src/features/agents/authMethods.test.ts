import { describe, expect, it } from "vitest";
import { subscriptionAuthMethods } from "./authMethods";

const m = (id: string) => ({ id, name: id });

describe("subscriptionAuthMethods", () => {
  it("keeps only subscription sign-in for each agent", () => {
    const gemini = [m("oauth-personal"), m("gemini-api-key"), m("vertex-ai"), m("gateway")];
    expect(subscriptionAuthMethods("gemini", gemini).map((x) => x.id)).toEqual(["oauth-personal"]);
    const claude = [m("claude-ai-login"), m("console-login")];
    expect(subscriptionAuthMethods("claude", claude).map((x) => x.id)).toEqual(["claude-ai-login"]);
    const codex = [m("api-key"), m("chat-gpt"), m("chat-gpt-device-code")];
    expect(subscriptionAuthMethods("codex", codex).map((x) => x.id)).toEqual(["chat-gpt"]);
  });

  it("falls back to everything when an agent renames its methods", () => {
    const renamed = [m("new-login")];
    expect(subscriptionAuthMethods("codex", renamed)).toEqual(renamed);
  });
});

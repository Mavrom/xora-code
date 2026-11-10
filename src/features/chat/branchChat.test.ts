import { describe, expect, it } from "vitest";
import type { ChatItem } from "@/features/agents/reducer";
import type { AcpContentBlock } from "@/features/agents/types";
import { branchDraft, branchTitle } from "./branchChat";

const blocks: AcpContentBlock[] = [
  { type: "text", text: "saatleri de göster" },
  { type: "resource_link", uri: "file:///C:/repo/a.ts", name: "a.ts" },
];
const kept = [
  { kind: "user", id: "u1", blocks: [{ type: "text", text: "README'yi özetle" }] },
  { kind: "agent", id: "a1", text: "Özet hazır." },
] as ChatItem[];
const meta = { title: "README", agent: "Gemini CLI", date: new Date(0) };

describe("branchDraft", () => {
  it("gives a fork the edited message and its attachments only", () => {
    const draft = branchDraft({ via: "fork", blocks, kept }, meta);
    expect(draft.text).toBe("saatleri de göster");
    expect(draft.attachments.map((a) => a.path)).toEqual(["C:\\repo\\a.ts"]);
    expect(draft.dropped).toBe(0);
  });

  it("puts the conversation before the message for the summary fallback", () => {
    const draft = branchDraft({ via: "summary", blocks, kept }, meta);
    expect(draft.text).toContain("> README'yi özetle");
    expect(draft.text).toContain("Özet hazır.");
    expect(draft.text.endsWith("---\n\nsaatleri de göster")).toBe(true);
    expect(draft.attachments).toHaveLength(1);
  });
});

describe("branchTitle", () => {
  it("marks the branch once", () => {
    expect(branchTitle("README")).toBe("Dal: README");
    expect(branchTitle("Dal: README")).toBe("Dal: README");
  });
});

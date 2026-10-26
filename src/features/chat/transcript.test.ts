import { describe, expect, it } from "vitest";
import type { ChatItem } from "@/features/agents/reducer";
import { handoffPrompt, transcriptFileName, transcriptMarkdown } from "./transcript";

const items = [
  { kind: "user", id: "1", blocks: [{ type: "text", text: "README'yi özetle\nkısa olsun" }] },
  { kind: "thought", id: "2", text: "gizli", startedAt: 0, endedAt: 1 },
  {
    kind: "tool",
    id: "3",
    call: { toolCallId: "t", title: "Read `README.md`", status: "completed" },
    startedAt: 0,
    endedAt: 1,
  },
  {
    kind: "tool",
    id: "4",
    call: { toolCallId: "u", title: "grep", status: "failed" },
    startedAt: 0,
    endedAt: 1,
  },
  { kind: "agent", id: "5", text: "Özet: **Xora** bir editör." },
] as unknown as ChatItem[];

describe("transcriptMarkdown", () => {
  const md = transcriptMarkdown("README özeti", items, { agent: "Claude Code", date: new Date(0) });

  it("has the title, the quoted prompt and the reply, without thinking", () => {
    expect(md.startsWith("# README özeti\n")).toBe(true);
    expect(md).toContain("**Sen**\n\n> README'yi özetle\n> kısa olsun");
    expect(md).toContain("Özet: **Xora** bir editör.");
    expect(md).not.toContain("gizli");
  });

  it("lists tool steps as one line each, grouped", () => {
    expect(md).toContain("- `Read 'README.md'` — tamam\n- `grep` — başarısız");
  });
});

describe("transcriptFileName", () => {
  it("strips characters Windows refuses", () => {
    expect(transcriptFileName('Neden "x/y" çalışmıyor?')).toBe("Neden xy çalışmıyor.md");
    expect(transcriptFileName("   ")).toBe("sohbet.md");
  });
});

describe("handoffPrompt", () => {
  it("names the previous agent and carries the transcript", () => {
    const text = handoffPrompt("Claude Code", "# Başlık\n\niçerik");
    expect(text).toContain("Claude Code ile yürütüyordum");
    expect(text.endsWith("# Başlık\n\niçerik")).toBe(true);
  });

  it("keeps the latest part of a long transcript", () => {
    const text = handoffPrompt("Codex", `${"a".repeat(50)}SON`, 10);
    expect(text).toContain("konuşmanın başı kısaltıldı");
    expect(text.endsWith("aaaaaaaSON")).toBe(true);
  });
});

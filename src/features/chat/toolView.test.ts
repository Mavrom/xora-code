import { describe, expect, it } from "vitest";
import type { AcpPermissionOption, AcpToolCall } from "@/features/agents/types";
import {
  localPath,
  messageImagePaths,
  toolImages,
  defaultAllow,
  defaultReject,
  fileName,
  opensByDefault,
  permissionLabel,
  terminalPreview,
  toolDiffs,
  toolTerminals,
  toolText,
} from "./toolView";

const call: AcpToolCall = {
  toolCallId: "t1",
  title: "Edit lib.rs",
  kind: "edit",
  status: "completed",
  content: [
    { type: "content", content: { type: "text", text: "Applied." } },
    { type: "diff", path: "C:/p/lib.rs", oldText: "a", newText: "b" },
    { type: "terminal", terminalId: "term-1" },
    { type: "content", content: { type: "resource", resource: { uri: "x", text: "more" } } },
  ],
};

describe("tool content helpers", () => {
  it("separates diffs, terminals and text", () => {
    expect(toolDiffs(call).map((d) => d.path)).toEqual(["C:/p/lib.rs"]);
    expect(toolTerminals(call)).toEqual(["term-1"]);
    expect(toolText(call)).toBe("Applied.\n\nmore");
    expect(toolText({})).toBe("");
  });

  it("opens edits with diffs and failures by default", () => {
    expect(opensByDefault(call)).toBe(true);
    expect(opensByDefault({ toolCallId: "r", title: "Read", kind: "read" })).toBe(false);
    expect(opensByDefault({ toolCallId: "f", title: "Run", status: "failed" })).toBe(true);
  });
});

describe("terminalPreview", () => {
  const output = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n") + "\n\n";

  it("keeps the tail and counts what is hidden", () => {
    const preview = terminalPreview(output, 12);
    expect(preview.hidden).toBe(8);
    expect(preview.lines[0]).toBe("line 9");
    expect(preview.lines).toHaveLength(12);
  });

  it("shows everything when expanded or short, nothing for empty output", () => {
    expect(terminalPreview(output, 12, true).lines).toHaveLength(20);
    expect(terminalPreview("a\r\nb", 12)).toEqual({ lines: ["a", "b"], hidden: 0 });
    expect(terminalPreview("")).toEqual({ lines: [], hidden: 0 });
  });
});

describe("fileName", () => {
  it("takes the last segment of either separator", () => {
    expect(fileName("C:\\p\\src\\lib.rs")).toBe("lib.rs");
    expect(fileName("/a/b/")).toBe("b");
  });
});

describe("permission defaults", () => {
  const options: AcpPermissionOption[] = [
    { optionId: "always", name: "Her zaman", kind: "allow_always" },
    { optionId: "once", name: "İzin ver", kind: "allow_once" },
    { optionId: "never", name: "Asla", kind: "reject_always" },
    { optionId: "no", name: "Reddet", kind: "reject_once" },
  ];

  it("prefers the one-time options", () => {
    expect(defaultAllow(options)?.optionId).toBe("once");
    expect(defaultReject(options)?.optionId).toBe("no");
  });

  it("falls back to the always options, then null", () => {
    expect(defaultAllow([options[0]])?.optionId).toBe("always");
    expect(defaultReject([options[2]])?.optionId).toBe("never");
    expect(defaultAllow([options[3]])).toBeNull();
  });
});

describe("permissionLabel", () => {
  const opt = (optionId: string, kind: AcpPermissionOption["kind"], name: string) => ({
    optionId,
    kind,
    name,
  });

  it("translates unique kinds", () => {
    const options = [
      opt("a", "allow_once", "Yes"),
      opt("b", "allow_always", "Yes, allow all edits during this session"),
      opt("c", "reject_once", "No"),
    ];
    expect(options.map((o) => permissionLabel(o, options))).toEqual([
      "İzin ver",
      "Hep izin ver",
      "Reddet",
    ]);
  });

  it("keeps the agent's wording when kinds repeat", () => {
    const options = [opt("a", "allow_once", "Allow read"), opt("b", "allow_once", "Allow write")];
    expect(permissionLabel(options[1], options)).toBe("Allow write");
  });
});

describe("toolImages", () => {
  const png = "C:/Users/me/.codex/generated_images/a/b.png";
  const call = (content: unknown[]) =>
    ({ content: content.map((c) => ({ type: "content", content: c })) }) as Parameters<
      typeof toolImages
    >[0];

  it("takes inline image blocks, keeping their file", () => {
    const images = toolImages(
      call([{ type: "image", data: "AAA", mimeType: "image/png", uri: png }]),
    );
    expect(images).toEqual([
      { key: "img-0", kind: "data", mimeType: "image/png", data: "AAA", path: png },
    ]);
  });

  it("reads linked image files once, ignoring other links", () => {
    const images = toolImages(
      call([
        { type: "resource_link", name: "b", uri: `file:///${png}` },
        { type: "resource_link", name: "b", uri: png },
        { type: "resource_link", name: "notes", uri: "C:/notes.txt" },
        { type: "resource_link", name: "web", uri: "https://example.com/a.png" },
      ]),
    );
    expect(images).toEqual([{ key: "link-0", kind: "file", path: png }]);
  });
});

describe("localPath", () => {
  it("turns file URIs into paths and leaves plain paths", () => {
    expect(localPath("file:///C:/a%20b/c.png")).toBe("C:/a b/c.png");
    expect(localPath(String.raw`C:\a\c.png`)).toBe(String.raw`C:\a\c.png`);
    expect(localPath("https://x/y.png")).toBeNull();
  });
});

describe("messageImagePaths", () => {
  it("finds Windows, POSIX and file:// picture paths in prose", () => {
    const text = [
      String.raw`Kaydettim: C:\Users\me\My Pics\out.png ve`,
      "`/home/me/a b.txt` değil, /tmp/gen/x.webp oldu.",
      "![önizleme](file:///D:/art/y%20z.jpg)",
      String.raw`Tekrar: c:\users\me\my pics\OUT.png`,
      "Web: https://example.com/z.png",
    ].join("\n");
    expect(messageImagePaths(text)).toEqual([
      String.raw`C:\Users\me\My Pics\out.png`,
      "/tmp/gen/x.webp",
      "D:/art/y z.jpg",
    ]);
  });
});

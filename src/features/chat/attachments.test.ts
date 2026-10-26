import { describe, expect, it } from "vitest";
import {
  attachmentFromPath,
  bytesToBase64,
  fileUri,
  imageMime,
  toBlocks,
  type Attachment,
} from "./attachments";

describe("imageMime / fileUri / bytesToBase64", () => {
  it("knows the picture types agents take", () => {
    expect(imageMime("C:\\a\\Shot.PNG")).toBe("image/png");
    expect(imageMime("x.jpeg")).toBe("image/jpeg");
    expect(imageMime("notes.md")).toBeNull();
  });

  it("builds file URIs with forward slashes and escaped characters", () => {
    expect(fileUri("C:\\My Docs\\a#1.txt")).toBe("file:///C:/My%20Docs/a%231.txt");
    expect(fileUri("/home/u/x")).toBe("file:///home/u/x");
  });

  it("encodes bytes as base64", () => {
    expect(bytesToBase64(new TextEncoder().encode("hi!"))).toBe("aGkh");
  });
});

describe("toBlocks", () => {
  const image: Attachment = {
    id: "1",
    kind: "image",
    name: "a.png",
    path: "C:\\a.png",
    data: "AAA",
    mimeType: "image/png",
  };
  const folder: Attachment = { id: "2", kind: "folder", name: "src", path: "C:\\p\\src" };

  it("sends text, images and links in order", () => {
    expect(toBlocks("bak", [image, folder], true)).toEqual([
      { type: "text", text: "bak" },
      { type: "image", data: "AAA", mimeType: "image/png" },
      { type: "resource_link", uri: "file:///C:/p/src/", name: "src", mimeType: null },
    ]);
  });

  it("falls back to a link when the agent takes no images, and drops empty text", () => {
    expect(toBlocks("  ", [image], false)).toEqual([
      { type: "resource_link", uri: "file:///C:/a.png", name: "a.png", mimeType: "image/png" },
    ]);
  });
});

describe("attachmentFromPath", () => {
  it("reads pictures and leaves other files as paths", async () => {
    const read = async () => new TextEncoder().encode("hi!").buffer;
    const pic = await attachmentFromPath("C:\\x\\a.png", "file", read);
    expect(pic).toMatchObject({ kind: "image", name: "a.png", data: "aGkh" });
    const doc = await attachmentFromPath("C:\\x\\b.md", "file", read);
    expect(doc).toMatchObject({ kind: "file", name: "b.md", path: "C:\\x\\b.md" });
    expect(doc.data).toBeUndefined();
  });
});

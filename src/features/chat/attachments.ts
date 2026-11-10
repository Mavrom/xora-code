// Things attached to a message: pictures go to the agent as real images, files and folders
// as links it can open. Shown as cards above the composer, never as text in the draft.
import type { AcpContentBlock } from "@/features/agents/types";
import { basename } from "@/shared/lib/path";

export type AttachmentKind = "image" | "file" | "folder";

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  /** On disk; null for a pasted picture. */
  path: string | null;
  /** Images only: base64 bytes and their type. */
  data?: string;
  mimeType?: string;
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** The image type of a path by extension, or null when it is not a picture agents take. */
export function imageMime(path: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  return (ext && IMAGE_TYPES[ext]) || null;
}

/** `C:\a b\c.png` -> `file:///C:/a%20b/c.png`. */
export function fileUri(path: string): string {
  const slashed = path.replace(/\\/g, "/");
  const rooted = slashed.startsWith("/") ? slashed : `/${slashed}`;
  return `file://${encodeURI(rooted).replace(/#/g, "%23").replace(/\?/g, "%3F")}`;
}

/** Base64 of raw bytes, in chunks so large pictures do not overflow the call stack. */
export function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** The message as ACP blocks: the text, then each attachment. */
export function toBlocks(
  text: string,
  attachments: readonly Attachment[],
  imagesSupported: boolean,
): AcpContentBlock[] {
  const blocks: AcpContentBlock[] = [];
  if (text.trim()) blocks.push({ type: "text", text });
  for (const a of attachments) {
    if (a.kind === "image" && a.data && a.mimeType && imagesSupported) {
      blocks.push({ type: "image", data: a.data, mimeType: a.mimeType });
    } else if (a.path) {
      blocks.push({
        type: "resource_link",
        uri: fileUri(a.kind === "folder" ? a.path.replace(/[\\/]*$/, "/") : a.path),
        name: a.name,
        mimeType: a.mimeType ?? null,
      });
    }
  }
  return blocks;
}

/** `file:///C:/a%20b/c.png` -> `C:\a b\c.png` (the reverse of {@link fileUri}), or null. */
export function pathFromFileUri(uri: string): string | null {
  if (!uri.startsWith("file://")) return null;
  let path: string;
  try {
    path = decodeURIComponent(uri.slice("file://".length));
  } catch {
    return null;
  }
  if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1).replace(/\//g, "\\");
  return path.replace(/(?<=.)[\\/]+$/, "") || null;
}

/**
 * A sent message back as a draft ("Edit and retry"): its text and the attachments the
 * composer can show again (pictures, files and folders on disk). `dropped` counts the rest
 * (embedded file contents, audio, non-file links), which cannot be put back as they were.
 */
export function draftFromBlocks(blocks: readonly AcpContentBlock[]): {
  text: string;
  attachments: Attachment[];
  dropped: number;
} {
  const texts: string[] = [];
  const attachments: Attachment[] = [];
  let dropped = 0;
  blocks.forEach((b, i) => {
    if (b.type === "text") {
      texts.push(b.text);
    } else if (b.type === "image") {
      attachments.push({
        id: newId(),
        kind: "image",
        name: `image-${i + 1}`,
        path: null,
        data: b.data,
        mimeType: b.mimeType,
      });
    } else if (b.type === "resource_link" && pathFromFileUri(b.uri)) {
      const path = pathFromFileUri(b.uri)!;
      const folder = /\/$/.test(b.uri);
      attachments.push({
        id: newId(),
        kind: folder ? "folder" : "file",
        name: b.name || basename(path),
        path,
        ...(b.mimeType ? { mimeType: b.mimeType } : {}),
      });
    } else {
      dropped++;
    }
  });
  return { text: texts.join("\n\n").trim(), attachments, dropped };
}

let nextId = 0;
const newId = () => `att-${Date.now().toString(36)}-${nextId++}`;

/** An attachment for a file or folder on disk; pictures are read so they can be sent. */
export async function attachmentFromPath(
  path: string,
  kind: "file" | "folder",
  readBytes: (path: string) => Promise<ArrayBuffer>,
): Promise<Attachment> {
  const name = basename(path.replace(/[\\/]+$/, "")) || path;
  const mimeType = kind === "file" ? imageMime(path) : null;
  if (!mimeType) return { id: newId(), kind, name, path };
  return {
    id: newId(),
    kind: "image",
    name,
    path,
    mimeType,
    data: bytesToBase64(await readBytes(path)),
  };
}

/** An attachment for a picture pasted from the clipboard. */
export async function attachmentFromBlob(blob: Blob, name: string): Promise<Attachment> {
  return {
    id: newId(),
    kind: "image",
    name,
    path: null,
    mimeType: blob.type || "image/png",
    data: bytesToBase64(await blob.arrayBuffer()),
  };
}

/** `data:` URL for showing an image attachment or block. */
export const dataUrl = (mimeType: string, data: string) => `data:${mimeType};base64,${data}`;

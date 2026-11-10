import type { Dispatch, RefObject, SetStateAction } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { errorMessage } from "@/features/agents/ipc";
import { ipc } from "@/shared/lib/ipc";
import { t } from "@/shared/i18n";
import { attachmentFromPath, type Attachment } from "./attachments";
import type { ComposerHandle } from "./Composer";
import { useFileDrop } from "./useFileDrop";

/**
 * Ways to add attachments to the chat's draft: the file and folder pickers, a path (the open
 * file, an "@" mention) and files dropped from Explorer. Returns whether a drag is over the window.
 */
export function useAttachmentInput(
  cwd: string | null,
  setAttachments: Dispatch<SetStateAction<Attachment[]>>,
  composerRef: RefObject<ComposerHandle | null>,
  say: (text: string) => void,
) {
  const addAttachments = async (pending: Promise<Attachment>[]) => {
    const results = await Promise.allSettled(pending);
    const added = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failed = results.find((r) => r.status === "rejected");
    if (added.length > 0) {
      // The same file twice is one attachment.
      setAttachments((list) => [
        ...list,
        ...added.filter((a) => !a.path || !list.some((b) => b.path === a.path)),
      ]);
      composerRef.current?.focus();
    }
    if (failed) say(t("Could not attach: {reason}", { reason: errorMessage(failed.reason) }));
  };

  const attachPaths = (paths: string[], kind: "file" | "folder") =>
    void addAttachments(paths.map((p) => attachmentFromPath(p, kind, ipc.readBytes)));

  const attach = async (directory: boolean) => {
    const picked = await open({
      title: directory ? t("Add folder") : t("Add file"),
      multiple: true,
      directory,
      defaultPath: cwd ?? undefined,
    }).catch(() => null);
    attachPaths(
      Array.isArray(picked) ? picked : picked ? [picked] : [],
      directory ? "folder" : "file",
    );
  };

  // Dropped from Explorer: folders by what the backend can list, everything else as files.
  const dropping = useFileDrop(
    (paths) =>
      void addAttachments(
        paths.map((path) =>
          ipc.listDir(path).then(
            () => attachmentFromPath(path, "folder", ipc.readBytes),
            () => attachmentFromPath(path, "file", ipc.readBytes),
          ),
        ),
      ),
  );

  return { addAttachments, attachPaths, attach, dropping };
}

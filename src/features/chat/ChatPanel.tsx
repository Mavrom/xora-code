import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { errorMessage, isAuthRequired } from "@/features/agents/ipc";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import type { AgentId, AgentStatus } from "@/features/agents/types";
import { openFolder } from "@/features/workspace/openFolder";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useEditorStore } from "@/features/editor/store";
import { fileKey } from "@/features/editor/tabKind";
import { basename } from "@/shared/lib/path";
import { useHostname } from "@/shared/lib/useHostname";
import { useWorktreeStore } from "@/features/git/worktrees";
import { ConversationScrim } from "@/features/backdrop/ConversationScrim";
import { AgentStatusCard } from "./AgentStatusCard";
import { CheckoutChip } from "./CheckoutChip";
import { ChangesPill } from "./ChangesPill";
import { Composer, type ComposerHandle } from "./Composer";
import { AttachMenu, ContextMeter, ContextRow, FolderChip, HostChip } from "./ComposerToolbar";
import { SettingsChip } from "./SettingsChip";
import { attachmentFromBlob, toBlocks, type Attachment } from "./attachments";
import { editAndRetry } from "./branchChat";
import { PermissionPrompt } from "./PermissionPrompt";
import { QueuedPrompts, StopHint } from "./QueuedPrompts";
import { StartingPointList } from "./StartingPointList";
import type { XoraCommandName } from "./slash";
import { isDocked } from "./sessionTitle";
import { needsStatusCard } from "./toolView";
import { ensureSession, useGitBranch, useWarmSession } from "./useChatSession";
import { DropOverlay } from "./DropOverlay";
import { useAttachmentInput } from "./useAttachmentInput";
import { useComposerEvents } from "./useComposerEvents";
import { t } from "@/shared/i18n";

const NOTICE_MS = 3200;

/**
 * Places an agent can run. Only this computer today (HostChip's menu has that one entry), so
 * the host chip carries no information and stays hidden; the computer's name is on the
 * sidebar's account card. Remote hosts or accounts would raise this.
 */
const HOST_ENVIRONMENTS: number = 1;

/** Whether the agent accepts image blocks in a prompt (ACP `promptCapabilities.image`). */
function takesImages(status: AgentStatus): boolean {
  if (status.state !== "ready") return false;
  const caps = status.capabilities as { promptCapabilities?: { image?: boolean } } | null;
  return caps?.promptCapabilities?.image === true;
}

/** A failed sign-in, worded for the card (the agent's own reason when it gave one). */
function authFailureText(err: unknown): string {
  const reason = errorMessage(err)
    .replace(/^auth_required:/, "")
    .trim();
  return reason ? t("Sign-in failed: {reason}", { reason }) : t("Sign-in failed.");
}

// The transcript (markdown, sanitiser, code highlighting) is only needed once a chat has
// messages; keeping it out of the entry chunk makes cold start lighter.
const MessageList = lazy(() => import("./MessageList").then((m) => ({ default: m.MessageList })));

/** DEV-only `?fixture=` screenshot knobs: the cwd the fixture sessions use, an open chip. */
function devFixture(): { cwd: string; open: boolean } | null {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("fixture")) return null;
  const open = params.get("open");
  return {
    cwd: "C:\\Users\\dev\\projects\\xora-demo",
    open: open === "picker",
  };
}
const FIXTURE = devFixture();

/** The chat: a centred hero composer when empty, transcript plus docked composer after. */
export function ChatPanel() {
  const root = useWorkspaceStore((s) => s.root);
  const session = useAgentStore(selectActiveSession);
  const agents = useAgentStore((s) => s.agents);
  const selectedAgent = useAgentStore((s) => s.selectedAgent);
  const composerRef = useRef<ComposerHandle>(null);
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  const [authError, setAuthError] = useState<{ agentId: AgentId; text: string } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const agentId = session?.agentId ?? selectedAgent;
  const agent = agents[agentId];
  // A new chat starts in the checkout picked on the chip (a worktree), else the folder.
  const checkout = useWorktreeStore((s) => s.selected);
  const cwd = session?.cwd || checkout || root || FIXTURE?.cwd || null;
  const docked = isDocked(session);
  const turn = session?.turn ?? "idle";
  const running = turn !== "idle";
  const hostname = useHostname();
  const activeFile = useEditorStore((s) => fileKey(s.activePath));
  const branch = useGitBranch(cwd, session?.lastStopReason, FIXTURE ? "main" : null);

  useWarmSession(session === null, agentId, cwd, agent.status);

  useComposerEvents(composerRef);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const say = (text: string) => setNotice((prev) => ({ text, key: (prev?.key ?? 0) + 1 }));
  const store = () => useAgentStore.getState();

  const blockedReason = !cwd
    ? t("Open a folder first; the agent works in that folder.")
    : needsStatusCard(agent.status) && agent.status.state !== "starting"
      ? t("{name} is not ready yet.", { name: agent.displayName })
      : null;

  const submit = async (text: string) => {
    if (!cwd) return;
    const sent = attachments;
    setAttachments([]);
    try {
      const id = session?.sessionId ?? (await ensureSession(agentId, cwd));
      await store().prompt(id, toBlocks(text, sent, takesImages(agent.status)));
    } catch (err) {
      composerRef.current?.fill(text);
      setAttachments(sent);
      if (!isAuthRequired(err)) say(errorMessage(err));
    }
  };

  // "Edit and retry": the branched chat opens and its composer gets the message back.
  const branching = useRef(false);
  const editAndRetryFrom = async (sourceId: string, itemId: string) => {
    if (branching.current) return;
    branching.current = true;
    try {
      const draft = await editAndRetry(sourceId, itemId);
      setAttachments(draft.attachments);
      // The branched chat's composer mounts on the next frame (as with a hand-off).
      requestAnimationFrame(() => composerRef.current?.fill(draft.text));
      if (draft.dropped > 0) {
        say(t("{count} attachment(s) could not be put back.", { count: draft.dropped }));
      }
    } catch (err) {
      if (!isAuthRequired(err)) say(errorMessage(err));
    } finally {
      branching.current = false;
    }
  };

  const newChat = () => {
    if (session && session.items.length === 0) return;
    store().setActiveSession(null);
    composerRef.current?.focus();
  };

  const onXoraCommand = (name: XoraCommandName) => {
    if (name === "new") newChat();
    if (name === "clear" && session) {
      void store().closeSession(session.sessionId);
      store().setActiveSession(null);
    }
  };

  const selectAgent = async (id: AgentId) => {
    if (id === agentId) return;
    if (running) {
      const ok = await ask(
        t("A new chat with {name} will open; the running turn continues in the background.", {
          name: agents[id].displayName,
        }),
        {
          title: t("Switch agent?"),
          kind: "warning",
          okLabel: t("New chat"),
          cancelLabel: t("Cancel"),
        },
      );
      if (!ok) return;
    }
    store().selectAgent(id);
    // An untouched session of the old agent is just closed; a real one stays in history.
    if (session && session.items.length === 0) void store().closeSession(session.sessionId);
    store().setActiveSession(null);
  };

  const setControl = (key: string, value: string | boolean) => {
    if (!session) return;
    store()
      .setControl(session.sessionId, key, value)
      .catch((err: unknown) =>
        say(t("Could not change the setting: {err}", { err: errorMessage(err) })),
      );
  };

  const { addAttachments, attachPaths, attach, dropping } = useAttachmentInput(
    cwd,
    setAttachments,
    composerRef,
    say,
  );

  const sessionId = session?.sessionId ?? null;
  const permission = session?.permissions[0] ?? null;
  const hero = !docked;
  // The repository's name, also while the chat runs in one of its worktrees.
  const repoPath = root || cwd;
  const projectName = repoPath ? basename(repoPath.replace(/[\\/]+$/, "")) : null;
  const folderChip = <FolderChip folderName={projectName} onOpenFolder={() => void openFolder()} />;

  const composer = (
    <>
      {needsStatusCard(agent.status) && (
        <div className="mb-3">
          <AgentStatusCard
            agent={agent}
            authError={authError?.agentId === agentId ? authError.text : null}
            onInstall={() =>
              void store()
                .install(agentId)
                .catch((e: unknown) => say(errorMessage(e)))
            }
            onAuthenticate={(methodId) => {
              setAuthError(null);
              void store()
                .authenticate(agentId, methodId)
                .catch((e: unknown) => setAuthError({ agentId, text: authFailureText(e) }));
            }}
            onRestart={() =>
              void store()
                .restart(agentId)
                .catch((e: unknown) => say(errorMessage(e)))
            }
          />
        </div>
      )}
      {permission && session && (
        <div className="mb-3">
          <PermissionPrompt
            request={permission}
            queued={session.permissions.length - 1}
            onRespond={(requestId, optionId) =>
              void store()
                .respondPermission(requestId, optionId)
                .catch((e: unknown) => say(errorMessage(e)))
            }
          />
        </div>
      )}
      {session && !running && (
        <ChangesPill
          changes={session.changes}
          onAccept={() =>
            void store()
              .acceptChanges(session.sessionId)
              .catch((e: unknown) => say(errorMessage(e)))
          }
        />
      )}
      {session && session.queued.length > 0 && <QueuedPrompts session={session} />}
      <Composer
        ref={composerRef}
        variant={hero ? "hero" : "docked"}
        blockedReason={blockedReason}
        turn={turn}
        commands={session?.commands ?? []}
        toolbar={
          <>
            <AttachMenu
              onPickFiles={() => void attach(false)}
              onPickFolder={() => void attach(true)}
              openFile={
                activeFile
                  ? { name: basename(activeFile), onAdd: () => attachPaths([activeFile], "file") }
                  : null
              }
            />
            <SettingsChip
              agents={agents}
              agentId={agentId}
              controls={session?.controls ?? null}
              onSelectAgent={(id) => void selectAgent(id)}
              onSetControl={setControl}
              defaultOpen={FIXTURE?.open}
            />
          </>
        }
        meter={
          session?.usage && session.usage.size > 0 ? (
            <ContextMeter used={session.usage.used} size={session.usage.size} />
          ) : null
        }
        attachments={attachments}
        mentionRoot={cwd}
        onMention={(path) => attachPaths([path], "file")}
        onRemoveAttachment={(id) => setAttachments((list) => list.filter((a) => a.id !== id))}
        onPasteImages={(files) =>
          void addAttachments(
            files.map((f, i) => attachmentFromBlob(f, f.name || `screenshot-${i + 1}.png`)),
          )
        }
        onSubmit={(text) => void submit(text)}
        onStop={() => session && void store().cancel(session.sessionId)}
        onXoraCommand={onXoraCommand}
        onRefused={say}
      />
      <ContextRow
        folder={folderChip}
        checkout={
          root && cwd ? (
            <CheckoutChip
              repo={root}
              cwd={cwd}
              chatTitle={session?.title ?? null}
              branch={branch}
              onNotice={say}
            />
          ) : null
        }
        branch={branch}
        aside={running ? <StopHint /> : null}
      />
      <div role="status" aria-atomic="true" className="min-h-4.5 px-2 pt-1 text-2xs text-fg-muted">
        {notice && (
          <span key={notice.key} className="transition-opacity duration-base starting:opacity-0">
            {notice.text}
          </span>
        )}
      </div>
    </>
  );

  if (hero) {
    return (
      <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto">
        <div aria-hidden className="min-h-6 flex-1" />
        <section aria-label={t("New chat")} className="mx-auto w-full max-w-186 px-6">
          {/* Where the agent runs: a chip only once there is more than one place to choose. */}
          {HOST_ENVIRONMENTS > 1 && (
            <div className="mb-1 flex justify-end">
              <HostChip hostname={hostname} />
            </div>
          )}
          {composer}
        </section>
        {/* The starting points live in the space under the composer, so they never move it:
            this spacer keeps its share of the height whether they are there or not. */}
        <div className="min-h-6 flex-[1.15]">
          <div className="mx-auto w-full max-w-186 px-6 pt-1 @container">
            <StartingPointList
              root={root}
              cwd={cwd}
              currentSessionId={sessionId}
              onPrompt={(text) => composerRef.current?.fill(text)}
            />
          </div>
        </div>
        {dropping && <DropOverlay />}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* First, so the (positioned) transcript and composer paint over it. */}
      <ConversationScrim />
      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <MessageList
          session={session}
          onEditAndRetry={(itemId) => void editAndRetryFrom(session.sessionId, itemId)}
        />
      </Suspense>
      <div className="relative mx-auto w-full max-w-180 px-4 pt-1 pb-2">{composer}</div>
      {dropping && <DropOverlay />}
    </div>
  );
}

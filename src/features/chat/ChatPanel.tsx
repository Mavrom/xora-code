import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { X } from "lucide-react";
import { errorMessage, isAuthRequired } from "@/features/agents/ipc";
import type { SessionView } from "@/features/agents/reducer";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import type { AgentId } from "@/features/agents/types";
import { openFolder } from "@/features/workspace/openFolder";
import { useWorkspaceStore } from "@/features/workspace/store";
import { basename } from "@/shared/lib/path";
import { useHostname } from "@/shared/lib/useHostname";
import { Kbd } from "@/shared/ui/Kbd";
import { AgentStatusCard } from "./AgentStatusCard";
import { ChangesBar } from "./ChangesBar";
import { Composer, type ComposerHandle } from "./Composer";
import {
  AttachButton,
  ContextMeter,
  ContextRow,
  FolderChip,
  HostChip,
  ModelPicker,
  type OpenChip,
} from "./ComposerToolbar";
import { mentionFor } from "./mentions";
import { PermissionPrompt } from "./PermissionPrompt";
import type { XoraCommandName } from "./slash";
import { isDocked } from "./sessionTitle";
import { needsStatusCard } from "./toolView";
import { NEW_CHAT, onChatDraft, onCommand } from "@/features/commands/events";
import { isPaletteOpen } from "@/features/commands/paletteGuard";
import { ensureSession, useGitBranch, useWarmSession } from "./useChatSession";

const NOTICE_MS = 3200;

/** A failed sign-in, worded for the card (the agent's own reason when it gave one). */
function authFailureText(err: unknown): string {
  const reason = errorMessage(err)
    .replace(/^auth_required:/, "")
    .trim();
  return reason ? `Giriş başarısız: ${reason}` : "Giriş başarısız.";
}

// The transcript (markdown, sanitiser, code highlighting) is only needed once a chat has
// messages; keeping it out of the entry chunk makes cold start lighter.
const MessageList = lazy(() => import("./MessageList").then((m) => ({ default: m.MessageList })));

/** DEV-only `?fixture=` screenshot knobs: the cwd the fixture sessions use, an open chip. */
function devFixture(): { cwd: string; open: OpenChip } | null {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("fixture")) return null;
  const open = params.get("open");
  return {
    cwd: "C:\\Users\\dev\\projects\\xora-demo",
    open: open === "picker" || open === "mode" ? open : null,
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

  const agentId = session?.agentId ?? selectedAgent;
  const agent = agents[agentId];
  const cwd = session?.cwd || root || FIXTURE?.cwd || null;
  const docked = isDocked(session);
  const turn = session?.turn ?? "idle";
  const running = turn !== "idle";
  const hostname = useHostname();
  const branch = useGitBranch(cwd, session?.lastStopReason, FIXTURE ? "main" : null);

  useWarmSession(session === null, agentId, cwd, agent.status);

  // An Inbox note sent to the chat lands in the composer, ready to edit and send.
  useEffect(() => onChatDraft((text) => composerRef.current?.fill(text)), []);

  // "Yeni sohbet" from the sidebar, or Ctrl+N anywhere.
  useEffect(() => {
    const start = () => {
      useAgentStore.getState().setActiveSession(null);
      requestAnimationFrame(() => composerRef.current?.focus());
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isPaletteOpen() || !e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.code !== "KeyN") return;
      e.preventDefault();
      start();
    };
    window.addEventListener("keydown", onKeyDown, true);
    const off = onCommand(NEW_CHAT, start);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      off();
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const say = (text: string) => setNotice((prev) => ({ text, key: (prev?.key ?? 0) + 1 }));
  const store = () => useAgentStore.getState();

  const blockedReason = !cwd
    ? "Önce bir klasör aç; agent o klasörde çalışır."
    : needsStatusCard(agent.status) && agent.status.state !== "starting"
      ? `${agent.displayName} henüz hazır değil.`
      : null;

  const submit = async (text: string) => {
    if (!cwd) return;
    try {
      const id = session?.sessionId ?? (await ensureSession(agentId, cwd));
      await store().prompt(id, text);
    } catch (err) {
      composerRef.current?.fill(text);
      if (!isAuthRequired(err)) say(errorMessage(err));
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
        `${agents[id].displayName} ile yeni bir sohbet açılacak; süren tur arka planda devam eder.`,
        {
          title: "Agent değişsin mi?",
          kind: "warning",
          okLabel: "Yeni sohbet",
          cancelLabel: "Vazgeç",
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
      .catch((err: unknown) => say(`Ayar değiştirilemedi: ${errorMessage(err)}`));
  };

  const attach = async () => {
    const picked = await open({
      title: "Dosya ekle",
      multiple: true,
      directory: false,
      defaultPath: cwd ?? undefined,
    }).catch(() => null);
    const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
    if (paths.length > 0)
      composerRef.current?.insert(paths.map((p) => mentionFor(p, cwd)).join(" "));
  };

  const permission = session?.permissions[0] ?? null;
  const side = docked ? "top" : "bottom";
  const hero = !docked;
  const folderChip = (
    <FolderChip
      folderName={cwd ? basename(cwd.replace(/[\\/]+$/, "")) : null}
      onOpenFolder={() => void openFolder()}
    />
  );

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
        <ChangesBar
          changes={session.changes}
          onAccept={() => store().acceptChanges(session.sessionId)}
          onRevert={(path) => store().revertChange(session.sessionId, path)}
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
            <AttachButton onClick={() => void attach()} />
            <ModelPicker
              agents={agents}
              agentId={agentId}
              controls={session?.controls ?? null}
              onSelectAgent={(id) => void selectAgent(id)}
              onSetControl={setControl}
              openChip={FIXTURE?.open}
              side={side}
            />
          </>
        }
        meter={
          session?.usage && session.usage.size > 0 ? (
            <ContextMeter used={session.usage.used} size={session.usage.size} />
          ) : null
        }
        onSubmit={(text) => void submit(text)}
        onStop={() => session && void store().cancel(session.sessionId)}
        onXoraCommand={onXoraCommand}
        onRefused={say}
      />
      <ContextRow
        folder={hero ? null : folderChip}
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
        <section aria-label="Yeni sohbet" className="mx-auto w-full max-w-186 px-6">
          {/* Where the agent will work, just above the field. */}
          <div className="mb-1 flex justify-end gap-1">
            <HostChip hostname={hostname} />
            {folderChip}
          </div>
          {composer}
        </section>
        <div aria-hidden className="min-h-6 flex-[1.15]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <MessageList session={session} />
      </Suspense>
      <div className="mx-auto w-full max-w-180 px-4 pt-1 pb-2">{composer}</div>
    </div>
  );
}

function StopHint() {
  return (
    <p className="flex items-center gap-1.5 text-2xs text-fg-subtle">
      <Kbd keys="escape" />
      <span>durdur</span>
    </p>
  );
}

/** Messages typed during a running turn, sent one by one when it ends. */
function QueuedPrompts({ session }: { session: SessionView }) {
  return (
    <ul aria-label="Sıradaki mesajlar" className="mb-2 flex flex-col gap-1">
      {session.queued.map((blocks, index) => {
        const text = blocks.flatMap((b) => (b.type === "text" ? [b.text] : [])).join(" ");
        return (
          <li
            key={index}
            className="flex h-8 items-center gap-2 rounded-lg border border-glass-border bg-glass pr-1 pl-3 text-xs backdrop-blur-xl"
          >
            <span className="shrink-0 text-2xs text-fg-subtle">Sırada</span>
            <span className="min-w-0 flex-1 truncate text-fg-muted">{text}</span>
            <button
              type="button"
              aria-label="Sıradan çıkar"
              title="Sıradan çıkar"
              onClick={() => useAgentStore.getState().dropQueued(session.sessionId, index)}
              className="grid size-6 place-items-center rounded-md text-fg-subtle transition-colors duration-fast hover:bg-hover hover:text-fg"
            >
              <X size={12} strokeWidth={1.75} aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { SquarePen, X } from "lucide-react";
import { errorMessage, isAuthRequired } from "@/features/agents/ipc";
import type { SessionView } from "@/features/agents/reducer";
import { selectActiveSession, useAgentStore } from "@/features/agents/store";
import type { AcpContentBlock, AgentId } from "@/features/agents/types";
import { openFolder } from "@/features/workspace/openFolder";
import { useWorkspaceStore } from "@/features/workspace/store";
import { basename } from "@/shared/lib/path";
import { IconButton } from "@/shared/ui/IconButton";
import { Kbd } from "@/shared/ui/Kbd";
import { AgentGlyph } from "./AgentGlyph";
import { AgentStatusCard } from "./AgentStatusCard";
import { ChangesBar } from "./ChangesBar";
import { ChatWelcome } from "./ChatWelcome";
import { Composer, type ComposerHandle } from "./Composer";
import { ComposerToolbar, ContextMeter, ContextRow, type OpenChip } from "./ComposerToolbar";
import { PermissionPrompt } from "./PermissionPrompt";
import type { XoraCommandName } from "./slash";
import { needsStatusCard } from "./toolView";
import { ensureSession, useGitBranch, useWarmSession } from "./useChatSession";

const NOTICE_MS = 3200;

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

  const agentId = session?.agentId ?? selectedAgent;
  const agent = agents[agentId];
  const cwd = session?.cwd || root || FIXTURE?.cwd || null;
  const docked = session !== null && (session.items.length > 0 || session.loading);
  const turn = session?.turn ?? "idle";
  const running = turn !== "idle";
  const branch = useGitBranch(cwd, session?.lastStopReason, FIXTURE ? "main" : null);

  useWarmSession(!docked, agentId, cwd, agent.status);

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

  const permission = session?.permissions[0] ?? null;
  const side = docked ? "top" : "bottom";
  const hero = !docked;

  const composer = (
    <>
      {needsStatusCard(agent.status) && (
        <div className="mb-3">
          <AgentStatusCard
            agent={agent}
            onInstall={() =>
              void store()
                .install(agentId)
                .catch((e: unknown) => say(errorMessage(e)))
            }
            onAuthenticate={(methodId) =>
              void store()
                .authenticate(agentId, methodId)
                .catch((e: unknown) => say(errorMessage(e)))
            }
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
          <ComposerToolbar
            controls={session?.controls ?? null}
            onSetControl={setControl}
            openChip={FIXTURE?.open}
            side={side}
          />
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
        agents={agents}
        agentId={agentId}
        controls={session?.controls ?? null}
        onSelectAgent={(id) => void selectAgent(id)}
        onSetControl={setControl}
        folderName={cwd ? basename(cwd.replace(/[\\/]+$/, "")) : null}
        onOpenFolder={() => void openFolder()}
        branch={branch}
        openChip={FIXTURE?.open}
        side={side}
        aside={<ShortcutHint running={running} />}
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
      <div className="flex h-full flex-col overflow-y-auto">
        <div aria-hidden className="min-h-6 flex-1" />
        <div className="mx-auto w-full max-w-180 px-6">
          <ChatWelcome onPick={(text) => composerRef.current?.fill(text)}>{composer}</ChatWelcome>
        </div>
        <div aria-hidden className="min-h-6 flex-[1.35]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatHeader session={session} onNewChat={newChat} />
      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <MessageList session={session} />
      </Suspense>
      <div className="mx-auto w-full max-w-180 px-4 pt-1 pb-2">{composer}</div>
    </div>
  );
}

function ChatHeader({ session, onNewChat }: { session: SessionView; onNewChat: () => void }) {
  const title = session.title ?? firstLine(session.items);
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 pr-2 pl-4">
      <AgentGlyph agent={session.agentId} size={13} className="text-fg-subtle" />
      <h2 className="min-w-0 flex-1 truncate text-xs text-fg-muted" title={title}>
        {title}
      </h2>
      <IconButton icon={SquarePen} label="Yeni sohbet" onClick={onNewChat} />
    </div>
  );
}

function firstLine(items: SessionView["items"]): string {
  for (const item of items) {
    if (item.kind !== "user") continue;
    const text = item.blocks
      .flatMap((b: AcpContentBlock) => (b.type === "text" ? [b.text] : []))
      .join(" ")
      .trim();
    if (text) return text.split("\n")[0];
  }
  return "Yeni sohbet";
}

function ShortcutHint({ running }: { running: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-2xs text-fg-subtle">
      {running ? (
        <>
          <Kbd keys="escape" />
          <span>durdur</span>
        </>
      ) : (
        <>
          <Kbd keys="enter" />
          <span>gönder</span>
          <span aria-hidden className="px-0.5">
            ·
          </span>
          <Kbd keys="/" />
          <span>komutlar</span>
        </>
      )}
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

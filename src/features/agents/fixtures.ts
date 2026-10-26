// Realistic fixture data for the three agents: session setups (as the
// adapters send them, design 4.4), agent statuses, history, and event
// scenarios. Used by tests, by the chat UI's `?fixture=` dev mode and by the
// fake ipc below, which lets the real store run without Rust.

import type { AgentIpc } from "./ipc";
import {
  attachSession,
  createAgentData,
  createSessionView,
  reduceEvents,
  type SessionView,
} from "./reducer";
import type {
  AcpSessionUpdate,
  AgentEvent,
  AgentId,
  AgentInfo,
  AgentSessionInfo,
  AgentStatus,
  SessionSetup,
} from "./types";

export const FIXTURE_CWD = "C:\\Users\\dev\\projects\\xora-demo";
const P = (rel: string) => `${FIXTURE_CWD}\\${rel}`;

// --- Session setups -------------------------------------------------------------

export const FIXTURE_SETUPS: Record<AgentId, SessionSetup> = {
  claude: {
    sessionId: "fixture-claude",
    agentId: "claude",
    // Claude also sends legacy modes; configOptions win (design 4.4).
    modes: {
      currentModeId: "default",
      availableModes: [
        { id: "default", name: "Manual" },
        { id: "acceptEdits", name: "Accept edits" },
        { id: "plan", name: "Plan mode" },
      ],
    },
    configOptions: [
      {
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: "default",
        options: [
          { value: "default", name: "Default", description: "Sonnet 5 (önerilen)" },
          { value: "opus", name: "Opus", description: "En yetenekli model" },
          { value: "haiku", name: "Haiku", description: "Hızlı ve hafif" },
        ],
      },
      {
        id: "mode",
        name: "Mode",
        category: "mode",
        type: "select",
        currentValue: "default",
        options: [
          { value: "default", name: "Manual", description: "Her araç için izin ister" },
          {
            value: "acceptEdits",
            name: "Accept edits",
            description: "Dosya düzenlemelerini onaylar",
          },
          { value: "plan", name: "Plan mode", description: "Önce plan, değişiklik yok" },
          { value: "auto", name: "Auto", description: "Güvenli işlemleri kendi yapar" },
        ],
      },
      {
        id: "effort",
        name: "Effort",
        category: "thought_level",
        type: "select",
        currentValue: "default",
        options: [
          { value: "default", name: "Default" },
          { value: "low", name: "Low" },
          { value: "medium", name: "Medium" },
          { value: "high", name: "High" },
          { value: "max", name: "Max" },
        ],
      },
    ],
    models: null,
    agentCapabilities: {
      loadSession: true,
      promptCapabilities: { image: true, embeddedContext: true },
      sessionCapabilities: { list: {}, resume: {}, close: {}, delete: {} },
    },
  },
  codex: {
    sessionId: "fixture-codex",
    agentId: "codex",
    modes: null,
    configOptions: [
      {
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: "gpt-5.5-codex",
        options: [
          {
            group: "recommended",
            name: "Önerilen",
            options: [{ value: "gpt-5.5-codex", name: "GPT-5.5 Codex" }],
          },
          {
            group: "other",
            name: "Diğer",
            options: [
              { value: "gpt-5.5", name: "GPT-5.5" },
              { value: "gpt-5.5-mini", name: "GPT-5.5 mini" },
            ],
          },
        ],
      },
      {
        id: "mode",
        name: "Mode",
        category: "mode",
        type: "select",
        currentValue: "agent",
        options: [
          { value: "read-only", name: "Read only" },
          { value: "workspace-write", name: "Workspace access" },
          { value: "agent", name: "Auto review" },
          { value: "agent-full-access", name: "Full access" },
        ],
      },
      {
        id: "reasoning_effort",
        name: "Reasoning effort",
        category: "thought_level",
        type: "select",
        currentValue: "medium",
        options: [
          { value: "low", name: "Low" },
          { value: "medium", name: "Medium" },
          { value: "high", name: "High" },
          { value: "xhigh", name: "Extra high" },
        ],
      },
      {
        id: "fast-mode",
        name: "Fast mode",
        category: "model_config",
        type: "boolean",
        currentValue: false,
      },
      {
        id: "collaboration_mode",
        name: "Collaboration",
        category: "_codex_collaboration",
        type: "select",
        currentValue: "default",
        options: [
          { value: "default", name: "Default" },
          { value: "plan", name: "Plan" },
        ],
      },
    ],
    models: null,
    agentCapabilities: {
      loadSession: true,
      promptCapabilities: { image: true, embeddedContext: true },
      sessionCapabilities: { list: {}, resume: {}, close: {}, delete: {} },
    },
  },
  gemini: {
    sessionId: "fixture-gemini",
    agentId: "gemini",
    modes: {
      currentModeId: "default",
      availableModes: [
        { id: "default", name: "Default", description: "Her araç için izin ister" },
        { id: "autoEdit", name: "Auto edit", description: "Düzenlemeleri onaylar" },
        { id: "yolo", name: "YOLO", description: "Her şeyi onaylar" },
        { id: "plan", name: "Plan", description: "Salt okunur planlama" },
      ],
    },
    configOptions: null,
    models: {
      currentModelId: "auto",
      availableModels: [
        { modelId: "auto", name: "Auto", description: "Göreve göre Pro ya da Flash" },
        { modelId: "gemini-3-pro", name: "Gemini 3 Pro" },
        { modelId: "gemini-3-flash", name: "Gemini 3 Flash" },
        { modelId: "gemini-3-flash-lite", name: "Gemini 3 Flash-Lite" },
      ],
    },
    agentCapabilities: {
      loadSession: true,
      promptCapabilities: { image: true, audio: true, embeddedContext: true },
    },
  },
};

// --- Agent statuses ------------------------------------------------------------------

export const FIXTURE_STATUSES = {
  notInstalled: { state: "notInstalled", reason: "package-missing" },
  nodeMissing: { state: "notInstalled", reason: "node-missing" },
  installing: { state: "installing", progress: 0.42 },
  starting: { state: "starting" },
  ready: {
    state: "ready",
    agentInfo: { name: "claude-agent-acp", title: "Claude Code", version: "0.95.0" },
    capabilities: FIXTURE_SETUPS.claude.agentCapabilities,
    authMethods: [],
  },
  authRequired: {
    state: "authRequired",
    authMethods: [
      {
        id: "claude-ai-login",
        name: "Claude Subscription",
        type: "terminal",
        args: ["--cli", "auth", "login", "--claudeai"],
      },
      {
        id: "console-login",
        name: "Anthropic Console",
        type: "terminal",
        args: ["--cli", "auth", "login", "--console"],
      },
    ],
  },
  crashed: {
    state: "crashed",
    code: 1,
    stderrTail: [
      "node:internal/modules/run_main:123",
      "Error: spawn codex.exe ENOENT",
      "    at ChildProcess._handle.onexit (node:internal/child_process:285:19)",
    ],
  },
  stopped: { state: "stopped" },
} satisfies Record<string, AgentStatus>;

export type FixtureStatusName = keyof typeof FIXTURE_STATUSES;

/** One agent per interesting state; override with {@link fixtureAgents}. */
export function fixtureAgents(
  statuses: Partial<Record<AgentId, FixtureStatusName>> = {},
): Record<AgentId, AgentInfo> {
  const pick = (id: AgentId, fallback: FixtureStatusName) =>
    FIXTURE_STATUSES[statuses[id] ?? fallback];
  return {
    claude: {
      id: "claude",
      displayName: "Claude",
      version: "0.95.0",
      status: pick("claude", "ready"),
    },
    codex: { id: "codex", displayName: "Codex", version: "2.2.2", status: pick("codex", "ready") },
    gemini: {
      id: "gemini",
      displayName: "Gemini",
      version: "0.65.0",
      status: pick("gemini", "ready"),
    },
  };
}

export const FIXTURE_AGENTS: AgentInfo[] = Object.values(
  fixtureAgents({ claude: "ready", codex: "authRequired", gemini: "notInstalled" }),
);

// --- History ---------------------------------------------------------------------------

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const FIXTURE_HISTORY: AgentSessionInfo[] = [
  {
    agentId: "claude",
    sessionId: "h1",
    cwd: FIXTURE_CWD,
    title: "README'yi özetle",
    updatedAt: ago(4),
  },
  {
    agentId: "claude",
    sessionId: "h2",
    cwd: FIXTURE_CWD,
    title: "Dosya ağacında klavye gezintisi",
    updatedAt: ago(95),
  },
  {
    agentId: "codex",
    sessionId: "h3",
    cwd: FIXTURE_CWD,
    title: "Inbox kaydetme hatasını düzelt",
    updatedAt: ago(60 * 26),
  },
  {
    agentId: "gemini",
    sessionId: "h4",
    cwd: FIXTURE_CWD,
    title: null,
    updatedAt: ago(60 * 24 * 6),
  },
  {
    agentId: "codex",
    sessionId: "h5",
    cwd: FIXTURE_CWD,
    title: "Tauri komutlarına test ekle",
    updatedAt: null,
  },
];

// --- Scenarios --------------------------------------------------------------------------

export const FIXTURE_SESSION_ID = "fixture-session";
const S = FIXTURE_SESSION_ID;

const up = (update: AcpSessionUpdate): AgentEvent => ({
  type: "sessionUpdate",
  sessionId: S,
  update,
});

/** Splits text into stream-sized chunks (word boundaries, like the adapters). */
export function chunkText(text: string, size = 12): string[] {
  const out: string[] = [];
  let buf = "";
  for (const part of text.split(/(?<=\s)/)) {
    buf += part;
    if (buf.length >= size) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}

const say = (text: string): AgentEvent[] =>
  chunkText(text).map((t) =>
    up({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: t } }),
  );
const think = (text: string): AgentEvent[] =>
  chunkText(text).map((t) =>
    up({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: t } }),
  );
const end: AgentEvent = { type: "turnEnded", sessionId: S, stopReason: "end_turn" };

const STREAMING_ANSWER = `## Xora Code özeti

**Xora Code**, agent öncelikli, açık kaynak bir masaüstü kod editörü. Tauri 2 ve React 19 üzerine kurulu.

- **Editör:** Monaco tabanlı, sekmeli düzenleme
- **Agent'lar:** Claude, Codex ve Gemini, hepsi ACP üzerinden
- **Inbox:** hızlı notlar, otomatik kaydetme

Agent'lar şu şekilde başlatılıyor:

\`\`\`ts
const setup = await ipc.sessionNew("claude", cwd);
store.attach(setup);
\`\`\`

Kurulum için \`npm ci\` ve ardından \`npm run tauri dev\` yeterli.
`;

const DIFF_OLD = `export function relativeTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return \`\${minutes} dk önce\`;
}
`;
const DIFF_NEW = `export function relativeTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return \`\${minutes} dk önce\`;
  return \`\${Math.round(minutes / 60)} sa önce\`;
}
`;

const editCall = (status: "pending" | "completed") =>
  up({
    sessionUpdate: "tool_call",
    toolCallId: "tc-edit",
    title: "Edit src/features/inbox/relativeTime.ts",
    kind: "edit",
    status,
    content: [
      {
        type: "diff",
        path: P("src\\features\\inbox\\relativeTime.ts"),
        oldText: DIFF_OLD,
        newText: DIFF_NEW,
      },
    ],
    locations: [{ path: P("src\\features\\inbox\\relativeTime.ts"), line: 1 }],
  });

const TEST_OUTPUT = [
  "\n> xora-code@0.1.0 test\n> vitest run\n\n",
  " ✓ src/features/inbox/relativeTime.test.ts (6 tests) 4ms\n",
  " ✓ src/features/inbox/sortNotes.test.ts (4 tests) 3ms\n",
  " ✓ src/features/agents/reducer.test.ts (31 tests) 22ms\n",
  "\n Test Files  3 passed (3)\n      Tests  41 passed (41)\n   Duration  612ms\n",
];

const terminalRun: AgentEvent[] = [
  up({
    sessionUpdate: "tool_call",
    toolCallId: "tc-test",
    title: "npm test",
    kind: "execute",
    status: "in_progress",
    content: [{ type: "terminal", terminalId: "term-1" }],
    rawInput: { command: "npm test" },
  }),
  ...TEST_OUTPUT.map((chunk): AgentEvent => ({
    type: "terminalOutput",
    sessionId: S,
    terminalId: "term-1",
    chunk,
  })),
  { type: "terminalExited", sessionId: S, terminalId: "term-1", exitCode: 0, signal: null },
  up({ sessionUpdate: "tool_call_update", toolCallId: "tc-test", status: "completed" }),
];

export type FixtureScenarioName = "streaming" | "toolDiff" | "permission" | "plan" | "terminal";

export interface FixtureScenario {
  /** What the user typed to start the turn. */
  prompt: string;
  /** The full turn, assuming the permission (if any) is granted. */
  events: AgentEvent[];
  /** Index of the `permissionRequested` event the fake agent waits at. */
  pauseAt?: number;
}

const permissionEvents: AgentEvent[] = [
  ...think("Fonksiyon dakika dışında bir şey göstermiyor. Saat ve 'şimdi' durumu eklenmeli."),
  ...say("`relativeTime` fonksiyonunu saatleri de gösterecek şekilde güncelliyorum."),
  editCall("pending"),
  {
    type: "permissionRequested",
    requestId: "perm-1",
    sessionId: S,
    toolCall: {
      toolCallId: "tc-edit",
      title: "Edit src/features/inbox/relativeTime.ts",
      kind: "edit",
      status: "pending",
      content: [
        {
          type: "diff",
          path: P("src\\features\\inbox\\relativeTime.ts"),
          oldText: DIFF_OLD,
          newText: DIFF_NEW,
        },
      ],
    },
    options: [
      { optionId: "allow", name: "Allow", kind: "allow_once" },
      { optionId: "allow_always", name: "Always Allow", kind: "allow_always" },
      { optionId: "reject", name: "Reject", kind: "reject_once" },
    ],
  },
  { type: "permissionResolved", requestId: "perm-1", optionId: "allow" },
  { type: "fileWritten", sessionId: S, path: P("src\\features\\inbox\\relativeTime.ts") },
  up({ sessionUpdate: "tool_call_update", toolCallId: "tc-edit", status: "completed" }),
  ...say(
    "Tamam. Artık bir dakikadan kısa süreler **şimdi**, bir saatten uzunlar saat olarak görünüyor.",
  ),
  end,
];

export const FIXTURE_SCENARIOS: Record<FixtureScenarioName, FixtureScenario> = {
  streaming: {
    prompt: "README'yi özetle",
    events: [
      up({
        sessionUpdate: "available_commands_update",
        availableCommands: [
          {
            name: "review",
            description: "Değişiklikleri incele",
            input: { hint: "dal ya da dosya" },
          },
          { name: "compact", description: "Bağlamı özetleyerek küçült" },
          { name: "init", description: "CLAUDE.md oluştur" },
          { name: "mcp", description: "MCP sunucularını göster" },
        ],
      }),
      ...think(
        "Kullanıcı README'nin özetini istiyor. Önce dosyayı okuyup ana başlıkları çıkarmalıyım, sonra kısa bir liste halinde sunmalıyım.",
      ),
      up({
        sessionUpdate: "tool_call",
        toolCallId: "tc-read",
        title: "Read README.md",
        kind: "read",
        status: "completed",
        locations: [{ path: P("README.md") }],
      }),
      ...say(STREAMING_ANSWER),
      up({ sessionUpdate: "usage_update", used: 18_420, size: 200_000 }),
      up({ sessionUpdate: "session_info_update", title: "README'yi özetle" }),
      end,
    ],
  },
  toolDiff: {
    prompt: "relativeTime saatleri de göstersin",
    events: [
      ...think("Önce mevcut fonksiyonu ve testlerini okumalıyım."),
      up({
        sessionUpdate: "tool_call",
        toolCallId: "tc-search",
        title: "Search relativeTime",
        kind: "search",
        status: "completed",
        content: [{ type: "content", content: { type: "text", text: "2 dosyada 5 eşleşme" } }],
      }),
      ...say("Fonksiyonu güncelliyorum:"),
      editCall("pending"),
      up({ sessionUpdate: "tool_call_update", toolCallId: "tc-edit", status: "in_progress" }),
      { type: "fileWritten", sessionId: S, path: P("src\\features\\inbox\\relativeTime.ts") },
      up({ sessionUpdate: "tool_call_update", toolCallId: "tc-edit", status: "completed" }),
      ...terminalRun,
      ...say("Değişiklik yapıldı ve testler geçti."),
      up({ sessionUpdate: "usage_update", used: 41_900, size: 200_000 }),
      end,
    ],
  },
  permission: {
    prompt: "relativeTime saatleri de göstersin",
    events: permissionEvents,
    pauseAt: permissionEvents.findIndex((e) => e.type === "permissionRequested"),
  },
  plan: {
    prompt: "Ayarlar ekranına agent bölümü ekle",
    events: [
      up({
        sessionUpdate: "plan",
        entries: [
          { content: "Mevcut ayar şemasını incele", priority: "high", status: "in_progress" },
          { content: "Agent bölümü için alanları ekle", priority: "high", status: "pending" },
          { content: "Varsayılanları ve testleri yaz", priority: "medium", status: "pending" },
        ],
      }),
      ...say("Plan hazır, ayar şemasıyla başlıyorum."),
      up({
        sessionUpdate: "plan",
        entries: [
          { content: "Mevcut ayar şemasını incele", priority: "high", status: "completed" },
          { content: "Agent bölümü için alanları ekle", priority: "high", status: "in_progress" },
          { content: "Varsayılanları ve testleri yaz", priority: "medium", status: "pending" },
        ],
      }),
      end,
    ],
  },
  terminal: {
    prompt: "Testleri çalıştır",
    events: [
      ...say("Testleri çalıştırıyorum."),
      ...terminalRun,
      ...say("41 testin hepsi geçti."),
      end,
    ],
  },
};

export function isFixtureScenario(name: string | null | undefined): name is FixtureScenarioName {
  return !!name && name in FIXTURE_SCENARIOS;
}

const withSession = (ev: AgentEvent, sessionId: string): AgentEvent =>
  "sessionId" in ev ? { ...ev, sessionId } : ev;

/**
 * A ready-made session view for a scenario (no store needed). By default it
 * stops at the scenario's permission prompt when it has one.
 */
export function fixtureSessionView(
  scenario: FixtureScenarioName,
  agentId: AgentId = "claude",
  opts: { upTo?: number; now?: number } = {},
): SessionView {
  const s = FIXTURE_SCENARIOS[scenario];
  const setup = FIXTURE_SETUPS[agentId];
  const now = opts.now ?? Date.now();
  const sessionId = setup.sessionId;
  const upTo = opts.upTo ?? (s.pauseAt !== undefined ? s.pauseAt + 1 : s.events.length);
  const view = createSessionView(setup, FIXTURE_CWD, {
    items: [{ kind: "user", id: "user-0", blocks: [{ type: "text", text: s.prompt }] }],
    turn: "running",
  });
  let data = attachSession(createAgentData(), view, now);
  data = reduceEvents(
    data,
    s.events.slice(0, upTo).map((e) => withSession(e, sessionId)),
    now,
  );
  return data.sessions[sessionId];
}

// --- Fake ipc -----------------------------------------------------------------------------

export interface FixtureIpcOptions {
  /** Scenario played for every prompt (cycles through all when omitted). */
  scenario?: FixtureScenarioName;
  /** Delay between events, ms. */
  stepMs?: number;
  agents?: Record<AgentId, AgentInfo>;
}

/**
 * An in-memory `AgentIpc` that plays fixture scenarios with small delays, so
 * the real store and UI can run in a browser (`?fixture=`). Waits at
 * permission prompts until `permissionRespond` is called.
 */
export function createFixtureIpc(opts: FixtureIpcOptions = {}): AgentIpc {
  const stepMs = opts.stepMs ?? 30;
  const agents = opts.agents ?? fixtureAgents();
  let emit: (e: AgentEvent) => void = () => {};
  let counter = 0;
  let cycle = 0;
  const waiting = new Map<string, (optionId: string | null) => void>();
  const cancelled = new Set<string>();
  // `stepMs: 0` (tests) yields to microtasks only, so timer granularity never matters.
  const sleep = (ms: number) =>
    ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

  async function play(sessionId: string, scenario: FixtureScenario) {
    cancelled.delete(sessionId);
    for (let i = 0; i < scenario.events.length; i++) {
      if (cancelled.has(sessionId)) {
        emit({ type: "turnEnded", sessionId, stopReason: "cancelled" });
        return;
      }
      const ev = withSession(scenario.events[i], sessionId);
      emit(ev);
      if (ev.type === "permissionRequested") {
        const optionId = await new Promise<string | null>((resolve) =>
          waiting.set(ev.requestId, resolve),
        );
        emit({ type: "permissionResolved", requestId: ev.requestId, optionId });
        const next = scenario.events[i + 1];
        if (next?.type === "permissionResolved") i++;
        if (!optionId || optionId.startsWith("reject")) {
          emit({
            type: "sessionUpdate",
            sessionId,
            update: {
              sessionUpdate: "tool_call_update",
              toolCallId: ev.toolCall.toolCallId,
              status: "failed",
            },
          });
          emit({ type: "turnEnded", sessionId, stopReason: optionId ? "end_turn" : "cancelled" });
          return;
        }
      } else {
        await sleep(stepMs);
      }
    }
  }

  const setupFor = (agentId: AgentId, sessionId: string): SessionSetup => ({
    ...structuredClone(FIXTURE_SETUPS[agentId]),
    sessionId,
  });

  return {
    subscribe: async (onEvent) => {
      emit = onEvent;
    },
    list: async () => Object.values(agents),
    install: async (agentId) => {
      emit({ type: "agentStatus", agentId, status: { state: "installing", progress: null } });
      await sleep(600);
      emit({ type: "agentStatus", agentId, status: FIXTURE_STATUSES.ready });
    },
    authenticate: async (agentId) => {
      await sleep(400);
      emit({ type: "agentStatus", agentId, status: FIXTURE_STATUSES.ready });
    },
    authTerminal: async (agentId) => {
      await sleep(400);
      emit({ type: "agentStatus", agentId, status: FIXTURE_STATUSES.ready });
    },
    sessionNew: async (agentId) => setupFor(agentId, `fixture-${agentId}-${++counter}`),
    sessionLoad: async (agentId, sessionId) => {
      const s = FIXTURE_SCENARIOS.streaming;
      emit({
        type: "sessionUpdate",
        sessionId,
        update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: s.prompt } },
      });
      for (const ev of s.events) if (ev.type === "sessionUpdate") emit(withSession(ev, sessionId));
      await sleep(stepMs);
      return setupFor(agentId, sessionId);
    },
    sessionResume: async (agentId, sessionId) => setupFor(agentId, sessionId),
    sessionClose: async () => {},
    sessionsList: async (agentId) => FIXTURE_HISTORY.filter((h) => h.agentId === agentId),
    prompt: async (sessionId) => {
      const names = Object.keys(FIXTURE_SCENARIOS) as FixtureScenarioName[];
      const name = opts.scenario ?? names[cycle++ % names.length];
      void play(sessionId, FIXTURE_SCENARIOS[name]);
    },
    cancel: async (sessionId) => {
      cancelled.add(sessionId);
      for (const [id, resolve] of waiting) {
        waiting.delete(id);
        resolve(null);
      }
    },
    setConfigOption: async (sessionId, configId, value) => {
      const agentId =
        (Object.keys(FIXTURE_SETUPS) as AgentId[]).find((a) => sessionId.includes(a)) ?? "claude";
      const list = structuredClone(FIXTURE_SETUPS[agentId].configOptions ?? []);
      return list.map((o) => (o.id === configId ? ({ ...o, currentValue: value } as typeof o) : o));
    },
    setMode: async () => {},
    setModel: async () => {},
    permissionRespond: async (requestId, optionId) => {
      const resolve = waiting.get(requestId);
      waiting.delete(requestId);
      resolve?.(optionId);
    },
    reviewRevert: async () => "reverted",
    shutdown: async () => {},
  };
}

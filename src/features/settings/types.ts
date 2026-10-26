// Mirrors `settings::Settings` in Rust (camelCase JSON). Keep both in sync.

export type AgentId = "claude" | "codex" | "gemini";
export type AgentMode = "agent" | "plan" | "chat";
export type ApprovalPolicy = "ask" | "autoEdits" | "full";
export type Effort = "low" | "medium" | "high";
export type ReducedMotion = "system" | "always" | "never";
export type RenderWhitespace = "none" | "boundary" | "all";
export type SendKey = "enter" | "ctrlEnter";
export type AutoSave = "off" | "delay" | "focusChange";
export type LineNumbers = "on" | "relative" | "off";
export type CursorStyle = "line" | "block" | "underline";
/** `auto`: PowerShell 7 when installed, else Windows PowerShell. */
export type ShellKind = "auto" | "pwsh" | "powerShell" | "cmd" | "gitBash";

export interface GeneralSettings {
  /** Reopen the last folder on start. */
  openLastFolder: boolean;
  /** Ask before closing a tab with unsaved changes. */
  confirmDirtyClose: boolean;
  reducedMotion: ReducedMotion;
  /** Flash the taskbar when an agent finishes or asks for approval in the background. */
  notifyWhenDone: boolean;
  /** Which key sends from the composer; the other adds a line. */
  sendKey: SendKey;
  /** Conversation text size, px. */
  chatFontSize: number;
}

export interface AgentSettings {
  defaultAgent: AgentId;
  defaultMode: AgentMode;
  approvalPolicy: ApprovalPolicy;
  /** Applied when the agent supports it. */
  defaultEffort: Effort;
  /** Start Claude without ANTHROPIC_API_KEY so it uses the subscription login. */
  claudeIgnoreApiKey: boolean;
  /** Log agent protocol traffic for troubleshooting. */
  debugLogs: boolean;
  /** Models left out of the composer's picker, as "<agent>:<model id>". */
  hiddenModels: string[];
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  ligatures: boolean;
  renderWhitespace: RenderWhitespace;
  formatOnSave: boolean;
  autoSave: AutoSave;
  lineNumbers: LineNumbers;
  cursorStyle: CursorStyle;
  /** Enclosing scopes stay pinned at the top while scrolling. */
  stickyScroll: boolean;
  /** Matching brackets coloured by depth. */
  bracketColors: boolean;
}

export interface TerminalSettings {
  shell: ShellKind;
  fontSize: number;
}

/** How the new-chat background picture is redrawn. */
export type BackgroundEffect = "none" | "dither" | "ascii" | "halftone" | "scanlines";

/** Solid onyx, Windows Acrylic (what is behind, blurred) or plain see-through. */
export type WindowLook = "solid" | "frosted" | "clear";

export interface AppearanceSettings {
  /** Whether a new chat shows a picture at all. */
  picture: boolean;
  /** The user's own copy in app_data_dir/wallpapers/; null is the picture Xora ships with. */
  wallpaper: string | null;
  effect: BackgroundEffect;
  /** Darkening over the picture, 0-100. */
  dim: number;
  window: WindowLook;
  /** How dark the see-through window is tinted, 0-100. */
  tint: number;
  /** Interface zoom, percent. */
  uiScale: number;
}

export interface Settings {
  version: number;
  general: GeneralSettings;
  agent: AgentSettings;
  editor: EditorSettings;
  terminal: TerminalSettings;
  appearance: AppearanceSettings;
}

/** A partial update: any subset of fields in any section. */
export type SettingsPatch = {
  [K in Exclude<keyof Settings, "version">]?: Partial<Settings[K]>;
};

export const SETTINGS_VERSION = 1;

export const FONT_SIZE_RANGE = { min: 10, max: 24 } as const;
export const TAB_SIZE_RANGE = { min: 1, max: 8 } as const;
export const DIM_RANGE = { min: 0, max: 100 } as const;
export const CHAT_FONT_SIZE_RANGE = { min: 12, max: 18 } as const;
export const UI_SCALE_RANGE = { min: 80, max: 150 } as const;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  general: {
    openLastFolder: true,
    confirmDirtyClose: true,
    reducedMotion: "system",
    notifyWhenDone: true,
    sendKey: "enter",
    chatFontSize: 13,
  },
  agent: {
    defaultAgent: "claude",
    defaultMode: "agent",
    approvalPolicy: "ask",
    defaultEffort: "medium",
    claudeIgnoreApiKey: true,
    debugLogs: false,
    hiddenModels: [],
  },
  editor: {
    fontSize: 13,
    tabSize: 2,
    wordWrap: false,
    minimap: false,
    ligatures: true,
    renderWhitespace: "none",
    formatOnSave: false,
    autoSave: "off",
    lineNumbers: "on",
    cursorStyle: "line",
    stickyScroll: true,
    bracketColors: true,
  },
  terminal: { shell: "auto", fontSize: 13 },
  appearance: {
    picture: true,
    wallpaper: null,
    effect: "ascii",
    dim: 15,
    window: "frosted",
    tint: 72,
    uiScale: 100,
  },
};

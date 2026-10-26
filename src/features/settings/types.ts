// Mirrors `settings::Settings` in Rust (camelCase JSON). Keep both in sync.

export type AgentId = "claude" | "codex" | "gemini";
export type AgentMode = "agent" | "plan" | "chat";
export type ApprovalPolicy = "ask" | "autoEdits" | "full";
export type Effort = "low" | "medium" | "high";
export type ReducedMotion = "system" | "always" | "never";
export type RenderWhitespace = "none" | "boundary" | "all";

export interface GeneralSettings {
  /** Reopen the last folder on start. */
  openLastFolder: boolean;
  /** Ask before closing a tab with unsaved changes. */
  confirmDirtyClose: boolean;
  reducedMotion: ReducedMotion;
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
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  ligatures: boolean;
  renderWhitespace: RenderWhitespace;
  formatOnSave: boolean;
}

export interface AppearanceSettings {
  /** Absolute path of the copy in app_data_dir/wallpapers/, or null for plain onyx. */
  wallpaper: string | null;
  /** 0 = solid onyx panels, 100 = the most see-through glass. */
  glass: number;
  /** Blur of the wallpaper behind the glass, in px. */
  blur: number;
  /** Darkening over the wallpaper, 0-100. */
  dim: number;
}

export interface Settings {
  version: number;
  general: GeneralSettings;
  agent: AgentSettings;
  editor: EditorSettings;
  appearance: AppearanceSettings;
}

/** A partial update: any subset of fields in any section. */
export type SettingsPatch = {
  [K in Exclude<keyof Settings, "version">]?: Partial<Settings[K]>;
};

export const SETTINGS_VERSION = 1;

export const FONT_SIZE_RANGE = { min: 10, max: 24 } as const;
export const TAB_SIZE_RANGE = { min: 1, max: 8 } as const;
export const GLASS_RANGE = { min: 0, max: 100 } as const;
export const BLUR_RANGE = { min: 0, max: 64 } as const;
export const DIM_RANGE = { min: 0, max: 100 } as const;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  general: { openLastFolder: true, confirmDirtyClose: true, reducedMotion: "system" },
  agent: {
    defaultAgent: "claude",
    defaultMode: "agent",
    approvalPolicy: "ask",
    defaultEffort: "medium",
    claudeIgnoreApiKey: true,
    debugLogs: false,
  },
  editor: {
    fontSize: 13,
    tabSize: 2,
    wordWrap: false,
    minimap: false,
    ligatures: true,
    renderWhitespace: "none",
    formatOnSave: false,
  },
  appearance: { wallpaper: null, glass: 75, blur: 24, dim: 35 },
};

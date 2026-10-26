import { invoke } from "@tauri-apps/api/core";
import type { AgentId, Settings, SettingsPatch } from "./types";

export type SignIn = "signedIn" | "signedOut" | "unknown";

/** Mirrors `accounts::ProviderStatus` in Rust. */
export interface ProviderStatus {
  provider: AgentId;
  /** Resolved executable, or `null` when the CLI is not installed. */
  path: string | null;
  version: string | null;
  signIn: SignIn;
}

/** Typed wrappers around the settings and accounts commands (`src-tauri/src/{settings,accounts}`). */
export const settingsIpc = {
  get: () => invoke<Settings>("settings_get"),
  /** Deep-merges the patch on disk and returns the sanitized settings. */
  update: (patch: SettingsPatch) => invoke<Settings>("settings_update", { patch }),
  detectAccounts: () => invoke<ProviderStatus[]>("accounts_detect"),
  /** Opens the CLI's sign-in flow in a new terminal window. */
  login: (provider: AgentId) => invoke<void>("accounts_login", { provider }),
  /** Copies the picture into app_data_dir/wallpapers/ and returns the copy's path. */
  importWallpaper: (source: string) => invoke<string>("settings_wallpaper_import", { source }),
  /** Deletes the stored wallpaper files. */
  removeWallpaper: () => invoke<void>("settings_wallpaper_remove"),
};

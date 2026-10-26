/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // Slim Monaco: the bare "monaco-editor" import resolves to a generated entry without
      // the TypeScript language service (see scripts/gen-monaco-slim.mjs). Types still come
      // from the package; worker subpaths ("monaco-editor/...") are untouched.
      {
        find: /^monaco-editor$/,
        replacement: fileURLToPath(
          new URL("./src/features/editor/monaco/slim.js", import.meta.url),
        ),
      },
      {
        find: /^monaco-esm\//,
        replacement: fileURLToPath(
          new URL("./node_modules/monaco-editor/esm/vs/", import.meta.url),
        ),
      },
    ],
  },

  test: { environment: "node", include: ["src/**/*.test.ts"] },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri` (and agent worktrees/notes, which would
      //    otherwise trigger spurious reloads)
      ignored: ["**/src-tauri/**", "**/.claude/**", "**/.superpowers/**"],
    },
  },
}));

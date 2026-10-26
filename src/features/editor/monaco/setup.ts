import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
// Worker specifiers go through monaco-editor's exports map ("./*" -> "./esm/vs/*.js").
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/language/json/json.worker?worker";
import cssWorker from "monaco-editor/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/language/html/html.worker?worker";
import { defineXoraTheme } from "./theme";

// Load Monaco from the bundle (no CDN) so the editor works offline.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    return new editorWorker();
  },
};

// No TypeScript language service: "monaco-editor" resolves to a slim entry without it
// (vite.config.ts, scripts/gen-monaco-slim.mjs). Files open without their project, so its
// IntelliSense was shallow, while its worker is ~7 MB of code and hundreds of MB running.
// Highlighting is Monarch-based and stays; the agent is the one that knows the project.

// Xora has one command palette. Drop Monaco's own (F1, and Ctrl+Shift+P where bound); the
// app's capture-phase Ctrl+K / Ctrl+Shift+P listener never lets those reach the editor anyway.
// Monaco's Ctrl+K chords (Ctrl+K Ctrl+C comment, Ctrl+K Ctrl+X trim, ...) are intentionally
// given up so Ctrl+K always opens Xora's palette.
monaco.editor.addKeybindingRules(
  [monaco.KeyCode.F1, monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP].map(
    (keybinding) => ({ keybinding, command: "-editor.action.quickCommand" }),
  ),
);

defineXoraTheme(monaco);
loader.config({ monaco });

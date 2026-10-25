import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
// Worker specifiers go through monaco-editor's exports map ("./*" -> "./esm/vs/*.js").
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/language/json/json.worker?worker";
import cssWorker from "monaco-editor/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/language/html/html.worker?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker?worker";
import { defineXoraTheme } from "./theme";

// Load Monaco from the bundle (no CDN) so the editor works offline.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

// Files open without their project (no tsconfig, no node_modules), so semantic errors would be
// noise everywhere; keep syntax checks only.
for (const defaults of [
  monaco.typescript.typescriptDefaults,
  monaco.typescript.javascriptDefaults,
]) {
  defaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  defaults.setCompilerOptions({
    ...defaults.getCompilerOptions(),
    jsx: monaco.typescript.JsxEmit.ReactJSX,
    target: monaco.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
  });
}

defineXoraTheme(monaco);
loader.config({ monaco });

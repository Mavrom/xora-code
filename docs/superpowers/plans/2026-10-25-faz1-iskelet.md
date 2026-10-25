# Xora Code Faz 1 (İskelet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri 2 tabanlı Xora Code uygulamasının iskeletini kurmak: klasör açma, dosya ağacı, Monaco editörde dosya açma/düzenleme/kaydetme ve ortada (Faz 2'de doldurulacak) agent sohbet alanı.

**Architecture:** Rust backend dosya sistemi işlerini `fs` modülünde saf fonksiyonlar olarak tutar, `commands.rs` bunları async Tauri command'ları olarak dışarı açar. React tarafı `lib/ipc.ts` üzerinden typed `invoke` çağrıları yapar. State Zustand store'larında durur (`workspaceStore`, `editorStore`). Layout üç sütunludur: sol dosya ağacı, ortada sohbet (ana alan), sağda açılıp kapanabilen editör paneli.

**Tech Stack:** Tauri 2, Rust (stable 1.95), React 19 + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Zustand, `@monaco-editor/react` + `monaco-editor` (lokal, CDN yok), `@tauri-apps/plugin-dialog`, Vitest, `tempfile` (Rust test).

## Global Constraints
- Uygulama adı: **Xora Code**, identifier `com.xora.code`.
- Hedef platform: önce Windows. Kod çapraz platform kalmalı (path'ler için `std::path`, ayırıcı hardcode edilmemeli).
- Monaco **lokalden** yüklenmeli (`loader.config({ monaco })`), CDN kullanılmamalı. Uygulama offline çalışmalı.
- UI metinleri Türkçe, kod/isimler İngilizce.
- Tema: koyu.
- Commit yazar e-postası `95590733+Mavrom@users.noreply.github.com` olmalı (repo config'te ayarlı). Her commit öncesi `git config user.email` ile kontrol edilmeli.
- Commit mesajları şu satırla bitmeli: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Dosya watcher bu fazda **yok**. Agent dosya değiştirdiğinde gerekeceği için Faz 2'ye bırakıldı.

## Dosya yapısı (bu fazın sonunda)
```
src-tauri/
  Cargo.toml                 (+ tempfile dev-dep, dialog plugin)
  tauri.conf.json            (pencere başlığı/boyutu)
  src/lib.rs                 (mod fs; mod commands; invoke_handler)
  src/fs/mod.rs              DirEntry, list_dir, read_file, write_file + testler
  src/commands.rs            fs_list_dir, fs_read_file, fs_write_file
src/
  main.tsx                   (index.css + monacoSetup import)
  index.css                  tailwind + temel stiller
  App.tsx                    Layout render
  lib/ipc.ts                 typed invoke wrapper'ları
  stores/workspaceStore.ts   root klasör
  stores/editorStore.ts      sekmeler, aktif sekme, dirty durumu
  stores/editorStore.test.ts
  app/Layout.tsx             üç sütun + üst bar
  app/TopBar.tsx             "Klasör aç", editör panelini aç/kapa
  features/files/FileTree.tsx
  features/editor/monacoSetup.ts
  features/editor/EditorPanel.tsx
  features/chat/ChatPanel.tsx   (Faz 2 placeholder)
```

---

### Task 1: Tauri 2 + React-TS iskeleti, Tailwind, dialog plugin

**Files:**
- Create: proje iskeleti (`create-tauri-app`)
- Modify: `vite.config.ts`, `src/index.css` (yeni), `src/main.tsx`, `src/App.tsx`, `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `package.json`
- Delete: `src/App.css`, `src/assets/react.svg`, `public/` içindeki örnek svg'ler (varsa)

**Interfaces:**
- Produces: `npm run tauri dev` ile açılan boş "Xora Code" penceresi, `npm test` script'i (Vitest), dialog plugin hazır.

- [ ] **Step 1: İskeleti geçici klasörde oluştur ve repoya taşı**

Repo kökünde zaten `.git` ve `docs/` olduğu için iskelet geçici bir klasörde üretilip taşınır (Git Bash):
```bash
cd "/c/Users/Berk/Desktop/Xora Code"
npx --yes create-tauri-app@latest xora-tmp --template react-ts --manager npm --identifier com.xora.code --yes
shopt -s dotglob
mv xora-tmp/* .
rmdir xora-tmp
```
Expected: kökte `package.json`, `src/`, `src-tauri/`, `index.html`, `vite.config.ts` bulunur. Flag'lerden biri reddedilirse `npx create-tauri-app@latest --help` ile doğru adı kontrol et. Hedef aynı: React + TypeScript + npm.

- [ ] **Step 2: Bağımlılıkları kur**

```bash
npm install
npm install zustand @monaco-editor/react monaco-editor
npm install -D tailwindcss @tailwindcss/vite vitest
npm run tauri add dialog
```
Expected: `tauri add dialog` hem `@tauri-apps/plugin-dialog`'u hem `tauri-plugin-dialog` crate'ini ekler, `lib.rs`'e `.plugin(tauri_plugin_dialog::init())` yazar ve `src-tauri/capabilities/default.json`'a `dialog:default` ekler. Ekleyip eklemediğini kontrol et.

- [ ] **Step 3: Vite config'e Tailwind ekle**

`vite.config.ts` dosyasında mevcut config korunur, sadece import ve plugin eklenir:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```
(İskeletteki server bloğu farklıysa iskeletinkini koru, sadece `tailwindcss()` plugin'ini ekle.)

- [ ] **Step 4: `src/index.css` oluştur**

```css
@import "tailwindcss";

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  background: #0f1115;
  color: #d7dae0;
  font-family: "Segoe UI", system-ui, sans-serif;
  font-size: 13px;
  overflow: hidden;
}
```

- [ ] **Step 5: Boilerplate'i temizle**

`src/App.css` ve `src/assets/react.svg` dosyalarını sil. `src/App.tsx`:
```tsx
export default function App() {
  return <div className="h-full flex items-center justify-center">Xora Code</div>;
}
```
`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```
`src-tauri/src/lib.rs` dosyasından örnek `greet` command'ını ve `invoke_handler` içindeki referansını kaldır. Dialog plugin satırı kalır:
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
(İskelette `tauri_plugin_opener` yoksa o satırı ekleme.)

- [ ] **Step 6: Pencere ayarları ve test script'i**

`src-tauri/tauri.conf.json` içinde `productName` değerini `"Xora Code"` yap. `app.windows[0]` için `"title": "Xora Code"`, `"width": 1400`, `"height": 900`, `"minWidth": 900`, `"minHeight": 600` ayarla.
`package.json` `scripts` içine ekle: `"test": "vitest run"`.

- [ ] **Step 7: Çalıştırıp doğrula**

Run: `npm run build` → Expected: TypeScript ve Vite hatasız biter.
Run (arka planda): `npm run tauri dev` → Expected: "Xora Code" başlıklı koyu pencere açılır, ortada "Xora Code" yazar. İlk Rust derlemesi birkaç dakika sürebilir. Kontrol bitince süreci durdur.

- [ ] **Step 8: Commit**

```bash
git config user.email   # 95590733+Mavrom@users.noreply.github.com olmalı
git add -A
git commit -m "chore: scaffold Tauri 2 + React app with Tailwind and dialog plugin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Rust `fs` modülü ve Tauri command'ları

**Files:**
- Create: `src-tauri/src/fs/mod.rs`, `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`

**Interfaces:**
- Produces (Rust): `fs::DirEntry { name: String, path: String, is_dir: bool }` (JSON'da `isDir`), `fs::list_dir(&Path) -> io::Result<Vec<DirEntry>>` (klasörler önce, isimler büyük/küçük harf duyarsız sıralı, `.git` gizli), `fs::read_file(&Path) -> io::Result<String>`, `fs::write_file(&Path, &str) -> io::Result<()>`.
- Produces (IPC): command'lar `fs_list_dir { path }`, `fs_read_file { path }`, `fs_write_file { path, contents }`. Hepsi hata durumunda `String` döner.

- [ ] **Step 1: Test bağımlılığını ekle**

`src-tauri/Cargo.toml` içine:
```toml
[dev-dependencies]
tempfile = "3"
```
`serde` (derive feature ile) iskelette zaten var. Yoksa `serde = { version = "1", features = ["derive"] }` ekle.

- [ ] **Step 2: Başarısız testleri yaz**

`src-tauri/src/fs/mod.rs`:
```rust
use serde::Serialize;
use std::io;
use std::path::Path;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

pub fn list_dir(_path: &Path) -> io::Result<Vec<DirEntry>> {
    unimplemented!()
}

pub fn read_file(_path: &Path) -> io::Result<String> {
    unimplemented!()
}

pub fn write_file(_path: &Path, _contents: &str) -> io::Result<()> {
    unimplemented!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as stdfs;

    #[test]
    fn list_dir_puts_dirs_first_sorted_case_insensitive_and_hides_git() {
        let dir = tempfile::tempdir().unwrap();
        stdfs::create_dir(dir.path().join("src")).unwrap();
        stdfs::create_dir(dir.path().join(".git")).unwrap();
        stdfs::write(dir.path().join("b.txt"), "").unwrap();
        stdfs::write(dir.path().join("A.md"), "").unwrap();

        let entries = list_dir(dir.path()).unwrap();
        let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();

        assert_eq!(names, vec!["src", "A.md", "b.txt"]);
        assert!(entries[0].is_dir);
        assert!(!entries[1].is_dir);
        assert_eq!(entries[0].path, dir.path().join("src").to_string_lossy());
    }

    #[test]
    fn write_then_read_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("hello.ts");

        write_file(&file, "export const x = 1;\n").unwrap();

        assert_eq!(read_file(&file).unwrap(), "export const x = 1;\n");
    }

    #[test]
    fn read_missing_file_errors() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read_file(&dir.path().join("nope.txt")).is_err());
    }

    #[test]
    fn serializes_is_dir_as_camel_case() {
        let e = DirEntry { name: "a".into(), path: "p".into(), is_dir: true };
        let json = serde_json::to_string(&e).unwrap();
        assert_eq!(json, r#"{"name":"a","path":"p","isDir":true}"#);
    }
}
```
`src-tauri/src/lib.rs` başına `mod fs;` ekle. (`serde_json` iskelette dependency olarak var. Yoksa ekle.)

- [ ] **Step 3: Testlerin başarısız olduğunu gör**

Run: `cargo test --manifest-path src-tauri/Cargo.toml fs::`
Expected: 3 test `not implemented` panic'iyle FAIL olur, `serializes_is_dir_as_camel_case` PASS olur.

- [ ] **Step 4: Implementasyonu yaz**

`src-tauri/src/fs/mod.rs` içindeki üç fonksiyonu değiştir:
```rust
const HIDDEN: &[&str] = &[".git"];

pub fn list_dir(path: &Path) -> io::Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if HIDDEN.contains(&name.as_str()) {
            continue;
        }
        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().into_owned(),
            is_dir: entry.file_type()?.is_dir(),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

pub fn read_file(path: &Path) -> io::Result<String> {
    std::fs::read_to_string(path)
}

pub fn write_file(path: &Path, contents: &str) -> io::Result<()> {
    std::fs::write(path, contents)
}
```

- [ ] **Step 5: Testlerin geçtiğini gör**

Run: `cargo test --manifest-path src-tauri/Cargo.toml fs::`
Expected: 4 passed.

- [ ] **Step 6: Command'ları ekle ve kaydet**

`src-tauri/src/commands.rs`:
```rust
use crate::fs::{self, DirEntry};
use std::path::PathBuf;

// Async so file IO never blocks the main (UI) thread.
#[tauri::command]
pub async fn fs_list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    fs::list_dir(&PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    fs::read_file(&PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_write_file(path: String, contents: String) -> Result<(), String> {
    fs::write_file(&PathBuf::from(path), &contents).map_err(|e| e.to_string())
}
```
`src-tauri/src/lib.rs`:
```rust
mod commands;
mod fs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::fs_list_dir,
            commands::fs_read_file,
            commands::fs_write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```
(İskeletteki `cfg_attr` satırı ve opener plugin nasıl yazılmışsa öyle koru.)

- [ ] **Step 7: Derle ve test et**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: tüm testler geçer, uyarısız derlenir (kullanılmayan import uyarısı olmamalı).

- [ ] **Step 8: Commit**

```bash
git add src-tauri
git commit -m "feat(fs): add list/read/write file commands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: IPC wrapper'ları ve Zustand store'ları

**Files:**
- Create: `src/lib/ipc.ts`, `src/stores/workspaceStore.ts`, `src/stores/editorStore.ts`, `src/stores/editorStore.test.ts`

**Interfaces:**
- Consumes: Task 2 command'ları.
- Produces:
  - `ipc.listDir(path: string): Promise<DirEntry[]>`, `ipc.readFile(path: string): Promise<string>`, `ipc.writeFile(path: string, contents: string): Promise<void>`, `interface DirEntry { name: string; path: string; isDir: boolean }`
  - `useWorkspaceStore`: `{ root: string | null; setRoot(root: string): void }`
  - `useEditorStore`: `{ tabs: Tab[]; activePath: string | null; openFile(path, content): void; updateContent(path, content): void; markSaved(path, content): void; closeTab(path): void; setActive(path): void }`, `interface Tab { path: string; name: string; content: string; savedContent: string }`, `isDirty(tab: Tab): boolean`, `basename(path: string): string`

- [ ] **Step 1: `src/lib/ipc.ts` yaz**

```ts
import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export const ipc = {
  listDir: (path: string) => invoke<DirEntry[]>("fs_list_dir", { path }),
  readFile: (path: string) => invoke<string>("fs_read_file", { path }),
  writeFile: (path: string, contents: string) =>
    invoke<void>("fs_write_file", { path, contents }),
};
```

- [ ] **Step 2: `src/stores/workspaceStore.ts` yaz**

```ts
import { create } from "zustand";

interface WorkspaceState {
  root: string | null;
  setRoot: (root: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  root: null,
  setRoot: (root) => set({ root }),
}));
```

- [ ] **Step 3: editorStore için başarısız testleri yaz**

`src/stores/editorStore.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { basename, isDirty, useEditorStore } from "./editorStore";

const s = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activePath: null });
});

describe("basename", () => {
  it("handles windows and posix separators", () => {
    expect(basename("C:\\proj\\src\\a.ts")).toBe("a.ts");
    expect(basename("/proj/src/b.ts")).toBe("b.ts");
  });
});

describe("editorStore", () => {
  it("opens a file as a new active tab", () => {
    s().openFile("C:\\p\\a.ts", "x");
    expect(s().tabs).toHaveLength(1);
    expect(s().tabs[0]).toEqual({ path: "C:\\p\\a.ts", name: "a.ts", content: "x", savedContent: "x" });
    expect(s().activePath).toBe("C:\\p\\a.ts");
  });

  it("re-opening an existing file only activates it and keeps edits", () => {
    s().openFile("/a.ts", "x");
    s().updateContent("/a.ts", "edited");
    s().openFile("/b.ts", "y");
    s().openFile("/a.ts", "from disk");
    expect(s().tabs).toHaveLength(2);
    expect(s().tabs[0].content).toBe("edited");
    expect(s().activePath).toBe("/a.ts");
  });

  it("tracks dirty state and clears it on save", () => {
    s().openFile("/a.ts", "x");
    s().updateContent("/a.ts", "xy");
    expect(isDirty(s().tabs[0])).toBe(true);
    s().markSaved("/a.ts", "xy");
    expect(isDirty(s().tabs[0])).toBe(false);
  });

  it("closing the active tab activates the previous neighbour", () => {
    s().openFile("/a.ts", "");
    s().openFile("/b.ts", "");
    s().openFile("/c.ts", "");
    s().closeTab("/c.ts");
    expect(s().activePath).toBe("/b.ts");
    s().setActive("/a.ts");
    s().closeTab("/a.ts");
    expect(s().activePath).toBe("/b.ts");
    s().closeTab("/b.ts");
    expect(s().activePath).toBeNull();
  });

  it("closing an inactive tab keeps the active one", () => {
    s().openFile("/a.ts", "");
    s().openFile("/b.ts", "");
    s().closeTab("/a.ts");
    expect(s().activePath).toBe("/b.ts");
  });
});
```

- [ ] **Step 4: Testin başarısız olduğunu gör**

Run: `npm test`
Expected: FAIL, `./editorStore` modülü bulunamıyor.

- [ ] **Step 5: `src/stores/editorStore.ts` yaz**

```ts
import { create } from "zustand";

export interface Tab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
}

interface EditorState {
  tabs: Tab[];
  activePath: string | null;
  openFile: (path: string, content: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string, content: string) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
}

export const basename = (path: string) => path.split(/[\\/]/).pop() ?? path;

export const isDirty = (tab: Tab) => tab.content !== tab.savedContent;

const patchTab = (tabs: Tab[], path: string, patch: Partial<Tab>) =>
  tabs.map((t) => (t.path === path ? { ...t, ...patch } : t));

export const useEditorStore = create<EditorState>((set) => ({
  tabs: [],
  activePath: null,

  openFile: (path, content) =>
    set((state) => {
      if (state.tabs.some((t) => t.path === path)) return { activePath: path };
      const tab: Tab = { path, name: basename(path), content, savedContent: content };
      return { tabs: [...state.tabs, tab], activePath: path };
    }),

  updateContent: (path, content) =>
    set((state) => ({ tabs: patchTab(state.tabs, path, { content }) })),

  markSaved: (path, content) =>
    set((state) => ({ tabs: patchTab(state.tabs, path, { savedContent: content }) })),

  closeTab: (path) =>
    set((state) => {
      const index = state.tabs.findIndex((t) => t.path === path);
      if (index === -1) return {};
      const tabs = state.tabs.filter((t) => t.path !== path);
      if (state.activePath !== path) return { tabs };
      const neighbour = tabs[index - 1] ?? tabs[index] ?? null;
      return { tabs, activePath: neighbour?.path ?? null };
    }),

  setActive: (path) => set({ activePath: path }),
}));
```

- [ ] **Step 6: Testlerin geçtiğini gör**

Run: `npm test`
Expected: 6 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lib src/stores
git commit -m "feat: add typed IPC wrappers and workspace/editor stores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Layout, üst bar, dosya ağacı ve sohbet placeholder'ı

**Files:**
- Create: `src/app/Layout.tsx`, `src/app/TopBar.tsx`, `src/features/files/FileTree.tsx`, `src/features/chat/ChatPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ipc`, `useWorkspaceStore`, `useEditorStore.openFile`, `open` from `@tauri-apps/plugin-dialog`.
- Produces: `<Layout />`. Editör paneli görünürlüğü Layout'taki `editorOpen` state'inde tutulur ve TopBar'a `editorOpen` / `onToggleEditor` prop'larıyla geçer. Task 5, `<EditorPanel />`'i bu panelin içine yerleştirir.

- [ ] **Step 1: `src/features/files/FileTree.tsx`**

```tsx
import { useEffect, useState } from "react";
import { ipc, type DirEntry } from "../../lib/ipc";
import { useEditorStore } from "../../stores/editorStore";

function useChildren(path: string, enabled: boolean) {
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || children) return;
    ipc.listDir(path).then(setChildren).catch((e) => setError(String(e)));
  }, [path, enabled, children]);

  return { children, error };
}

function TreeNode({ entry, depth }: { entry: DirEntry; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const { children, error } = useChildren(entry.path, entry.isDir && expanded);
  const activePath = useEditorStore((s) => s.activePath);
  const openFile = useEditorStore((s) => s.openFile);

  const onClick = async () => {
    if (entry.isDir) {
      setExpanded((v) => !v);
      return;
    }
    try {
      openFile(entry.path, await ipc.readFile(entry.path));
    } catch (e) {
      alert(`Dosya açılamadı: ${e}`);
    }
  };

  const isActive = activePath === entry.path;

  return (
    <div>
      <button
        onClick={onClick}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={`w-full text-left py-0.5 pr-2 truncate hover:bg-white/5 ${
          isActive ? "bg-white/10 text-white" : ""
        }`}
        title={entry.path}
      >
        <span className="inline-block w-4 text-neutral-500">
          {entry.isDir ? (expanded ? "▾" : "▸") : ""}
        </span>
        {entry.name}
      </button>
      {expanded && error && (
        <div style={{ paddingLeft: 24 + depth * 12 }} className="text-red-400 text-xs">
          {error}
        </div>
      )}
      {expanded &&
        children?.map((c) => <TreeNode key={c.path} entry={c} depth={depth + 1} />)}
    </div>
  );
}

export function FileTree({ root }: { root: string }) {
  const { children, error } = useChildren(root, true);

  if (error) return <div className="p-3 text-red-400">{error}</div>;
  if (!children) return <div className="p-3 text-neutral-500">Yükleniyor…</div>;

  return (
    <div className="py-1 select-none">
      {children.map((c) => (
        <TreeNode key={c.path} entry={c} depth={0} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `src/features/chat/ChatPanel.tsx` (Faz 2 placeholder)**

```tsx
export function ChatPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-neutral-500">
        <div className="text-xl text-neutral-300">Xora Code</div>
        <div>Agent bağlantısı (Claude / Codex / Gemini) bir sonraki fazda gelecek.</div>
      </div>
      <div className="p-3 border-t border-white/10">
        <textarea
          disabled
          rows={3}
          placeholder="Agent'a bir şey sor… (yakında)"
          className="w-full resize-none rounded-lg bg-white/5 border border-white/10 p-3 outline-none disabled:opacity-50"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/TopBar.tsx`**

```tsx
import { open } from "@tauri-apps/plugin-dialog";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { basename } from "../stores/editorStore";

interface Props {
  editorOpen: boolean;
  onToggleEditor: () => void;
}

export function TopBar({ editorOpen, onToggleEditor }: Props) {
  const root = useWorkspaceStore((s) => s.root);
  const setRoot = useWorkspaceStore((s) => s.setRoot);

  const openFolder = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir === "string") setRoot(dir);
  };

  return (
    <div className="h-10 flex items-center gap-2 px-3 border-b border-white/10 bg-[#0b0d10]">
      <span className="font-semibold text-white">Xora Code</span>
      {root && <span className="text-neutral-500 truncate">— {basename(root)}</span>}
      <div className="flex-1" />
      <button onClick={openFolder} className="px-2 py-1 rounded hover:bg-white/10">
        Klasör aç
      </button>
      <button onClick={onToggleEditor} className="px-2 py-1 rounded hover:bg-white/10">
        {editorOpen ? "Editörü gizle" : "Editörü göster"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/Layout.tsx`**

```tsx
import { useState } from "react";
import { TopBar } from "./TopBar";
import { FileTree } from "../features/files/FileTree";
import { ChatPanel } from "../features/chat/ChatPanel";
import { useWorkspaceStore } from "../stores/workspaceStore";

export function Layout() {
  const root = useWorkspaceStore((s) => s.root);
  const [editorOpen, setEditorOpen] = useState(true);

  return (
    <div className="h-full flex flex-col">
      <TopBar editorOpen={editorOpen} onToggleEditor={() => setEditorOpen((v) => !v)} />
      <div className="flex-1 flex min-h-0">
        <aside className="w-64 shrink-0 border-r border-white/10 overflow-auto">
          {root ? (
            <FileTree key={root} root={root} />
          ) : (
            <div className="p-3 text-neutral-500">Başlamak için bir klasör aç.</div>
          )}
        </aside>
        <main className="flex-1 min-w-0">
          <ChatPanel />
        </main>
        {editorOpen && (
          <section className="w-[45%] shrink-0 border-l border-white/10 min-w-0">
            <div className="h-full flex items-center justify-center text-neutral-500">
              Editör
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `src/App.tsx`**

```tsx
import { Layout } from "./app/Layout";

export default function App() {
  return <Layout />;
}
```

- [ ] **Step 6: Doğrula**

Run: `npm run build` → Expected: hatasız.
Run (arka planda): `npm run tauri dev`. "Klasör aç" ile bu repo seçilir. Expected: ağaçta `docs`, `src`, `src-tauri` önce, sonra dosyalar görünür. `.git` görünmez. Klasörler açılıp kapanır. Dosyaya tıklamak hata vermez (editör henüz placeholder). Ekran görüntüsüyle kontrol et.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add three-column layout, file tree and chat placeholder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Monaco editör paneli (sekmeler, düzenleme, Ctrl+S ile kaydetme)

**Files:**
- Create: `src/features/editor/monacoSetup.ts`, `src/features/editor/EditorPanel.tsx`
- Modify: `src/main.tsx`, `src/app/Layout.tsx`

**Interfaces:**
- Consumes: `useEditorStore` (tüm action'lar, `isDirty`), `ipc.writeFile`.
- Produces: `<EditorPanel />`. Faz 2'deki diff review aynı panele eklenecek.

- [ ] **Step 1: `src/features/editor/monacoSetup.ts` (Monaco lokal, CDN yok)**

```ts
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new cssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new htmlWorker();
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });
```
`src/main.tsx` içinde `import "./index.css";` satırının altına ekle:
```ts
import "./features/editor/monacoSetup";
```
`?worker` import'ları için tip hatası alınırsa `src/vite-env.d.ts` dosyasında `/// <reference types="vite/client" />` olduğundan emin ol (iskelette var).

- [ ] **Step 2: `src/features/editor/EditorPanel.tsx`**

```tsx
import Editor, { type OnMount } from "@monaco-editor/react";
import { ipc } from "../../lib/ipc";
import { isDirty, useEditorStore } from "../../stores/editorStore";

async function saveActive() {
  const { tabs, activePath, markSaved } = useEditorStore.getState();
  const tab = tabs.find((t) => t.path === activePath);
  if (!tab || !isDirty(tab)) return;
  try {
    await ipc.writeFile(tab.path, tab.content);
    markSaved(tab.path, tab.content);
  } catch (e) {
    alert(`Kaydedilemedi: ${e}`);
  }
}

export function EditorPanel() {
  const tabs = useEditorStore((s) => s.tabs);
  const activePath = useEditorStore((s) => s.activePath);
  const setActive = useEditorStore((s) => s.setActive);
  const closeTab = useEditorStore((s) => s.closeTab);
  const updateContent = useEditorStore((s) => s.updateContent);

  const active = tabs.find((t) => t.path === activePath) ?? null;

  const onMount: OnMount = (editor, monaco) => {
    // Reads store state at call time, so the binding never goes stale.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => void saveActive());
  };

  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500">
        Ağaçtan bir dosya seç.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex overflow-x-auto border-b border-white/10 bg-[#0b0d10]">
        {tabs.map((t) => (
          <div
            key={t.path}
            onClick={() => setActive(t.path)}
            title={t.path}
            className={`group flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-white/10 whitespace-nowrap ${
              t.path === activePath ? "bg-[#1e1e1e] text-white" : "text-neutral-400 hover:bg-white/5"
            }`}
          >
            <span>{t.name}</span>
            {isDirty(t) && <span className="text-amber-400">●</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isDirty(t) && !confirm(`${t.name} kaydedilmedi. Yine de kapatılsın mı?`)) return;
                closeTab(t.path);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {active && (
          <Editor
            theme="vs-dark"
            path={active.path}
            value={active.content}
            onChange={(v) => updateContent(active.path, v ?? "")}
            onMount={onMount}
            options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
          />
        )}
      </div>
    </div>
  );
}
```
(`path` prop'u sayesinde her dosya için ayrı bir Monaco modeli oluşur ve dil uzantıdan otomatik seçilir.)

- [ ] **Step 3: Layout'a bağla**

`src/app/Layout.tsx` içinde import ekle:
```tsx
import { EditorPanel } from "../features/editor/EditorPanel";
```
Editör section'ının içindeki placeholder'ı değiştir:
```tsx
        {editorOpen && (
          <section className="w-[45%] shrink-0 border-l border-white/10 min-w-0">
            <EditorPanel />
          </section>
        )}
```

- [ ] **Step 4: Doğrula**

Run: `npm test` → Expected: 6 passed (regresyon yok).
Run: `npm run build` → Expected: hatasız (Monaco chunk'ı için boyut uyarısı normal).
Run (arka planda): `npm run tauri dev`. Repo klasörünü aç ve `docs/superpowers/specs/2026-10-25-xora-code-design.md` dosyasına tıkla.
Expected:
- Dosya markdown renklendirmesiyle açılır ve sekme görünür.
- İkinci bir dosya (`src/App.tsx`) açılınca TSX renklendirmesi gelir. Sekmeler arasında geçiş içeriği korur.
- Bir dosyada değişiklik yapınca sekmede ● görünür. Ctrl+S'ye basınca ● kaybolur ve değişiklik diske yazılır (`git diff` ile kontrol et, sonra `git checkout -- <dosya>` ile geri al).
- Ağ bağlantısı kesikken de editör yüklenir (CDN yok).
- "Editörü gizle" ile panel kapanır, sohbet alanı genişler.
Ekran görüntüsü al.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(editor): add Monaco editor panel with tabs and Ctrl+S save

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Faz 1 bitiş kriteri
- `cargo test --manifest-path src-tauri/Cargo.toml` ve `npm test` yeşil.
- `npm run tauri dev`: klasör açma, ağaç, Monaco'da aç/düzenle/kaydet ve editör panelini aç/kapa çalışıyor.
- Sıradaki adım: Faz 2 (ACP + Claude). Agent sohbeti, izin onayı, diff review ve dosya watcher için ayrı bir plan yazılacak.

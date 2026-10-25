# Xora Code Faz 1 (İskelet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri 2 tabanlı Xora Code uygulamasının iskeletini kurmak: klasör açma, dosya ağacı, Monaco editörde dosya açma/düzenleme/kaydetme ve ortada (Faz 2'de doldurulacak) agent sohbet alanı.

**Architecture:** Rust backend domain modüllerinden oluşur (`fs`, ileride `agents` ve `terminal`). Her modül saf fonksiyonlarını ve kendi `commands.rs` dosyasını taşır, hatalar merkezi `AppError` tipinden geçer. React tarafı feature bazlıdır: `src/features/<ad>/` bileşenleri ve store'u bir arada tutar, ortak kod `src/shared/` altındadır. `src/shared/lib/ipc.ts` typed `invoke` katmanıdır. Layout yeniden boyutlanabilir üç panelden oluşur: dosya ağacı, sohbet (ana alan) ve açılıp kapanabilen editör.

**Tech Stack:** Tauri 2, Rust (stable 1.95), React 19 + TypeScript + Vite, Tailwind CSS v4 (`@tailwindcss/vite`), Zustand, `@monaco-editor/react` + `monaco-editor` (lokal, CDN yok), `@tauri-apps/plugin-dialog`, `react-resizable-panels`, `lucide-react`, `@fontsource-variable/inter` + `jetbrains-mono`, Vitest, ESLint + Prettier, `thiserror`, `tempfile` (Rust test).

## Global Constraints
- Uygulama adı: **Xora Code**, identifier `com.xora.code`. Proje **açık kaynak (MIT)**. Klasör yapısı, isimlendirme ve kod kalitesi vitrin seviyesinde olmalı.
- Hedef platform: önce Windows. Kod çapraz platform kalmalı (path'ler için `std::path`, ayırıcı hardcode edilmemeli).
- Monaco **lokalden** yüklenmeli (`loader.config({ monaco })`), CDN kullanılmamalı. Fontlar bundle edilmeli. Uygulama offline çalışmalı.
- UI metinleri Türkçe, kod, isimler ve kod yorumları İngilizce.
- Görsel dil: **onyx/AMOLED**. Zemin saf siyah, monokrom, ayrımlar 1px border ile. Renkler sadece Task 5'teki design token'larından gelir, bileşenlerde ham hex kullanılmaz.
- Task 2'den itibaren her task `npm run check` ile `cargo fmt --check` / `clippy -D warnings` / `cargo test` kapılarından temiz geçmeli.
- Kullanıcıya hata `alert()` ile gösterilmez, UI içinde gösterilir.
- Import'lar `@/` alias'ı ile yapılır (aynı feature içindeki göreli import'lar hariç).
- Commit yazar e-postası `95590733+Mavrom@users.noreply.github.com` olmalı (repo config'te ayarlı). Her commit öncesi `git config user.email` ile kontrol edilmeli.
- Commit mesajları şu satırla bitmeli: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Dosya watcher bu fazda **yok**. Agent dosya değiştirdiğinde gerekeceği için Faz 2'ye bırakıldı.

## Dosya yapısı (bu fazın sonunda)
```
.github/workflows/ci.yml
src-tauri/src/
  lib.rs                     modül + handler kaydı
  error.rs                   AppError, AppResult
  fs/mod.rs                  DirEntry, list_dir, read_file, write_file + testler
  fs/commands.rs             fs_list_dir, fs_read_file, fs_write_file
src/
  main.tsx
  app/App.tsx, Layout.tsx, TopBar.tsx
  styles/globals.css         Tailwind + onyx design token'ları
  shared/lib/ipc.ts, path.ts (+ test)
  shared/ui/IconButton.tsx, EmptyState.tsx, PanelHeader.tsx, cn.ts
  features/workspace/store.ts
  features/files/FileTree.tsx, FileIcon.tsx, useDirectory.ts
  features/editor/store.ts (+ test), EditorPanel.tsx, EditorTabs.tsx, saveActiveTab.ts, monaco/setup.ts, monaco/theme.ts
  features/chat/ChatPanel.tsx, Composer.tsx
LICENSE, README.md, README.tr.md, CONTRIBUTING.md, docs/architecture.md
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

### Task 2: Geliştirici araçları: lint, format, path alias, Rust kalite kapıları, CI

**Files:**
- Create: `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `src-tauri/rustfmt.toml`, `.github/workflows/ci.yml`
- Modify: `package.json` (scripts, devDeps), `tsconfig.json` (paths), `vite.config.ts` (alias + vitest config), `.gitignore` (gerekirse)

**Interfaces:**
- Produces: `@/` import alias'ı (`@/` → `src/`), hem TS'te hem Vite/Vitest'te çalışır. npm script'leri: `lint`, `format`, `format:check`, `typecheck`, `test`, `check` (hepsini sırayla çalıştırır). Rust tarafında `cargo fmt --check` ve `cargo clippy --all-targets -- -D warnings` temiz geçmeli. Sonraki tüm task'lar bu kapılardan geçmek zorunda.

- [ ] **Step 1: Bağımlılıklar**

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals prettier
```

- [ ] **Step 2: `eslint.config.js`**

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "src-tauri/target", "src-tauri/gen"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
```

- [ ] **Step 3: Prettier, EditorConfig, rustfmt**

`.prettierrc.json`:
```json
{ "printWidth": 100, "semi": true, "singleQuote": false, "trailingComma": "all" }
```
`.prettierignore`:
```
dist
src-tauri/target
src-tauri/gen
docs
package-lock.json
```
`.editorconfig`:
```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.rs]
indent_size = 4

[*.md]
trim_trailing_whitespace = false
```
`src-tauri/rustfmt.toml`:
```toml
edition = "2021"
max_width = 100
```
(İskeletin `Cargo.toml` dosyasındaki `edition` değeri neyse onu kullan.)
Satır sonları karışmasın diye repo köküne `.gitattributes` ekle: `* text=auto eol=lf`.

- [ ] **Step 4: Path alias**

`tsconfig.json` içinde `compilerOptions` altına `"baseUrl": "."` ve `"paths": { "@/*": ["src/*"] }` ekle.
`vite.config.ts` dosyasına `import { fileURLToPath, URL } from "node:url";` ekle, config'e de `resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }` ekle. Aynı dosyada Vitest ayarı: dosyanın en üstüne `/// <reference types="vitest/config" />` koy, config'e `test: { environment: "node", include: ["src/**/*.test.ts"] }` ekle.

- [ ] **Step 5: npm script'leri**

`package.json` `scripts` (mevcut `dev`, `build`, `preview`, `tauri` korunur):
```json
"typecheck": "tsc --noEmit",
"lint": "eslint .",
"format": "prettier --write .",
"format:check": "prettier --check .",
"test": "vitest run",
"check": "npm run typecheck && npm run lint && npm run format:check && npm run test"
```
Henüz test dosyası olmadığı için `vitest run` "no test files" hatası verir. Bunu önlemek için `test` script'i `vitest run --passWithNoTests` olsun.

**Güvenlik:** `monaco-editor@0.57` transitive olarak açığı olan `dompurify` (<=3.4.16, critical advisory) çekiyor. `package.json` dosyasına şu eklenir:
```json
"overrides": { "dompurify": "^3.4.17" }
```
Ardından `npm install` çalıştırılır. `npm audit` çıktısında critical açık kalmamalı. Kalan low seviyeli açık raporda not edilir.

- [ ] **Step 6: Mevcut kodu kapılardan geçir**

Run: `npm run format`, ardından `npm run check` → Expected: hepsi geçer.
Run: `cargo fmt --manifest-path src-tauri/Cargo.toml` ve `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` → Expected: uyarı yok.

- [ ] **Step 7: CI (`.github/workflows/ci.yml`)**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - uses: dtolnay/rust-toolchain@stable
        with:
          components: rustfmt, clippy
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - run: npm ci
      - run: npm run check
      - run: npm run build
      - run: cargo fmt --manifest-path src-tauri/Cargo.toml --check
      - run: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
      - run: cargo test --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 8: Commit**

```bash
git config user.email   # 95590733+Mavrom@users.noreply.github.com olmalı
git add -A
git commit -m "chore: add lint, format, path alias, rust quality gates and CI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rust `fs` modülü, merkezi hata tipi ve command'lar

**Files:**
- Create: `src-tauri/src/error.rs`, `src-tauri/src/fs/mod.rs`, `src-tauri/src/fs/commands.rs`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`

**Interfaces:**
- Produces (Rust): `error::AppError` (thiserror enum; frontend'e mesaj string'i olarak serialize edilir), `error::AppResult<T>`. `fs::DirEntry { name: String, path: String, is_dir: bool }` (JSON'da `isDir`), `fs::list_dir(&Path) -> io::Result<Vec<DirEntry>>` (önce klasörler, isimler büyük/küçük harf duyarsız sıralı, `.git` gizli), `fs::read_file(&Path) -> io::Result<String>`, `fs::write_file(&Path, &str) -> io::Result<()>`.
- Produces (IPC): `fs_list_dir { path }`, `fs_read_file { path }`, `fs_write_file { path, contents }`. Hata durumunda `AppError` mesaj string'i döner.
- Konvansiyon: her domain modülü (`fs`, ileride `agents`, `terminal`) kendi `commands.rs` dosyasını taşır. `lib.rs` sadece modülleri ve handler'ları kaydeder.

- [ ] **Step 1: Bağımlılıklar**

`src-tauri/Cargo.toml`: `[dependencies]` altına `thiserror = "2"` ekle. `serde` (derive ile) ve `serde_json` mevcut değilse ekle.
```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 2: `src-tauri/src/error.rs`**

```rust
use serde::{Serialize, Serializer};

/// Error type returned by every Tauri command. Serialized as its message so
/// the frontend receives a plain string in the rejected promise.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_as_message_string() {
        let err = AppError::from(std::io::Error::new(std::io::ErrorKind::NotFound, "missing"));
        assert_eq!(serde_json::to_string(&err).unwrap(), r#""missing""#);
    }
}
```

- [ ] **Step 3: Başarısız `fs` testlerini yaz**

`src-tauri/src/fs/mod.rs`:
```rust
pub mod commands;

use serde::Serialize;
use std::io;
use std::path::Path;

/// Entries hidden from directory listings.
const HIDDEN: &[&str] = &[".git"];

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
`src-tauri/src/fs/commands.rs` (derlenmesi için şimdilik boş bir dosya, Step 6'da doldurulacak):
```rust
```
`src-tauri/src/lib.rs` başına `mod error;` ve `mod fs;` ekle.

- [ ] **Step 4: Kırmızıyı gör**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: 3 `fs` testi `not implemented` panic'iyle FAIL olur, `serializes_is_dir_as_camel_case` ve `serializes_as_message_string` PASS olur.

- [ ] **Step 5: Implementasyon**

`fs/mod.rs` içindeki üç fonksiyonu değiştir:
```rust
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
Run: `cargo test --manifest-path src-tauri/Cargo.toml` → Expected: 5 passed.

- [ ] **Step 6: Command'lar**

`src-tauri/src/fs/commands.rs`:
```rust
use super::DirEntry;
use crate::error::AppResult;
use std::path::PathBuf;

// Commands are async so file IO never blocks the main (UI) thread.

#[tauri::command]
pub async fn fs_list_dir(path: String) -> AppResult<Vec<DirEntry>> {
    Ok(super::list_dir(&PathBuf::from(path))?)
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> AppResult<String> {
    Ok(super::read_file(&PathBuf::from(path))?)
}

#[tauri::command]
pub async fn fs_write_file(path: String, contents: String) -> AppResult<()> {
    Ok(super::write_file(&PathBuf::from(path), &contents)?)
}
```
`src-tauri/src/lib.rs` (iskeletteki plugin satırları korunur):
```rust
mod error;
mod fs;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            fs::commands::fs_list_dir,
            fs::commands::fs_read_file,
            fs::commands::fs_write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7: Kalite kapıları**

Run: `cargo test`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` (hepsi `--manifest-path src-tauri/Cargo.toml` ile) → Expected: hepsi temiz.

- [ ] **Step 8: Commit**

```bash
git add src-tauri
git commit -m "feat(fs): add fs commands with central AppError type

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: IPC katmanı ve feature store'ları

**Files:**
- Create: `src/shared/lib/ipc.ts`, `src/shared/lib/path.ts`, `src/shared/lib/path.test.ts`, `src/features/workspace/store.ts`, `src/features/editor/store.ts`, `src/features/editor/store.test.ts`

**Interfaces:**
- Consumes: Task 3 command'ları, Task 2'deki `@/` alias'ı.
- Produces:
  - `@/shared/lib/ipc`: `interface DirEntry { name: string; path: string; isDir: boolean }`, `ipc.listDir(path): Promise<DirEntry[]>`, `ipc.readFile(path): Promise<string>`, `ipc.writeFile(path, contents): Promise<void>`
  - `@/shared/lib/path`: `basename(path: string): string` (hem `\` hem `/` ile çalışır), `extname(path: string): string` (noktasız ve küçük harfli uzantı döner, yoksa `""`; örnek `"a/B.TSX"` → `"tsx"`, `".gitignore"` → `""`)
  - `@/features/workspace/store`: `useWorkspaceStore` → `{ root: string | null; setRoot(root: string): void }`
  - `@/features/editor/store`: `useEditorStore` → `{ tabs: Tab[]; activePath: string | null; openFile(path, content); updateContent(path, content); markSaved(path, content); closeTab(path); setActive(path) }`, `interface Tab { path: string; name: string; content: string; savedContent: string }`, `isDirty(tab): boolean`

- [ ] **Step 1: `src/shared/lib/ipc.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

/** Typed wrappers around the Rust commands. Keep names in sync with `src-tauri/src/**/commands.rs`. */
export const ipc = {
  listDir: (path: string) => invoke<DirEntry[]>("fs_list_dir", { path }),
  readFile: (path: string) => invoke<string>("fs_read_file", { path }),
  writeFile: (path: string, contents: string) => invoke<void>("fs_write_file", { path, contents }),
};
```

- [ ] **Step 2: path için kırmızı test**

`src/shared/lib/path.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { basename, extname } from "./path";

describe("basename", () => {
  it("handles windows and posix separators", () => {
    expect(basename("C:\\proj\\src\\a.ts")).toBe("a.ts");
    expect(basename("/proj/src/b.ts")).toBe("b.ts");
    expect(basename("plain")).toBe("plain");
  });
});

describe("extname", () => {
  it("returns lowercase extension without dot", () => {
    expect(extname("a/B.TSX")).toBe("tsx");
    expect(extname("C:\\x\\archive.tar.gz")).toBe("gz");
  });

  it("returns empty string for dotfiles and extensionless names", () => {
    expect(extname(".gitignore")).toBe("");
    expect(extname("Makefile")).toBe("");
  });
});
```
Run: `npm test` → Expected: FAIL, `./path` bulunamıyor.

- [ ] **Step 3: `src/shared/lib/path.ts`**

```ts
export const basename = (path: string) => path.split(/[\\/]/).pop() ?? path;

export const extname = (path: string) => {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};
```
Run: `npm test` → Expected: PASS.

- [ ] **Step 4: `src/features/workspace/store.ts`**

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

- [ ] **Step 5: editor store için kırmızı test**

`src/features/editor/store.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { isDirty, useEditorStore } from "./store";

const s = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({ tabs: [], activePath: null });
});

describe("editor store", () => {
  it("opens a file as a new active tab", () => {
    s().openFile("C:\\p\\a.ts", "x");
    expect(s().tabs).toEqual([{ path: "C:\\p\\a.ts", name: "a.ts", content: "x", savedContent: "x" }]);
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

  it("closing an unknown path is a no-op", () => {
    s().openFile("/a.ts", "");
    s().closeTab("/zzz.ts");
    expect(s().tabs).toHaveLength(1);
  });
});
```
Run: `npm test` → Expected: FAIL, `./store` bulunamıyor.

- [ ] **Step 6: `src/features/editor/store.ts`**

```ts
import { create } from "zustand";
import { basename } from "@/shared/lib/path";

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

  updateContent: (path, content) => set((state) => ({ tabs: patchTab(state.tabs, path, { content }) })),

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
Run: `npm test` → Expected: tümü PASS. Run: `npm run check` → Expected: temiz.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add typed IPC layer, path helpers and workspace/editor stores

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tasarım sistemi ve uygulama kabuğu (layout, dosya ağacı, sohbet alanı)

> Tasarım ağırlıklı bir task. Implementer görsel kararlarda inisiyatif alabilir, ama aşağıdaki token'lar, dosya yapısı ve davranışlar bağlayıcı.

**Files:**
- Create: `src/styles/globals.css` (eski `src/index.css` dosyasının yerine geçer, o dosya silinir), `src/shared/ui/IconButton.tsx`, `src/shared/ui/EmptyState.tsx`, `src/shared/ui/PanelHeader.tsx`, `src/shared/ui/cn.ts`, `src/app/App.tsx` (`src/App.tsx` buraya taşınır), `src/app/Layout.tsx`, `src/app/TopBar.tsx`, `src/features/files/FileTree.tsx`, `src/features/files/FileIcon.tsx`, `src/features/files/useDirectory.ts`, `src/features/chat/ChatPanel.tsx`, `src/features/chat/Composer.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `ipc` (`@/shared/lib/ipc`), `basename`/`extname` (`@/shared/lib/path`), `useWorkspaceStore`, `useEditorStore.openFile` / `activePath`, `open` (`@tauri-apps/plugin-dialog`).
- Produces: `<Layout />`. Editör paneli için `Layout` içinde sağ panel slot'u, şimdilik `<EmptyState>` gösterir; Task 6'da `<EditorPanel />` buraya girer. Shared UI primitive'leri: `IconButton({ icon, label, onClick, active? })` (`label` hem `aria-label` hem tooltip olarak kullanılır), `EmptyState({ icon?, title, description? })`, `PanelHeader({ title, actions? })`, `cn(...classes)`.

**Bağımlılıklar:**
```bash
npm install lucide-react react-resizable-panels @fontsource-variable/inter @fontsource-variable/jetbrains-mono
```
Fontlar paket olarak bundle edilir (offline çalışmalı, Google Fonts kullanılmaz).

**Design token'ları (bağlayıcı, `src/styles/globals.css` içinde Tailwind v4 `@theme` ile tanımlanır):**
```css
@import "tailwindcss";
@import "@fontsource-variable/inter";
@import "@fontsource-variable/jetbrains-mono";

@theme {
  --color-bg: #000000;          /* app base: AMOLED black */
  --color-surface: #0a0a0a;     /* panels, sidebars */
  --color-elevated: #111111;    /* inputs, menus, active tab */
  --color-hover: #171717;
  --color-border: #1c1c1c;
  --color-border-strong: #2a2a2a;
  --color-fg: #ededed;
  --color-fg-muted: #a1a1a1;
  --color-fg-subtle: #6b6b6b;
  --color-accent: #ffffff;      /* monochrome accent: white on onyx */
  --color-accent-fg: #000000;
  --color-warning: #e5b567;     /* dirty indicator */
  --color-danger: #f87171;

  --font-sans: "Inter Variable", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```
Bunun altına base stiller gelir: `html, body, #root { height: 100% }`, `body { background: var(--color-bg); color: var(--color-fg); font-family: var(--font-sans); font-size: 13px; -webkit-font-smoothing: antialiased; overflow: hidden; }`, ince ve koyu özel scrollbar (`::-webkit-scrollbar` 10px, thumb `--color-border-strong`), `::selection` rengi ve `:focus-visible` için 1px `--color-fg-subtle` outline. Bileşenlerde ham hex kullanılmaz, sadece token'lar (`bg-surface`, `text-fg-muted`, `border-border` vb.).

**Görsel dil:** Onyx/AMOLED. Zemin saf siyah, paneller ancak fark edilecek kadar açık. Ayrım gölge yerine 1px `border` ile yapılır. Monokrom: vurgu beyaz, renk sadece durum için (dirty, hata). Tipografi küçük ve sakin (13px, başlıklar 11px uppercase tracking-wide `fg-subtle`). Hover'lar yumuşak (`transition-colors duration-150`). Boşluklar dengeli. Linear, Vercel ve Zed'in koyu temaları referans. Cıvıl cıvıl renk, gradient ve emoji yok.

**Davranışlar (bağlayıcı):**
- **Layout:** Üstte 40px `TopBar`. Altında `react-resizable-panels` ile üç yatay panel: dosya ağacı (default %18, min %12), sohbet (ana, default %42, min %25), editör (default %40, min %20, `collapsible`). Aralarında 1px'lik ve hover'da belirginleşen resize handle var. Editör paneli TopBar'daki toggle ile açılıp kapanır (`ImperativePanelHandle.collapse()/expand()`). Panel boyutları `autoSaveId="xora-layout"` ile hatırlanır.
- **TopBar:** Solda küçük monokrom "Xora" wordmark'ı (metin, `font-semibold tracking-tight`) ve açık klasörün adı (`fg-muted`). Sağda `IconButton`'lar: "Klasör aç" (`FolderOpen`) ve "Editörü göster/gizle" (`PanelRight`, panel açıkken `active`).
- **Dosya ağacı:** `PanelHeader` başlığı "Explorer" ya da kök klasör adı. Klasör chevron'u (`ChevronRight`, açılınca 90° döner) var. `FileIcon` uzantıya göre lucide ikonu seçer: ts/tsx/js/jsx için `FileCode`, json için `Braces`, md için `FileText`, css için `Palette`, rs için `Cog`, toml/yaml/yml için `Settings2`, png/jpg/jpeg/svg/gif/webp için `Image`, diğerleri için `File`. İkonlar 14px, `fg-subtle` renkte. Aktif dosya satırı `bg-elevated text-fg`, hover `bg-hover`. Satır yüksekliği 24px, girinti seviye başına 12px. Children lazy yüklenir (`useDirectory(path, enabled)` hook'u `{ entries, error }` döner). Hatalar satır altında `text-danger text-xs` ile gösterilir, `alert` kullanılmaz. Klasör yoksa `EmptyState` gösterilir: başlık "Klasör açılmadı", açıklama "Başlamak için üst bardan bir klasör aç.", ve "Klasör aç" butonu.
- **Sohbet alanı (Faz 2 placeholder):** Ortada `EmptyState` var: başlık "Xora ile kodla", açıklama "Claude, Codex ve Gemini bağlantısı bir sonraki fazda geliyor.". Altta `Composer`: `bg-elevated border-border rounded-lg` ile yuvarlatılmış ve otomatik büyüyen bir textarea (max 8 satır), placeholder "Agent'a bir şey sor…". Altında küçük bir satırda `fg-subtle` renkte bir agent seçici rozet ("Agent seçilmedi") ve sağda devre dışı bir gönder `IconButton`'u (`ArrowUp`). Composer bu fazda disabled, ama görsel olarak bitmiş görünmeli.
- **Erişilebilirlik:** Tüm ikon butonlarında `aria-label` var. Ağaç `role="tree"` ve satırlar `role="treeitem"` + `aria-expanded`. Klavye ile focus-visible görünür.
- Dosya okuma hatası ağaçta satır altında gösterilir. `alert()` kullanılmaz.

- [ ] **Step 1:** Bağımlılıkları kur, `src/styles/globals.css` dosyasını yukarıdaki token'larla oluştur, `src/index.css` dosyasını sil. `src/App.tsx` dosyasını `src/app/App.tsx`'e taşı. `src/main.tsx` dosyası `@/app/App` ve `@/styles/globals.css` import etsin.
- [ ] **Step 2:** `src/shared/ui/` primitive'lerini yaz (`cn.ts`: falsy değerleri filtreleyip boşlukla birleştiren tek satırlık bir yardımcı, ek kütüphane yok).
- [ ] **Step 3:** `src/features/files/` dosyalarını yaz (`useDirectory`, `FileIcon`, `FileTree`).
- [ ] **Step 4:** `src/features/chat/` dosyalarını yaz (`ChatPanel`, `Composer`).
- [ ] **Step 5:** `src/app/TopBar.tsx` ve `src/app/Layout.tsx` dosyalarını yaz. `App.tsx` `<Layout />` render etsin.
- [ ] **Step 6: Doğrula:** `npm run check` ve `npm run build` temiz geçmeli. `npm run tauri dev` arka planda çalıştırılır, repo klasörü açılır. Ağaç, ikonlar, chevron, aktif satır, panel resize ve editör toggle'ı kontrol edilir. Uygulama penceresinin ekran görüntüsü alınıp `.superpowers/sdd/task-5-screenshot.png` olarak kaydedilir (computer-use ya da PowerShell ile pencere yakalama). Görseli kendin inceleyip token'lara ve görsel dile uymayan yerleri düzelt.
- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): add onyx design system, resizable shell, file tree and chat composer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Monaco editör paneli (lokal Monaco, onyx teması, sekmeler, Ctrl+S)

**Files:**
- Create: `src/features/editor/monaco/setup.ts`, `src/features/editor/monaco/theme.ts`, `src/features/editor/EditorPanel.tsx`, `src/features/editor/EditorTabs.tsx`, `src/features/editor/saveActiveTab.ts`
- Modify: `src/main.tsx`, `src/app/Layout.tsx`

**Interfaces:**
- Consumes: `useEditorStore` (tüm action'lar, `isDirty`), `ipc.writeFile`, Task 5'teki `FileIcon`, `IconButton`, `EmptyState` ve token'lar.
- Produces: `<EditorPanel />`, `saveActiveTab(): Promise<void>` (hata durumunda reject etmez, sonucu `{ ok: true } | { ok: false; error: string }` olarak döner). Monaco teması `"xora-onyx"`. Faz 2'deki diff review aynı panele eklenecek.

- [ ] **Step 1: Lokal Monaco kurulumu (`src/features/editor/monaco/setup.ts`)**

```ts
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
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

defineXoraTheme(monaco);
loader.config({ monaco });
```
`src/main.tsx` içinde globals.css import'unun altına `import "@/features/editor/monaco/setup";` ekle.

- [ ] **Step 2: `xora-onyx` teması (`src/features/editor/monaco/theme.ts`)**

`defineXoraTheme(m: typeof import("monaco-editor"))` fonksiyonu `m.editor.defineTheme("xora-onyx", { base: "vs-dark", inherit: true, rules, colors })` çağırır. `colors` Task 5'teki token'larla birebir eşleşmeli: `editor.background` = `#000000`, `editor.lineHighlightBackground` = `#0a0a0a`, `editorLineNumber.foreground` = `#3a3a3a`, `editorLineNumber.activeForeground` = `#a1a1a1`, `editor.selectionBackground` = `#ffffff1f`, `editorCursor.foreground` = `#ededed`, `editorIndentGuide.background1` = `#1c1c1c`, `editorWidget.background` = `#0a0a0a`, `editorWidget.border` = `#2a2a2a`, `scrollbarSlider.background` = `#2a2a2a80`. `rules`, sakin ve düşük doygunluklu bir syntax paleti kurar: yorumlar `6b6b6b` italik, keyword `c8c8c8`, string `a5c9a1`, number `d7b98c`, type `9fb8d6`, function `e6e6e6`. Monokrom his korunur.

- [ ] **Step 3: `saveActiveTab.ts`**

```ts
import { ipc } from "@/shared/lib/ipc";
import { isDirty, useEditorStore } from "./store";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Saves the active tab if it has unsaved changes. Reads store state at call time. */
export async function saveActiveTab(): Promise<SaveResult> {
  const { tabs, activePath, markSaved } = useEditorStore.getState();
  const tab = tabs.find((t) => t.path === activePath);
  if (!tab || !isDirty(tab)) return { ok: true };
  try {
    await ipc.writeFile(tab.path, tab.content);
    markSaved(tab.path, tab.content);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
```

- [ ] **Step 4: `EditorTabs.tsx`**

Sekme şeridi 36px yüksekliğinde ve `bg-surface border-b border-border`. Her sekmede `FileIcon` + isim var. Aktif sekme `bg-bg text-fg` (editör zeminiyle birleşir) ve üstünde 1px'lik `accent` çizgi taşır. Pasif sekme `text-fg-muted hover:bg-hover`. Dirty sekmede kapatma butonunun yerinde `warning` renkli bir nokta durur, hover'da nokta kapatma ikonuna (`X`, 14px) dönüşür. Orta tık sekmeyi kapatır. Dirty sekme kapatılırken `confirm("<isim> kaydedilmedi. Yine de kapatılsın mı?")` sorulur (native dialog bu fazda kabul edilebilir). Taşma olursa yatay scroll.

- [ ] **Step 5: `EditorPanel.tsx`**

Sekme yoksa `EmptyState` (ikon `FileCode`, başlık "Açık dosya yok", açıklama "Explorer'dan bir dosya seç."). Varsa `EditorTabs` ve `@monaco-editor/react` `<Editor theme="xora-onyx" path={active.path} value={active.content} onChange=... onMount=... />` gösterilir. Options: `{ minimap: { enabled: false }, fontFamily: "JetBrains Mono Variable", fontSize: 13, lineHeight: 20, fontLigatures: true, automaticLayout: true, scrollBeyondLastLine: false, smoothScrolling: true, cursorSmoothCaretAnimation: "on", padding: { top: 12 }, renderLineHighlight: "line" }`. `onMount` içinde `editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, ...)` ile `saveActiveTab()` çağrılır. Hata olursa panelin altında 28px'lik bir durum satırında `text-danger` mesaj 4 saniye gösterilir (`alert` yok). Durum satırı her zaman görünür ve sağında aktif dosyanın uzantısı (`extname`) büyük harfle `fg-subtle` renkte yazar.

- [ ] **Step 6:** `Layout` içindeki editör paneli slot'una `<EditorPanel />` yerleştir.

- [ ] **Step 7: Doğrula**

`npm run check` ve `npm run build` temiz geçmeli (Monaco chunk boyut uyarısı normal). `npm run tauri dev` ile:
- Spec dosyası açılınca markdown renklendirmesi gelir, `src/app/App.tsx` açılınca TSX renklendirmesi gelir. Sekme geçişi içeriği korur.
- Düzenleme yapınca sekmede nokta görünür. Ctrl+S ile nokta kaybolur ve dosya diske yazılır (`git diff` ile kontrol et, sonra `git checkout -- <dosya>` ile geri al).
- Editör offline yüklenir (Network'te CDN isteği yoktur).
- Ekran görüntüsü `.superpowers/sdd/task-6-screenshot.png` olarak kaydedilir ve tema token'larla uyumlu mu diye incelenir.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(editor): add local Monaco editor with onyx theme, tabs and Ctrl+S save

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Açık kaynak dokümantasyonu

**Files:**
- Create: `LICENSE`, `README.md` (iskeletin README'si varsa üzerine yazılır), `README.tr.md`, `CONTRIBUTING.md`, `docs/architecture.md`

**Interfaces:**
- Consumes: bitmiş Faz 1 yapısı (gerçek klasör ağacına bakılarak yazılır).

- [ ] **Step 1: `LICENSE`:** standart MIT metni. `Copyright (c) 2026 Xora Code contributors`.
- [ ] **Step 2: `README.md` (İngilizce, ana):** başlık ve tek cümlelik tanım ("An open-source, agent-first code editor. Bring your own Claude, ChatGPT or Gemini subscription."), varsa Task 6 ekran görüntüsü (`docs/assets/screenshot.png` olarak kopyalanır), Features (bugün olanlar ve "Roadmap" altında Faz 2–4), Tech stack, Getting started (önkoşullar: Node 24+, Rust stable, Tauri Windows önkoşulları için linkler `https://v2.tauri.app/start/prerequisites/`; komutlar `npm install`, `npm run tauri dev`), Scripts tablosu (`check`, `test`, `lint`, `format`), Project structure (kısa ağaç), License. Abartılı pazarlama dili yok.
- [ ] **Step 3: `README.tr.md`:** README'nin Türkçe karşılığı. İki README'nin en üstünde birbirine link var.
- [ ] **Step 4: `CONTRIBUTING.md`:** kurulum, `npm run check` + `cargo fmt/clippy/test` kapıları, commit stili (Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`), klasör konvansiyonları (feature bazlı `src/features/<name>/`, ortak kod `src/shared/`, Rust'ta her domain modülünün kendi `commands.rs` dosyası, hatalar `AppError` üzerinden).
- [ ] **Step 5: `docs/architecture.md`:** frontend ↔ Rust IPC akışı, klasör haritası, ileride gelecek `agents/` (ACP) modülünün yeri. Spec'e link.
- [ ] **Step 6:** `npm run format:check` geçmeli (docs ignore'da olsa bile README kökte, gerekirse formatla).
- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "docs: add README, license, contributing guide and architecture notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Faz 1 bitiş kriteri
- `cargo test --manifest-path src-tauri/Cargo.toml` ve `npm test` yeşil.
- `npm run tauri dev`: klasör açma, ağaç, Monaco'da aç/düzenle/kaydet ve editör panelini aç/kapa çalışıyor.
- Sıradaki adım: Faz 2 (ACP + Claude). Agent sohbeti, izin onayı, diff review ve dosya watcher için ayrı bir plan yazılacak.

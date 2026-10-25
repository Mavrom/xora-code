# Xora Code Faz 2: ACP ile agent entegrasyonu (tasarım)

> Durum: taslak, 2026-10-25. Ana tasarımın (`2026-10-25-xora-code-design.md`) Faz 2 ve Faz 3 kısmını somutlaştırır.
> Kaynakların hepsi birincil kaynak (spec sitesi, şema reposu, crates.io/npm registry, adapter kaynak kodu) ve 2026-10-25 tarihinde kontrol edildi.
> Doğrulanamayan her şey **[doğrulanmadı]** ile işaretli.

## 0. Özet kararlar

1. **Üç agent de ACP v1 (protocolVersion `1`) üzerinden çalışır.** Paketler ve sürümler resmi ACP Registry ile aynı:
   `@agentclientprotocol/claude-agent-acp@0.95.0`, `@agentclientprotocol/codex-acp@2.2.2`, `@google/gemini-cli@0.65.0 --acp`.
   Ana tasarımdaki `@zed-industries/*` adları ve `--experimental-acp` bayrağı **eskidi** (npm'de deprecated; aşağıya bakın).
2. **Model, mod ve effort seçimi için birinci yol `configOptions` + `session/set_config_option`.** Claude ve Codex bunu destekliyor.
   Gemini 0.65.0 hâlâ eski `modes` + kararsız `models` alanını kullanıyor (`session/set_mode`, `session/set_model`). Bu yüzden UI tek bir "kontrol modeli"ne indirger (bölüm 4.4).
   Gemini effort/thinking seviyesini ACP üzerinden **açmıyor**, bu yüzden Gemini'de o seçici gizlenir.
3. **Rust tarafında `agent-client-protocol-schema =1.12.0` (sadece tipler) ve kendi küçük ndjson JSON-RPC transport'umuz kullanılır.** Yüksek seviyeli `agent-client-protocol` 3.5.0 crate'i kullanılmaz. Gerekçe bölüm 3.1'de.
4. **Çalışma anında `npx` kullanılmaz.** Adapter, uygulamanın kendi klasörüne sabit bir sürümle kurulur (`npm install --prefix`) ve `node.exe <entry.js>` ile doğrudan başlatılır. Bu yaklaşım Windows'ta `.cmd` shim, `cmd.exe` quoting, konsol penceresi ve her açılışta registry'ye gidilmesi sorunlarını ortadan kaldırır.
5. **Abonelik, CLI'ın kendi login'i ile kullanılır.** Xora hiçbir token'ı okumaz ya da taşımaz. Claude için varsayılan olarak child env'den `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` çıkarılır. Aksi halde Claude Code aboneliği değil API anahtarını kullanır (bölüm 1.4).

---

## 1. Sağlayıcılar: başlatma, auth, abonelik

### 1.1 Doğrulanmış sürümler (2026-10-25)

| Bileşen | Sürüm | Kaynak | Not |
|---|---|---|---|
| ACP şeması (v1) | schema-v1.26.0 (2026-10-16) | github.com/agentclientprotocol/agent-client-protocol `schema/v1` | Kararlı metotlar aşağıda |
| Rust `agent-client-protocol` | 3.5.0 (2026-10-22) | crates.io | MSRV **1.88**, Apache-2.0 |
| Rust `agent-client-protocol-schema` | 1.12.0 (2026-10-16) | crates.io | MSRV **1.88**. 3.5.0 bunu `=1.12.0` ile sabitliyor |
| TS SDK `@agentclientprotocol/sdk` | 2.0.2 | npm | Referans için. Biz kullanmıyoruz |
| Claude adapter `@agentclientprotocol/claude-agent-acp` | 0.95.0 (2026-10-23) | npm + registry | `engines.node >=22`. İçinde `@anthropic-ai/claude-agent-sdk@0.3.309` (native Claude CLI dahil) |
| Codex adapter `@agentclientprotocol/codex-acp` | 2.2.2 (2026-10-10) | npm + registry | TypeScript. `@openai/codex ^0.160.1` bağımlılığı ile gelir. Codex App Server'ı başlatır |
| Gemini CLI `@google/gemini-cli` | 0.65.0 (2026-10-20) | npm + registry | `engines.node >=20`. Native ACP |
| Claude Code CLI `@anthropic-ai/claude-code` | 2.1.310 | npm | Sadece login ve kullanıcı kurulumu için. Adapter kendi CLI'ını getirir |
| Codex CLI `@openai/codex` | 0.164.0 | npm | Adapter kendi kopyasını getirir |

**Eskiyen adlar (kullanmayın):** `@zed-industries/claude-code-acp` (0.16.2) ve `@zed-industries/claude-agent-acp` (0.23.1) npm'de deprecated, "renamed to @agentclientprotocol/claude-agent-acp" diyor. `@zed-industries/codex-acp` (0.16.0) deprecated, "replaced by @agentclientprotocol/codex-acp" diyor. Gemini 0.65.0 kaynağında `--experimental-acp` için "deprecated, use --acp instead" yazıyor (`packages/cli/src/config/config.ts`).

**ACP Registry:** `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json` (43 agent). İlgili kayıtlar:

```json
{ "id": "claude-acp", "version": "0.95.0", "distribution": { "npx": { "package": "@agentclientprotocol/claude-agent-acp@0.95.0" } } }
{ "id": "codex-acp",  "version": "2.2.2",  "distribution": { "npx": { "package": "@agentclientprotocol/codex-acp@2.2.2" } } }
{ "id": "gemini",     "version": "0.65.0", "distribution": { "npx": { "package": "@google/gemini-cli@0.65.0", "args": ["--acp"] } } }
```

Karar: Xora, test ettiği sürümleri `registry.rs` içinde **sabit (pinned)** tutar. Registry JSON yalnızca "güncelleme mevcut" bildirimi için okunur (Faz 3+, opsiyonel). Böylece bir adapter sürümünün kırıcı değişikliği sessizce kullanıcıya ulaşmaz.

### 1.2 Başlatma komutları

Mantıksal komutlar (registry'deki `npx` dağıtımı) şunlar:

| Agent | Mantıksal komut | Xora'nın gerçek çağrısı (Windows, yönetilen kurulum) |
|---|---|---|
| Claude | `npx -y @agentclientprotocol/claude-agent-acp@0.95.0` | `node.exe %APPDATA%\com.xora.code\agents\claude-acp\0.95.0\node_modules\@agentclientprotocol\claude-agent-acp\dist\index.js` |
| Codex | `npx -y @agentclientprotocol/codex-acp@2.2.2` | `node.exe ...\agents\codex-acp\2.2.2\node_modules\@agentclientprotocol\codex-acp\dist\index.js` |
| Gemini | `npx -y @google/gemini-cli@0.65.0 --acp` | `node.exe ...\agents\gemini\0.65.0\node_modules\@google\gemini-cli\bundle\gemini.js --acp` |

- Entry yolu package.json `bin` alanından okunur, sabit yazılmaz. Doğrulanan bin değerleri: `claude-agent-acp: dist/index.js`, `codex-acp: dist/index.js`, `gemini: bundle/gemini.js`.
- Kurulum komutu: `node <npm-cli.js> install --prefix <dir> <pkg>@<ver> --no-fund --no-audit --omit=dev`. `npm-cli.js`, `node.exe`'nin yanındaki `node_modules/npm/bin/npm-cli.js` dosyasından bulunur. Böylece `npm.cmd` çağrılmaz. **Optional dependency'ler atlanmamalı** (`--omit=optional` yok). Claude SDK native CLI'ı, Gemini de `node-pty`'yi optional dep olarak getiriyor. Claude adapter kodu açıkça "Reinstall ... without --omit=optional" hatası veriyor.
- Kullanıcı Gemini'yi global kurduysa (`npm i -g @google/gemini-cli`), registry `gemini` için bunu da aday olarak kabul eder. `npm root -g` altında `@google/gemini-cli/package.json` bulunur, sürüm okunur ve entry'ye `node` ile gidilir. Claude ve Codex için kullanıcı kurulumu adapter yerine geçmez. Adapter ayrı bir pakettir.
- Yararlı env değişkenleri (adapter README/kaynak):
  - Claude: `CLAUDE_AGENT_LOGS=<dir>` (adapter log dosyası), `CLAUDE_CODE_EXECUTABLE` (başka CLI kullanmak için. **Kullanmıyoruz**, SDK ile CLI sürüm uyumu bozulabilir), `CLAUDE_AGENT_ACP_PROTOCOL=v1` (v2 taslağını kapatır. **Bunu set ediyoruz**).
  - Codex: `INITIAL_AGENT_MODE` (`read-only` | `workspace-write` | `agent` | `agent-full-access`), `CODEX_PATH`, `APP_SERVER_LOGS=<dir>`, `NO_BROWSER`.
  - Gemini: özel bir şey gerekmez.

### 1.3 Auth akışı (`initialize.authMethods` + `authenticate`)

ACP v1'de iki auth metodu tipi var (şema `AuthMethod`):
- `type` yok veya `"agent"`: istemci `authenticate { methodId }` çağırır, gerisini agent halleder (tarayıcı açar).
- `type: "terminal"`: istemci **agent programını `args` ile ayrı, etkileşimli bir süreç olarak** çalıştırır ve `authenticate` çağırmaz. Bu tip yalnızca istemci `clientCapabilities.auth.terminal = true` bildirirse sunulur.

Hata kodu: `-32000` = "Authentication required" (şema `ErrorCode`). `session/new` bu kodla dönerse UI auth kartını gösterir.

| Agent | `authMethods` (gerçek id'ler) | Xora akışı |
|---|---|---|
| Claude (0.95.0) | `claude-ai-login` (terminal, args `["--cli","auth","login","--claudeai"]`, "Claude Subscription"), `console-login` (terminal, `--console`). Uzak oturumda `claude-login` (args `["--cli"]`). `gateway` yalnızca `auth._meta.gateway` bildirilirse | `auth.terminal: true` bildir. "Giriş yap" butonu `node <entry> --cli auth login --claudeai` komutunu **görünür bir konsolda** çalıştırır (paket T'nin terminal sekmesi ya da `cmd /c start`). Bitince `session/new` yeniden denenir. `--cli`, adapter'ın kendi bundled Claude CLI'ına geçmesini sağlar (`src/index.ts`) |
| Codex (2.2.2) | `api-key`, `chat-gpt` ("ChatGPT"), `chat-gpt-device-code` (yalnızca URL elicitation destekleyen istemcide), `gateway` (opt-in). Hepsi agent tipi | `authenticate { methodId: "chat-gpt" }`. Adapter, Codex App Server üzerinden tarayıcı login'ini açar. `api-key` Faz 2'de UI'da gösterilmez (kapsam dışı) |
| Gemini (0.65.0) | `oauth-personal` ("Log in with Google"), `gemini-api-key`, `vertex-ai`, `gateway`. Hepsi agent tipi | `authenticate { methodId: "oauth-personal" }`. Dikkat: Gemini, **seçili metottan farklı** bir metotla `authenticate` çağrılırsa önbellekteki kimlik bilgilerini siler (`clearCachedCredentialFile`). Yalnızca `oauth-personal` gönderilir |

Kural: Xora `authenticate`'i **her açılışta değil, yalnızca `-32000` geldiğinde** (ya da kullanıcı "Giriş yap"a bastığında) çağırır. Kimlik bilgisi dosyaları zaten varsa (Claude `%USERPROFILE%\.claude\.credentials.json`, Codex `~/.codex/auth.json`, Gemini `~/.gemini/oauth_creds.json`) `session/new` doğrudan çalışır. Paket S'in Hesaplar ekranındaki "Giriş yapılmış" sezgisi aynı dosyalara bakar. Faz 2, oradaki "Giriş yap" butonunu yukarıdaki ACP akışına bağlar.

Claude adapter ayrıca `_meta.authStatus` kabiliyeti ve `_auth/status_update` bildirimi ile kimlik durumunu itiyor. Xora bunu Faz 2'de yok sayar, Faz 3'te Hesaplar ekranına bağlanabilir. **[doğrulanmadı: payload şekli]**

### 1.4 Abonelik nasıl kullanılıyor

- **Claude:** Adapter, Claude Agent SDK'nın bundled CLI'ını çalıştırır. CLI, `/login` (claude.ai) ile kaydedilmiş OAuth kimliğini kullanır. Windows'ta konum `%USERPROFILE%\.claude\.credentials.json` (code.claude.com/docs/en/authentication). Resmi öncelik sırası: bulut sağlayıcı env > `ANTHROPIC_AUTH_TOKEN` > `ANTHROPIC_API_KEY` > `apiKeyHelper` > `CLAUDE_CODE_OAUTH_TOKEN` > profil > **abonelik OAuth**. Etkileşimsiz modda (SDK) `ANTHROPIC_API_KEY` "always used when present". **Sonuç:** Kullanıcının ortamında API anahtarı varsa abonelik yerine API faturası kesilir. Xora varsayılan olarak Claude child env'inden `ANTHROPIC_API_KEY` ve `ANTHROPIC_AUTH_TOKEN`'ı kaldırır. Ayar (paket S, "Agent" bölümü): "Claude: ortamdaki API anahtarını yok say (aboneliği kullan)", varsayılan açık.
- **Codex:** `chat-gpt` metodu ChatGPT Plus/Pro/Team aboneliğini kullanır. Kimlik bilgisi Codex'in kendi `CODEX_HOME` klasöründe (`~/.codex/auth.json`) durur. Adapter `CODEX_API_KEY`/`OPENAI_API_KEY`'i yalnızca `api-key` metodu seçilirse kullanır (README), bu yüzden env temizliği gerekmez.
- **Gemini:** `oauth-personal` Google hesabının Gemini CLI kotasını ya da Code Assist aboneliğini kullanır. Seçim `~/.gemini/settings.json` → `security.auth.selectedType` içine yazılır.

ToS notu: Xora yalnızca resmi CLI'ları ve resmi adapter'ları alt süreç olarak çalıştırır ve login'i kullanıcının kendi CLI'ına bırakır. Bu, Zed ve JetBrains AIR'ın kullandığı yolun aynısı.

---

## 2. Protokol yaşam döngüsü (ACP v1, schema-v1.26.0)

### 2.1 Metot envanteri (`schema/v1/meta.json`, kararlı)

- Agent tarafı: `initialize`, `authenticate`, `session/new`, `session/load`, `session/set_mode`, `session/set_config_option`, `session/prompt`, `session/cancel` (notification), `session/list`, `session/delete`, `session/resume`, `session/close`, `logout`.
- İstemci tarafı: `session/request_permission`, `session/update` (notification), `fs/read_text_file`, `fs/write_text_file`, `terminal/create|output|release|wait_for_exit|kill`, `elicitation/create`, `elicitation/complete`.
- Protokol: `$/cancel_request` (istek iptali, kararlı).
- **`session/set_model` artık şemada yok.** Hem kararlı hem `meta.unstable.json` listesinde bulunmuyor. Rust schema crate 1.12.0'da `SetSessionModelRequest`/`SessionModelState` tipleri de yok (docs.rs). Gemini ise TS SDK 0.16.1 ile hâlâ `session/set_model` sunuyor ve `session/new` yanıtında `models` döndürüyor. Xora bunu **ham JSON** ile konuşur (bölüm 3.3).

### 2.2 Akış

```
Xora                                   Agent (alt süreç, stdio ndjson)
 |-- initialize {protocolVersion:1, clientCapabilities, clientInfo} -->
 |<-- {protocolVersion, agentCapabilities, authMethods, agentInfo} ----
 |-- session/new {cwd, mcpServers:[]} -------------------------------->
 |<-- {sessionId, modes?, configOptions?, (Gemini: models?)} ---------   (-32000 => auth)
 |<-- session/update available_commands_update ------------------------   (gecikmeli gelebilir)
 |-- session/prompt {sessionId, prompt:[ContentBlock]} --------------->
 |<-- session/update agent_thought_chunk / agent_message_chunk -------
 |<-- session/update tool_call {status:pending} ----------------------
 |<== session/request_permission {toolCall, options} =================   (istek, yanıt bekler)
 |== {outcome:{outcome:"selected", optionId}} =======================>
 |<== fs/write_text_file / terminal/create ... (istemci metotları) ===
 |<-- session/update tool_call_update {status:completed, content:[diff]}
 |<-- session/update plan / usage_update / session_info_update -------
 |<-- {stopReason:"end_turn"} (prompt yanıtı) ------------------------
 |-- session/cancel {sessionId} (notification, istenirse) ----------->   => stopReason "cancelled"
```

**initialize, Xora'nın göndereceği `clientCapabilities`:**

```json
{
  "fs": { "readTextFile": true, "writeTextFile": true },
  "terminal": true,
  "auth": { "terminal": true },
  "session": { "configOptions": { "boolean": {} } }
}
```

- `session.configOptions.boolean` bildirilirse Codex `fast-mode`'u boolean toggle olarak gönderir, bildirilmezse select (Off/On) olarak (`FastModeConfig.ts`). UI ikisini de destekler.
- `elicitation`, `subagents`, `compaction`, `notices` Faz 2'de **bildirilmez**. Bildirilmeyince adapter'lar bunları normal tool call ya da düz metin olarak gönderiyor (Claude README: "Without either signal, Agent and Task stay ordinary tool calls").
- `clientInfo: { name: "xora-code", title: "Xora Code", version }`.

**Agent kabiliyetleri (kaynak koddan):**

| | loadSession | sessionCapabilities | promptCapabilities | Not |
|---|---|---|---|---|
| Claude 0.95.0 | true | list, resume, close, delete, fork, additionalDirectories | image, embeddedContext | `_meta.claudeCode.promptQueueing` |
| Codex 2.2.2 | true | list, resume, close, delete, fork | image, embeddedContext | |
| Gemini 0.65.0 | true | **yok** (list/resume yok) | image, audio, embeddedContext | |

### 2.3 `session/update` türleri (şemadaki 14 tür)

`user_message_chunk`, `agent_message_chunk`, `agent_thought_chunk`, `tool_call`, `tool_call_update`, `plan`, `available_commands_update`, `current_mode_update`, `config_option_update`, `session_info_update`, `usage_update`, `notice`, `compaction_update`, `compaction_summary_chunk`.

UI'nın Faz 2'de işlediği türler:
- `agent_message_chunk` / `user_message_chunk` (replay): `content: ContentBlock` (çoğunlukla `{type:"text", text}`).
- `agent_thought_chunk`: thinking bloğu. Üç agent de gönderiyor.
- `tool_call`: `{toolCallId, title, name?, kind, status, content[], locations[], rawInput?, rawOutput?}`. `kind`: `read|edit|delete|move|search|execute|think|fetch|switch_mode|other`. `status`: `pending|in_progress|completed|failed`.
- `tool_call_update`: aynı alanlar, `toolCallId` dışında hepsi opsiyonel. `content` gelirse **tamamen değiştirir**.
- `ToolCallContent`: `{type:"content", content}`, `{type:"diff", path, oldText?, newText}` (`oldText` null ise yeni dosya), `{type:"terminal", terminalId}`.
- `plan`: `entries[{content, priority: high|medium|low, status: pending|in_progress|completed}]`. Her seferinde tam liste gelir.
- `available_commands_update`: `availableCommands[{name, description, input?: {hint}}]`.
- `current_mode_update`: `{currentModeId}`.
- `config_option_update`: `{configOptions: [...]}`, tam durum.
- `session_info_update`: `{title?, updatedAt?}` (Claude başlık üretiyor). Geçmiş listesinde kullanılır.
- `usage_update`: `{used, size, cost?}`. Composer'da context doluluk göstergesi.
- `notice`: `{severity: info|warning|error, title, ...}` (kararlı, ama capability'si bildirilmediği için gelmesi beklenmez). Gelirse küçük bir bilgi satırı olarak gösterilir.
- `compaction_*`: Faz 2'de yok sayılır.
- **Bilinmeyen türler** (ör. Claude'un AIR'a özel `subagent_spawned`): Rust bunları düşürmez, ham JSON olarak iletir. TS reducer bilinmeyeni yok sayar ve `console.debug` ile loglar.

### 2.4 İzin isteği

`session/request_permission { sessionId, toolCall: ToolCallUpdate, options: [{optionId, name, kind: allow_once|allow_always|reject_once|reject_always}] }`.
Yanıt `{ outcome: { outcome: "selected", optionId } }` ya da `{ outcome: { outcome: "cancelled" } }`.
Spec kuralı: istemci `session/cancel` gönderdiğinde o oturumun **bekleyen tüm izin isteklerini `cancelled` ile yanıtlamalıdır**. Rust bunu otomatik yapar.

Gemini seçenek adları (`acpUtils.ts`): "Allow", "Reject", "Allow for this session", "Allow for this file in all future sessions", "Allow this command for all future sessions" vb. Seçenek metinleri agent'tan geldiği gibi gösterilir. Türkçe etiket yalnızca `kind`'a göre ikon ve renk için kullanılır.

### 2.5 İptal

`session/cancel { sessionId }` bir notification'dır. Agent devam eden `session/prompt`'u `stopReason: "cancelled"` ile kapatmak **zorundadır**. Ayrıca `$/cancel_request` belirli bir JSON-RPC isteğini iptal eder. Xora bunu yalnızca uzun süren `session/new`/`session/load` için kullanır (kullanıcı vazgeçerse).

Claude'a özel davranış: arka plan alt-agent'ları ve arka plan komutları cancel'dan sonra çalışmaya devam edebilir (README). UI "durduruldu" dedikten sonra gelen `tool_call_update`'leri de işlemeye devam etmelidir.

### 2.6 Oturum geçmişi

- `session/list { cwd?, cursor? }` → `{ sessions: [{sessionId, cwd, title?, updatedAt?}], nextCursor? }`. Claude ve Codex destekliyor.
- `session/load { sessionId, cwd, mcpServers: [] }`: agent **tüm geçmişi `session/update` olarak replay eder** (`user_message_chunk`, `agent_message_chunk`, `tool_call` ...) ve sonra yanıt döner. Üçü de destekliyor (`loadSession: true`).
- `session/resume`: replay yok, yalnızca bağlamı geri yükler. Claude ve Codex destekliyor. Xora, transcript UI'da zaten görünüyorsa (aynı uygulama oturumu) `resume`, değilse `load` kullanır.
- `session/close`: oturum kapatılınca kaynakları bırakır (Claude, Codex). Desteklenmiyorsa hiçbir şey gönderilmez.
- Gemini'de `session/list` yok. Xora her agent için **yerel bir oturum indeksi** tutar (bölüm 3.8). Gemini için liste oradan gelir ve açarken `session/load` çağrılır.

### 2.7 Slash komutları

Agent `available_commands_update` ile komut listesini gönderir. Kullanıcı komutu **düz metin prompt** olarak gönderir: `{type:"text", text:"/review src/lib.rs"}`. İstemci ayrı bir metot çağırmaz.
- Codex README'deki komutlar: `/status`, `/mcp`, `/skills`, `/goal`, `/review`, `/review-branch`, `/review-commit`, `/compact`, `/logout` ve yapılandırılmış skill'ler.
- Claude: SDK'nın desteklediği komutlar ve kullanıcının özel komutları (`.claude/commands`), `/mcp`.
- Gemini: `/memory`, `/init` vb. (`acpCommandHandler.ts`).

UI kendi komutlarını (ör. "Yeni sohbet", "Oturumu temizle") agent komutlarıyla karıştırmaz. Popover'da ayrı bir "Xora" grubu olarak gösterir. Bunlar ağa gitmez.

---

## 3. Rust mimarisi (`src-tauri/src/agents/`)

### 3.1 Crate kararı

**Seçim:** `agent-client-protocol-schema = "=1.12.0"` (yalnızca serde tipleri) + kendi transport'umuz (`transport.rs`, ~250 satır).

Yüksek seviyeli `agent-client-protocol` 3.5.0 neden kullanılmıyor:
1. **API çok hızlı değişiyor.** 1.0.0 (2026-07-06), 2.0.0 (07-23), 3.0.0 (10-06) ve 3.5.0 (10-22) arka arkaya çıktı. Repoda `migration-v3.md`, `migration_v2.0.md`, `migration-connection-drivers.md` ve `migration-config-api.md` dosyaları var. 0.x'teki `Client` trait'i ve `ClientSideConnection` 3.x'te **yok**. Yerine handler builder'ı geldi: `Client.builder().on_receive_request(...).on_receive_notification(...).connect_with(transport, async |cx| ...)` (`examples/yolo_one_shot_client.rs`).
2. **Ham metot gerekiyor.** Gemini'nin `session/set_model` metodu ve `session/new` yanıtındaki `models` alanı şemadan çıkarıldı. Bilinmeyen `session/update` türlerini de kayıpsız iletmek istiyoruz.
3. **Süreç kontrolü bizde kalmalı.** `process` feature'ı `async-process` ile spawn ediyor. Windows'ta `CREATE_NO_WINDOW`, Job Object ve env temizliği gibi ihtiyaçlarımız var.
4. **Transport basit.** ndjson (satır başına bir JSON-RPC mesajı) ve Tauri zaten tokio kullanıyor.

Bedeli: istek id eşlemesini, iptal ve sıralamayı kendimiz test ederiz. Bunlar saf mantık olduğu için `cargo test` ile kolay test edilir. Crate ileride yerleşirse `transport.rs` + `acp.rs`, `ConnectTo` uygulayan bir adaptöre çevrilebilir. Arayüz (bölüm 3.4) değişmez.

**Gerekli Cargo değişiklikleri** (paylaşılan dosya, ekleme yapılır):
```toml
rust-version = "1.88"        # schema crate MSRV 1.88; şu an 1.85
[dependencies]
agent-client-protocol-schema = "=1.12.0"
tokio = { version = "1", features = ["process", "io-util", "sync", "time", "macros", "rt"] }
uuid = { version = "1", features = ["v4"] }
dunce = "1"                  # Windows canonicalize; \\?\ öneki olmadan
[target.'cfg(windows)'.dependencies]
windows-sys = { version = "0.61", features = ["Win32_System_JobObjects", "Win32_System_Threading", "Win32_Foundation", "Win32_Security"] }
```
Not: şema tipleri `#[non_exhaustive]`, kurmak için `::new(...)` kullanılır. Bilinmeyen alanlar için `x-deserialize-default-on-error` politikası uygulanır. Biz kritik yerlerde (`session/update`, `session/new` yanıtı) önce `serde_json::Value` alıp sonra tipe çeviririz.

### 3.2 Modüller ve sorumluluklar

```
src-tauri/src/agents/
  mod.rs            pub use; AgentManager (Tauri state), AgentError -> AppError
  registry.rs       AgentId {Claude, Codex, Gemini}; AgentSpec {package, version, binName, extraArgs, env policy};
                    node bulma (PATH + %ProgramFiles%\nodejs + nvm/volta), node >= 22 kontrolü, kurulum durumu
  install.rs        npm-cli.js ile `install --prefix`; ilerleme -> AgentEvent::AgentStatus{installing}
  process.rs        spawn (node.exe entry.js args), CREATE_NO_WINDOW, Job Object (kill-on-close), stderr -> log
  transport.rs      ndjson JSON-RPC 2.0: id üretimi, pending map<id, oneshot>, gelen request/notification ayırma,
                    \r\n toleransı, yazma kuyruğu (tek writer task), satır başına max boyut koruması
  acp.rs            AcpConnection: initialize/authenticate/session_*; gelen istekleri ClientHandlers'a yönlendirme
  session.rs        SessionState (agentId, cwd, roots, modes/configOptions/models snapshot, pending permissions)
  commands.rs       #[tauri::command] fonksiyonları (bölüm 5.2)
  events.rs         AgentEvent enum (paylaşılan kontrat, bölüm 5.1)
  permissions.rs    PermissionBroker: request_id -> oneshot; cancel_session(session_id) hepsini "cancelled" ile kapatır
  fs_bridge.rs      fs/read_text_file, fs/write_text_file (workspace sandbox, bölüm 3.5)
  terminal_bridge.rs terminal/* (bölüm 3.6)
  review.rs         tur başına dosya snapshot'ları (geri alma için, bölüm 4.3)
  index.rs          yerel oturum indeksi (app_data/agents/sessions.json, atomik yazma: notes deseni)
```

Paylaşılan dosyalara yalnızca ekleme yapılır: `lib.rs`'e `mod agents;`, `.manage(AgentManager::default())`, handler satırları ve pencere kapanırken shutdown hook'u. `error.rs`'e `Agents(#[from] agents::AgentError)` eklenir.

### 3.3 Bağlantı modeli

- **Her agent türü için tek süreç** (Claude, Codex, Gemini), ilk ihtiyaçta açılır. Aynı süreç birden çok oturumu taşır (ACP buna izin veriyor, `sessionId` ile ayrılır).
- `AgentManager { conns: Mutex<HashMap<AgentId, Arc<AcpConnection>>>, sessions: Mutex<HashMap<SessionId, SessionState>>, events: Mutex<Option<Channel<AgentEvent>>>, broker: PermissionBroker, terminals: TerminalBridge, review: ReviewStore }`.
- `AcpConnection` iç yapısı:
  - Bir **reader task** stdout satırlarını okur. Yanıtları pending map'e, istekleri `tokio::spawn(handle_incoming)`'a, notification'ları sırayla `on_notification`'a gönderir. Sıralama önemli: `session/update` notification'ları **aynı task içinde, geliş sırasıyla** Channel'a yazılır.
  - Bir **writer task** `mpsc` kuyruğundan alıp `stdin`'e `json + "\n"` yazar.
  - `request<T>(method, params: Value) -> Result<Value>` hem tipli hem ham kullanım içindir. Gemini'nin `session/set_model`'i şöyle gönderilir: `request("session/set_model", json!({"sessionId": id, "modelId": m}))`.
  - Gelen istek handler'ları uzun sürebilir (izin isteği kullanıcıyı bekler). Bu yüzden **reader'ı bloklamazlar**, ayrı task'ta çalışırlar.
- Prompt: `agent_prompt` komutu `session/prompt` isteğini gönderir, yanıtı ayrı bir task'ta bekler ve bitince `AgentEvent::TurnEnded { stopReason }` yayar. Komutun kendisi hemen döner. Bu şekilde UI'nın tek doğruluk kaynağı Channel olur ve sıralama yarışı olmaz: prompt yanıtı tüm update'lerden sonra aynı reader task'tan geçer.
- Agent başına aynı anda bir aktif tur vardır. Tur sürerken gönderilen yeni mesaj UI'da **kuyruğa** alınır. Claude `promptQueueing` bildiriyor ama Faz 2'de buna güvenmiyoruz.

### 3.4 `ClientHandlers` sınırı (paralel çalışma için)

```rust
// agents/acp.rs: A yazar; B uygular.
#[async_trait::async_trait] // ya da Pin<Box<dyn Future>> döndüren elle yazılmış trait
pub trait ClientHandlers: Send + Sync + 'static {
    async fn read_text_file(&self, req: ReadTextFileRequest) -> Result<ReadTextFileResponse, RpcError>;
    async fn write_text_file(&self, req: WriteTextFileRequest) -> Result<WriteTextFileResponse, RpcError>;
    async fn terminal_create(&self, req: CreateTerminalRequest) -> Result<CreateTerminalResponse, RpcError>;
    async fn terminal_output(&self, req: TerminalOutputRequest) -> Result<TerminalOutputResponse, RpcError>;
    async fn terminal_wait_for_exit(&self, req: WaitForTerminalExitRequest) -> Result<WaitForTerminalExitResponse, RpcError>;
    async fn terminal_kill(&self, req: KillTerminalRequest) -> Result<KillTerminalResponse, RpcError>;
    async fn terminal_release(&self, req: ReleaseTerminalRequest) -> Result<ReleaseTerminalResponse, RpcError>;
}
pub struct RpcError { pub code: i32, pub message: String } // -32602 invalid params, -32002 not found, -32603 internal
```
`session/request_permission` bu trait'te değil. A'nın `PermissionBroker`'ı doğrudan işler. Tipler `agent_client_protocol_schema::v1::*` içinden gelir. **[doğrulanmadı: 1.12.0'da modül yolu `schema::v1` mi yoksa kök mü. Rust SDK örneği `agent_client_protocol::schema::v1::...` kullanıyor. İlk implementer docs.rs'den teyit etsin]**

### 3.5 `fs_bridge.rs` (workspace sandbox)

- Oturumun izinli kökleri: `session/new` sırasındaki `cwd` (açık klasör) ve varsa `additionalDirectories`.
- Yol doğrulama (saf fonksiyon, test edilir): `resolve_in_roots(path, roots) -> Result<PathBuf>`.
  - Göreli yolu reddet (ACP mutlak yol ister).
  - `dunce::canonicalize` uygula. Yazmada dosya henüz yoksa en yakın var olan atayı canonicalize et ve kalan bileşenleri ekle. `..` bileşenlerini reddet.
  - Sonuç bir kökün altında değilse `-32602 "outside workspace"` döndür.
  - Windows'ta karşılaştırmayı büyük/küçük harf duyarsız yap (`to_lowercase` + `\` normalize). Symlink/junction canonicalize ile çözülür.
- `read_text_file { path, line?, limit? }`: UTF-8 oku. `line` 1 tabanlıdır, `limit` satır sayısıdır. Faz 2'de diskten okunur. **Faz 2b (opsiyonel):** editördeki kirli buffer varsa onu döndür (Zed davranışı **[doğrulanmadı]**). Bunun için frontend `agent_buffer_overlay(path, text|null)` ile Rust'a bildirim yapar.
- `write_text_file { path, content }`: yazmadan önce mevcut içeriği `review.rs`'e snapshot olarak ver (tur başına ilk dokunuş). Sonra atomik yaz (temp + rename, notes deseni) ve `AgentEvent::FileWritten { sessionId, path }` yay. Paket Q'nun watcher'ı zaten `fs://changed` yayıyor; ağaç ve editör oradan yenilenir.
- Kök dışına yazma: hata döner, sessizce yazılmaz. Not: Gemini, istemci fs'i reddedince kendi fs fallback'ine geçebiliyor (`acpFileSystemService.ts` → `shouldUseFallback`). Bu durumda bile Gemini'nin kendi izin akışı çalışır.

### 3.6 `terminal_bridge.rs`

ACP terminalleri **etkileşimli PTY değildir**. Agent bir komut çalıştırır, çıktıyı okur ve bekler. Bu yüzden paket T'nin `portable-pty` oturumları yeniden kullanılmaz. Burada `tokio::process` ile pipe kullanılır.
- `terminal/create { command, args, env, cwd?, outputByteLimit? }`: `cwd` köklerin içinde olmalı (fs_bridge doğrulaması kullanılır). Spawn `CREATE_NO_WINDOW` ve oturumun Job Object'i ile yapılır. stdout+stderr tek bir halka buffer'da birleşir. `outputByteLimit` aşılırsa baştan kırpılır (karakter sınırında) ve `truncated: true` döner. Komut `.exe` değilse Windows'ta `cmd /C` ile tekrar denenir. **[doğrulanmadı: hangi agent hangi biçimde komut gönderiyor. Claude kabuk komutunu tek string olarak gönderebilir. İlk entegrasyon testinde loglanacak]**
- `terminal/output` → `{ output, truncated, exitStatus? }`. `wait_for_exit` → `{ exitCode?, signal? }`. `kill` süreci öldürür ama terminal kaydı kalır. `release` öldürür ve kaydı siler.
- Canlı çıktı UI'ya `AgentEvent::TerminalOutput { terminalId, chunk }` olarak akar (100 ms ya da 8 KB'da bir birleştirilir). Tool kartı `{type:"terminal", terminalId}` içeriğini bu akışla gösterir.
- `terminal: true` bildirilince Claude komutları istemci terminalinde çalıştırır ("Interactive (and background) terminals"). Codex kendi sandbox'ında çalıştırıp çıktıyı içerik olarak gönderir.

### 3.7 İzin round-trip'i

1. Gelen `session/request_permission` için `PermissionBroker::open(session_id, payload) -> (request_id, oneshot::Receiver)` çağrılır ve `AgentEvent::PermissionRequested { requestId, sessionId, toolCall, options }` yayılır.
2. UI `agent_permission_respond(requestId, optionId | null)` çağırır. `null` "cancelled" demektir.
3. Broker oneshot'ı tamamlar, handler JSON-RPC yanıtını yazar ve `AgentEvent::PermissionResolved` yayar (birden çok pencere ya da yeniden çizim için).
4. `agent_cancel(sessionId)` önce broker'daki o oturumun bütün isteklerini `cancelled` ile kapatır, sonra `session/cancel` gönderir.
5. Pencere kapanırken ya da süreç çökerken bekleyen her şey `cancelled` olur.
6. Xora'nın kendi otomatik onayı **yoktur**. Otomatik onay agent'ın moduyla yapılır (bölüm 4.4). Tek istisna: kök dışı fs isteği zaten reddedilir.

### 3.8 Süreç yaşam döngüsü, çökme, Windows

- **Spawn:** `Command::new(node_exe).arg(entry).args(extra)`, `stdin/stdout/stderr = piped`, `current_dir(workspace_root)`, `creation_flags(CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP)`. Env: kullanıcının env'i (Claude için API anahtarı temizliği, bölüm 1.4), `CLAUDE_AGENT_ACP_PROTOCOL=v1`. Log klasörü env'leri (`CLAUDE_AGENT_LOGS`, `APP_SERVER_LOGS`) yalnızca "Hata ayıklama günlüğü" ayarı açıkken verilir.
- **Job Object:** süreç oluşturulur oluşturulmaz `AssignProcessToJobObject` çağrılır ve `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` ayarlanır. Böylece node'un çocukları (Claude native CLI, `codex.exe` app-server) Xora çökse bile ölür. Windows'ta yalnızca node'u öldürmek torunları öldürmez.
- **stderr:** satır satır ring buffer'a yazılır (son 200 satır). Çökme kartında "Ayrıntılar" altında gösterilir. Token içeriği gelirse diye ekrana basmadan önce `sk-`, `Bearer ` gibi kalıplar maskelenir.
- **Kapanış:** `session/close` (destekleniyorsa), sonra stdin kapatılır, 2 s beklenir, sonra Job kapatılır (kill). `src/app/closeGuards.ts`'e frontend'den `agents_shutdown` guard'ı eklenir (3 s timeout zaten var).
- **Çökme:** reader EOF verir ya da süreç `exit` olur. O zaman bütün pending istekler hata ile kapanır, oturumlar `crashed` işaretlenir ve `AgentEvent::AgentStatus { status: Crashed { code, stderrTail } }` yayılır. UI "Yeniden başlat" kartını gösterir. Yeniden başlatınca açık oturumlar `session/resume` (destekleniyorsa) ya da `session/load` ile geri getirilir.
- **Node bulma:** `where node` eşdeğeri (PATH + PATHEXT, yalnızca `.exe`), sonra `%ProgramFiles%\nodejs\node.exe`, `%LOCALAPPDATA%\Volta\bin` ve `%NVM_SYMLINK%`. `node --version` 3 s timeout ile çalıştırılır. Claude için `>=22` gerekir, yoksa "Node.js 22+ gerekli" kartı gösterilir. Paket S'in `accounts` modülündeki PATH arama yardımcısı yeniden kullanılır (S ile koordine edin).
- **Neden npx yok:** (1) Rust 1.77+ `.cmd`/`.bat` dosyalarını `Command::new("npx")` ile bulmaz ve batch argümanlarını kısıtlı escape eder (CVE-2024-24576). (2) Her açılışta registry'ye gider ve yavaş başlar. (3) Sürüm sabitleme ve offline çalışma zorlaşır. Yönetilen kurulum yalnızca ilk sefer ya da sürüm yükseltmede ağa çıkar.
- **Yerel oturum indeksi** (`index.rs`): `app_data/agents/sessions.json` → `[{ agentId, sessionId, cwd, title, createdAt, updatedAt, lastModel? }]`. `session/new`, `session_info_update` ve tur sonu ile güncellenir. Claude ve Codex için `session/list` sonucu indeksle birleştirilir (agent'ın listesi önceliklidir, örneğin CLI'dan açılmış oturumlar da görünür). Gemini için tek kaynak indekstir.

---

## 4. Frontend tasarımı (sohbet)

### 4.1 Dosya yapısı

```
src/features/agents/         (state + protokol, UI yok)
  types.ts                   paylaşılan kontrat (bölüm 5.1, birebir)
  ipc.ts                     invoke + Channel sarmalayıcıları
  controls.ts (+ .test.ts)   configOptions/modes/models -> SessionControls (bölüm 4.4)
  reducer.ts (+ .test.ts)    AgentEvent -> SessionView (saf, test edilir)
  store.ts (+ .test.ts)      Zustand: sessions, activeSessionId, agents, pending permissions; rAF ile toplu güncelleme
  useAgentEvents.ts          tek global Channel aboneliği (App mount)
  defaults.ts (+ .test.ts)   Ayarlardan (paket S) varsayılan mod/effort eşlemesi
src/features/chat/           (UI)
  ChatPanel.tsx              (mevcut: boş durumda ChatWelcome, aksi halde MessageList)
  MessageList.tsx            sanal olmayan liste + "en alta yapış" (kullanıcı yukarı kaydırınca bırakır)
  Markdown.tsx, markdown.ts  akış markdown'ı (bölüm 4.2)
  ThinkingBlock.tsx          katlanır "Düşünüyor…" bloğu
  ToolCallCard.tsx           kind ikonu, başlık, durum, içerik (diff/terminal/metin), konumlar
  DiffPreview.tsx            satır içi unified diff (küçük) + "Editörde aç" (Monaco diff)
  PlanView.tsx               plan girdileri (checklist)
  PermissionPrompt.tsx       satır içi onay kartı
  Composer.tsx               (mevcut) + ComposerToolbar
  ComposerToolbar.tsx        Agent / Model / Mod / Effort seçicileri + bağlam göstergesi
  SlashPopover.tsx           "/" ile açılan komut listesi
  SessionHistory.tsx         oturum geçmişi kenar çubuğu/popover
  AgentStatusCard.tsx        kurulu değil / giriş gerekli / çöktü kartları
```

### 4.2 Mesajlar ve akış

- **Reducer modeli** (`SessionView`): `items: Array<UserMsg | AgentMsg | Thought | ToolCall | PlanSnapshot | Notice>`. Ardışık `agent_message_chunk`'lar son `AgentMsg`'ye eklenir. Araya tool call girerse yeni `AgentMsg` başlar. `tool_call_update` id ile bulunup birleştirilir (`content` gelirse değiştirilir). `plan` tekil tutulur ve son plan gösterilir.
- **Performans:** Channel olayları bir kuyruğa yazılır ve `requestAnimationFrame` başına bir `set()` ile uygulanır. Böylece yüzlerce chunk tek render olur.
- **Akış markdown'ı:** `marked@18` (MIT) + `dompurify@3`. Yeni bağımlılık, Faz 2 brief'inde onaylanmalı. Metin blok sınırlarından (çift satır sonu, kapanmış code fence) bölünür. Tamamlanmış bloklar `memo` ile sabitlenir, yalnızca son blok yeniden parse edilir. Kapanmamış ` ``` ` geçici olarak kapatılır. Kod blokları Monaco'nun `monaco.editor.colorize()` fonksiyonuyla lazy renklendirilir (ek highlighter yok, Monaco zaten bundle'da). Linkler `@tauri-apps/plugin-opener` ile açılır. Ham HTML devre dışıdır.
- **Thinking:** `agent_thought_chunk` akarken başlıkta "Düşünüyor…" yazar ve hafif shimmer gösterilir (reduced-motion'da yok). Bitince "Düşündü · 12 sn" yazar ve blok katlanır. İçerik monospace değil, ikincil renkte gösterilir.
- **Tool kartları:** tek satırlık başlık (kind ikonu + `title` + durum noktası) gösterilir ve tıklanınca açılır. `edit` kind'ında diff otomatik açık gelir. `execute` kind'ında terminal çıktısı ilk 12 satırla gösterilir ve "Tümü" ile genişler. `failed` durumunda kenarlık `border-strong` olur ve hata metni gösterilir. `locations[0]` tıklanınca dosya editörde satırına açılır (editor store API'si, paket Q/editör sahibiyle).
- **Durdur butonu:** tur sürerken gönder butonu kare "Durdur" (Esc) butonuna döner ve `agent_cancel` çağırır. Durum "Durduruluyor…" olur, `TurnEnded{cancelled}` gelince biter.
- **Hata/çökme kartı:** `AgentStatusCard` ile "Yeniden başlat" ve "Ayrıntılar" (stderr kuyruğu) gösterilir.

### 4.3 Diff önizleme, kabul ve ret

ACP'de "düzenlemeyi sonradan kabul/ret" metodu yoktur. Düzenleme ya izinle olur ya da mod gereği otomatik uygulanır. Xora iki katman sunar:
1. **Öncesi (izin):** `PermissionPrompt`, izin isteğindeki `toolCall.content[type=diff]`'i `DiffPreview` ile gösterir. Seçenekler agent'ın `options`'ından gelir (ör. "İzin ver", "Her zaman izin ver", "Reddet"). Klavye kısayolları: Enter ilk allow, Esc reject_once.
2. **Sonrası (inceleme):** Her tur sonunda o turda değişen dosyalar listelenir. Kaynaklar: `review.rs` snapshot'ları (fs_bridge yazmaları) ve diff içerikleri (agent kendi yazdıysa, ör. Codex/Claude. Burada `oldText` diff içeriğinden alınır). Liste "Değişiklikler (3)" çubuğunda gösterilir.
   - "Kabul et" listeyi temizler.
   - "Geri al" dosyanın diskteki içeriği hâlâ `newText` ise `oldText`'i yazar (yeni dosyada siler, onaylı). Değilse "dosya sonra değişti" uyarısı verir ve Monaco diff'i açar.
   - Komut: `agent_review_revert(sessionId, path)`.

### 4.4 Seçiciler: model, mod, effort (üç agent için somut)

**Birleştirme kuralı (`controls.ts`, saf ve test edilir):**

```ts
export interface SelectControl {
  key: string;                       // configId ya da "legacy-mode"/"legacy-model"
  via: "config" | "mode" | "model";  // hangi RPC ile set edilir
  label: string;
  current: string;
  options: { value: string; name: string; description?: string; group?: string }[];
}
export interface ToggleControl { key: string; via: "config"; label: string; current: boolean; boolean: boolean; }
export interface SessionControls {
  model?: SelectControl;   // category "model"
  mode?: SelectControl;    // category "mode"
  effort?: SelectControl;  // category "thought_level"
  extra: (SelectControl | ToggleControl)[]; // "model_config", "_*", bilinmeyen kategoriler (array sırası korunur)
}
```
1. `configOptions` varsa: kategoriye göre dağıtılır. `modes` **yok sayılır** (spec: "Clients that support config options should use configOptions and ignore modes"). Set işlemi `session/set_config_option {configId, value}` ile yapılır. Yanıttaki **tam liste** state'i değiştirir, çünkü model değişince effort seçenekleri de değişir.
2. `configOptions` yoksa: `modes` → `mode` (via `"mode"`, `session/set_mode`), Gemini'nin `models` alanı → `model` (via `"model"`, `session/set_model`). Effort yok.
3. `current_mode_update` ve `config_option_update` bildirimleri state'i günceller.
4. Grup içeren select seçenekleri (`{group, name, options}`) düz listeye `group` alanıyla açılır. Popover grup başlığı gösterir.

**Agent bazında ne geliyor (kaynak koddan):**

| | Model | Mod | Effort / thinking | Diğer |
|---|---|---|---|---|
| **Claude** 0.95.0 | config `id:"model"`, category `model`. Değerler SDK `supportedModels`'tan, ilk satır `default` ("Default", açıklamada çözülen model) **[doğrulanmadı: kesin model listesi hesaba göre değişir]** | config `id:"mode"`, category `mode`: `default` ("Manual"), `acceptEdits`, `plan`, `auto` (model desteklemiyorsa adapter `acceptEdits`'e düşüp notice verir), `bypassPermissions` (yalnızca izinliyse). Ayrıca eski `modes` alanı da gelir | config `id:"effort"`, category `thought_level`, adı "Effort". **Yalnızca seçili model `supportsEffort` ise** gelir. Değerler `default` + modelin `supportedEffortLevels`'ı (ör. `low`, `medium`, `high`, `xhigh`, `max` **[doğrulanmadı: model başına liste]**). Model değişince seçenekler değişir | |
| **Codex** 2.2.2 | config `id:"model"`, category `model` (Codex App Server model listesi) | config `id:"mode"`: `read-only`, `workspace-write` ("Workspace access"), `agent` ("Auto review", **varsayılan**), `agent-full-access` ("Full access") | config `id:"reasoning_effort"`, category `thought_level`, değerler modelin `supportedReasoningEfforts`'ı (ör. `low`/`medium`/`high`/`xhigh` **[doğrulanmadı]**) | `fast-mode` (category `model_config`, boolean ya da Off/On select), `collaboration_mode` (Default / Plan, custom category) → `extra` |
| **Gemini** 0.65.0 | **eski** `models: {availableModels:[{modelId,name,description}], currentModelId}` (kararsız alan). `auto` alias + Pro/Flash/Flash-Lite (+ erişim varsa preview). Set: `session/set_model {sessionId, modelId}` | eski `modes`: `default`, `autoEdit`, `yolo`, `plan` (plan yalnızca etkinse). Set: `session/set_mode` | **ACP üzerinden yok.** Seçici gizlenir. (Gemini'nin thinking ayarı `~/.gemini/settings.json` model config'inde. Faz 2 kapsamı dışı **[doğrulanmadı]**) | |

**Paket S ayarlarından varsayılanlar** (`defaults.ts`). Oturum açılınca bir kez uygulanır. Kullanıcı seçici ile değiştirirse oturum içinde kalıcıdır. Son seçilen model ise agent başına hatırlanır.

| Ayar: onay politikası | Claude mode | Codex mode | Gemini mode |
|---|---|---|---|
| Her şeyi sor | `default` | `read-only` | `default` |
| Dosya düzenlemelerini otomatik onayla | `acceptEdits` | `workspace-write` | `autoEdit` |
| Tam otomatik | `bypassPermissions` (yoksa `auto`) | `agent-full-access` | `yolo` |

| Ayar: effort | Eşleme |
|---|---|
| Düşük / Orta / Yüksek | `effort` kontrolü varsa ve değerler arasında `low`/`medium`/`high` bulunuyorsa o değer set edilir. Yoksa dokunulmaz. Gemini'de uygulanmaz ve ayar satırında "Bu agent desteklemiyor" yazar |

"Tam otomatik" seçilince ilk kullanımda bir kez onay modali gösterilir (paket Q'nun `confirmDialog`'u).

**Composer toolbar düzeni (onyx):** solda `[● Claude ▾] [Sonnet ▾] [Manual ▾] [Effort: Orta ▾]`, sağda bağlam halkası (`usage_update.used/size`) ve gönder/durdur butonu. Seçiciler küçük metin chip'leridir: 1px kenarlık, popover palette yüzeyini kullanır. Agent seçici oturum başlamadan önce değiştirilebilir. Tur ortasında değiştirmek yeni oturum açar (onaylı). Modelden bağımsız seçici yoksa chip hiç gösterilmez. Devre dışı chip gösterilmez.

### 4.5 Slash popover

Composer'da satır başında `/` yazılınca açılır. Kaynak `available_commands_update` (oturuma özel) ve Xora komutlarıdır. Paket F'nin `fuzzy.ts`'i yeniden kullanılır. ↑/↓/Enter/Tab ile seçilir, Esc ile kapanır. Komutun `input.hint`'i varsa seçimden sonra placeholder olarak gösterilir. Gönderim düz metindir (bölüm 2.7).

### 4.6 Oturum geçmişi

TopBar'da ya da sohbet başlığında "Geçmiş" popover'ı açılır. Kaynak `agent_sessions_list(agentId, cwd)` (agent `session/list` + yerel indeks). Satırda başlık, göreli zaman (inbox'taki `relativeTime.ts`) ve agent ikonu bulunur. Seçince `agent_session_load` çağrılır. Replay olayları normal reducer'dan geçer (`user_message_chunk` dahil), bitince yükleme göstergesi kapanır. Yalnızca açık workspace'in (`cwd`) oturumları listelenir.

### 4.7 Erişilebilirlik ve hareket

Mesaj listesi `role="log"` ve `aria-live="polite"` taşır. Live region chunk başına değil, yalnızca tur bitince güncellenir. İzin kartı `role="alertdialog"` taşır ve odak yakalar. Bütün animasyonlar CSS'tedir ve `prefers-reduced-motion`'a uyar.

---

## 5. Paylaşılan arayüzler (paralel çalışmanın kontratı)

### 5.1 Olay kontratı

**Rust (`src-tauri/src/agents/events.rs`):**
```rust
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Copy, Serialize, serde::Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum AgentId { Claude, Codex, Gemini }

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "state", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum AgentStatus {
    NotInstalled { reason: String },          // "node-missing" | "node-too-old" | "package-missing"
    Installing { progress: Option<f32> },
    Starting,
    Ready { agent_info: Value, capabilities: Value, auth_methods: Value },
    AuthRequired { auth_methods: Value },
    Crashed { code: Option<i32>, stderr_tail: Vec<String> },
    Stopped,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum AgentEvent {
    AgentStatus { agent_id: AgentId, status: AgentStatus },
    /// Raw ACP `SessionUpdate` object (has `sessionUpdate` discriminator); passed through unmodified.
    SessionUpdate { session_id: String, update: Value },
    PermissionRequested { request_id: String, session_id: String, tool_call: Value, options: Value },
    PermissionResolved { request_id: String, option_id: Option<String> },
    TurnEnded { session_id: String, stop_reason: String },   // end_turn | max_tokens | max_turn_requests | refusal | cancelled
    TurnFailed { session_id: String, message: String, code: Option<i32> },
    FileWritten { session_id: String, path: String },
    TerminalOutput { session_id: String, terminal_id: String, chunk: String },
    TerminalExited { session_id: String, terminal_id: String, exit_code: Option<i32>, signal: Option<String> },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSetup {
    pub session_id: String,
    pub agent_id: AgentId,
    pub modes: Option<Value>,          // ACP SessionModeState
    pub config_options: Option<Value>, // ACP SessionConfigOption[]
    pub models: Option<Value>,         // legacy unstable (Gemini): { availableModels, currentModelId }
    pub agent_capabilities: Value,
}
```

**TypeScript (`src/features/agents/types.ts`):**
```ts
export type AgentId = "claude" | "codex" | "gemini";

export type AgentStatus =
  | { state: "notInstalled"; reason: "node-missing" | "node-too-old" | "package-missing" }
  | { state: "installing"; progress: number | null }
  | { state: "starting" }
  | { state: "ready"; agentInfo: AcpImplementation | null; capabilities: AcpAgentCapabilities; authMethods: AcpAuthMethod[] }
  | { state: "authRequired"; authMethods: AcpAuthMethod[] }
  | { state: "crashed"; code: number | null; stderrTail: string[] }
  | { state: "stopped" };

export type AgentEvent =
  | { type: "agentStatus"; agentId: AgentId; status: AgentStatus }
  | { type: "sessionUpdate"; sessionId: string; update: AcpSessionUpdate }
  | { type: "permissionRequested"; requestId: string; sessionId: string; toolCall: AcpToolCallUpdate; options: AcpPermissionOption[] }
  | { type: "permissionResolved"; requestId: string; optionId: string | null }
  | { type: "turnEnded"; sessionId: string; stopReason: AcpStopReason }
  | { type: "turnFailed"; sessionId: string; message: string; code: number | null }
  | { type: "fileWritten"; sessionId: string; path: string }
  | { type: "terminalOutput"; sessionId: string; terminalId: string; chunk: string }
  | { type: "terminalExited"; sessionId: string; terminalId: string; exitCode: number | null; signal: string | null };

export interface SessionSetup {
  sessionId: string;
  agentId: AgentId;
  modes: AcpSessionModeState | null;
  configOptions: AcpConfigOption[] | null;
  models: { availableModels: { modelId: string; name: string; description?: string | null }[]; currentModelId: string } | null;
  agentCapabilities: AcpAgentCapabilities;
}

// --- ACP v1 subset (schema-v1.26.0), hand-written; unknown fields tolerated ---
export type AcpStopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
export type AcpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource_link"; uri: string; name: string; mimeType?: string | null }
  | { type: "resource"; resource: { uri: string; text?: string; mimeType?: string | null } };
export type AcpToolKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "switch_mode" | "other";
export type AcpToolStatus = "pending" | "in_progress" | "completed" | "failed";
export type AcpToolContent =
  | { type: "content"; content: AcpContentBlock }
  | { type: "diff"; path: string; oldText?: string | null; newText: string }
  | { type: "terminal"; terminalId: string };
export interface AcpToolCall {
  toolCallId: string; title: string; name?: string | null; kind?: AcpToolKind; status?: AcpToolStatus;
  content?: AcpToolContent[]; locations?: { path: string; line?: number | null }[]; rawInput?: unknown; rawOutput?: unknown;
}
export type AcpToolCallUpdate = Partial<Omit<AcpToolCall, "toolCallId">> & { toolCallId: string };
export interface AcpPlanEntry { content: string; priority: "high" | "medium" | "low"; status: "pending" | "in_progress" | "completed" }
export interface AcpCommand { name: string; description: string; input?: { hint: string } | null }
export interface AcpSelectOption { value: string; name: string; description?: string | null }
export interface AcpSelectGroup { group: string; name: string; options: AcpSelectOption[] }
export type AcpConfigOption = {
  id: string; name: string; description?: string | null;
  category?: "mode" | "model" | "model_config" | "thought_level" | (string & {}) | null;
} & (
  | { type: "select"; currentValue: string; options: AcpSelectOption[] | AcpSelectGroup[] }
  | { type: "boolean"; currentValue: boolean }
);
export interface AcpSessionModeState { currentModeId: string; availableModes: { id: string; name: string; description?: string | null }[] }
export type AcpSessionUpdate =
  | { sessionUpdate: "user_message_chunk" | "agent_message_chunk" | "agent_thought_chunk"; content: AcpContentBlock }
  | ({ sessionUpdate: "tool_call" } & AcpToolCall)
  | ({ sessionUpdate: "tool_call_update" } & AcpToolCallUpdate)
  | { sessionUpdate: "plan"; entries: AcpPlanEntry[] }
  | { sessionUpdate: "available_commands_update"; availableCommands: AcpCommand[] }
  | { sessionUpdate: "current_mode_update"; currentModeId: string }
  | { sessionUpdate: "config_option_update"; configOptions: AcpConfigOption[] }
  | { sessionUpdate: "session_info_update"; title?: string | null; updatedAt?: string | null }
  | { sessionUpdate: "usage_update"; used: number; size: number; cost?: { amount: number; currency: string } | null }
  | { sessionUpdate: "notice"; severity: string; title: string }
  | { sessionUpdate: string; [k: string]: unknown }; // unknown kinds: ignored by the reducer
export interface AcpPermissionOption { optionId: string; name: string; kind: "allow_once" | "allow_always" | "reject_once" | "reject_always" }
export interface AcpAuthMethod { id: string; name: string; description?: string | null; type?: "agent" | "terminal"; args?: string[]; env?: Record<string, string> }
export interface AcpImplementation { name: string; title?: string | null; version: string }
export interface AcpAgentCapabilities {
  loadSession?: boolean;
  promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
  sessionCapabilities?: { list?: object | null; resume?: object | null; close?: object | null; delete?: object | null };
}
export interface AgentSessionInfo { agentId: AgentId; sessionId: string; cwd: string; title: string | null; updatedAt: string | null }
export interface AgentInfo { id: AgentId; displayName: string; version: string; status: AgentStatus }
```

### 5.2 Tauri komutları (Rust adı → `ipc` adı)

| Komut | İmza | Not |
|---|---|---|
| `agents_subscribe` | `(onEvent: Channel<AgentEvent>) -> ()` | Uygulama açılışında bir kez. Yeniden çağrılırsa eski kanal değiştirilir |
| `agents_list` | `() -> AgentInfo[]` | registry + kurulum + node durumu |
| `agent_install` | `(agentId) -> ()` | İlerleme `agentStatus` ile gelir |
| `agent_authenticate` | `(agentId, methodId) -> ()` | agent tipi metotlar |
| `agent_auth_terminal` | `(agentId, methodId) -> ()` | terminal tipi. Görünür konsolda adapter'ı `args` ile çalıştırır |
| `agent_session_new` | `(agentId, cwd) -> SessionSetup` | `-32000` → `AuthRequired` durumu + hata |
| `agent_session_load` | `(agentId, sessionId, cwd) -> SessionSetup` | Replay olayları yanıttan önce akar |
| `agent_session_resume` | `(agentId, sessionId, cwd) -> SessionSetup` | Desteklenmiyorsa hata. UI load'a düşer |
| `agent_session_close` | `(sessionId) -> ()` | |
| `agent_sessions_list` | `(agentId, cwd) -> AgentSessionInfo[]` | agent list + yerel indeks |
| `agent_prompt` | `(sessionId, blocks: AcpContentBlock[]) -> ()` | Hemen döner. Sonuç `turnEnded`/`turnFailed` ile gelir |
| `agent_cancel` | `(sessionId) -> ()` | Bekleyen izinleri de iptal eder |
| `agent_set_config_option` | `(sessionId, configId, value: string \| boolean) -> AcpConfigOption[]` | |
| `agent_set_mode` | `(sessionId, modeId) -> ()` | eski API |
| `agent_set_model` | `(sessionId, modelId) -> ()` | eski/kararsız `session/set_model` (Gemini) |
| `agent_permission_respond` | `(requestId, optionId: string \| null) -> ()` | |
| `agent_review_revert` | `(sessionId, path) -> "reverted" \| "conflict"` | |
| `agents_shutdown` | `() -> ()` | close guard |

Hata tipi mevcut `AppError` deseniyle string olarak serialize edilir. Ancak `-32000` için mesajın önüne `auth_required:` öneki konur. TS tarafı bunu `isAuthRequired(err)` ile ayırt eder.

### 5.3 Diğer paketlerle kontratlar

- **Paket S (Ayarlar):** okunan anahtarlar `agent.defaultAgent`, `agent.approvalPolicy` (`"ask" | "autoEdits" | "full"`), `agent.defaultEffort` (`"low" | "medium" | "high"`), yeni `agent.claudeIgnoreApiKey` (bool, varsayılan true), `agent.debugLogs` (bool). **[S'in gerçek anahtar adlarıyla teyit edilmeli]** Hesaplar kartındaki "Giriş yap" `agent_auth_terminal`/`agent_authenticate`'e bağlanır. Algılama yardımcıları (PATH, `.cmd` çözümü) `accounts` modülünden paylaşılır.
- **Paket T (Terminal):** `agent_auth_terminal` login'i bir Xora terminal sekmesinde açabilir (`term_spawn` + komut yazma). Faz 2'nin ilk sürümünde `cmd /c start` yeterli.
- **Paket Q (Editör/fs):** `fs://changed` watcher olayları agent yazmalarını yansıtır. Editör store'a `openDiff(path, oldText, newText)` ve `revealLocation(path, line)` eklenir (Q'nun sahipliğinde, küçük API).

---

## 6. Görev dağılımı (4 paralel implementer)

Sıra: **gün 0'da A, `events.rs` + `types.ts`'i bu dokümandan birebir commit eder** (30 dk). Sonra hepsi paralel çalışır. Her biri kendi worktree'sinde ve sık commit ile ilerler.

| Paket | Sahip olduğu dosyalar | Teslim | Bağımlılık / mock |
|---|---|---|---|
| **A: Rust ACP çekirdeği** | `agents/{mod,registry,install,process,transport,acp,session,commands,events,permissions,index}.rs`, `lib.rs`/`error.rs`/`Cargo.toml` eklemeleri | Spawn + Job Object, ndjson transport, initialize/new/load/resume/list/prompt/cancel/set_*; Channel olayları; broker; yönetilen kurulum | B'ye `ClientHandlers` trait'i. B gelene kadar `NullHandlers` (hepsi `-32601`). Testler: transport (id eşleme, satır bölme, `\r\n`, büyük satır), broker cancel, registry entry çözümü, indeks atomik yazma. Bir **sahte agent** (`tests/fixtures/fake_agent.mjs`: ndjson'da kayıtlı bir tur oynatır) ile entegrasyon testi |
| **B: Rust köprüleri** | `agents/{fs_bridge,terminal_bridge,review}.rs` | `ClientHandlers` impl, sandbox, atomik yazma, snapshot/revert, terminal halka buffer'ı | Yalnızca trait ve şema tipleri. Testler: `resolve_in_roots` (göreli, `..`, junction, büyük/küçük harf, var olmayan dosya), output limit kırpma (UTF-8 sınırı), revert conflict |
| **C: Frontend state** | `src/features/agents/*` (types, ipc, controls, reducer, store, defaults, useAgentEvents), `src/shared/lib/ipc.ts`'e ekleme yok (kendi ipc'si) | Reducer + controls + defaults + rAF batching | Fixture: üç agent için gerçekçi `SessionSetup` + olay dizileri `src/features/agents/fixtures.ts` (D de kullanır). Vitest: chunk birleştirme, tool update merge, content replace, config tam liste değişimi, Gemini legacy → controls, effort eşleme, unknown update yok sayma |
| **D: Sohbet UI** | `src/features/chat/*` (mevcut dosyalar dahil), yeni bağımlılıklar `marked`, `dompurify` | MessageList, Markdown, Thinking, ToolCallCard, DiffPreview, PlanView, PermissionPrompt, ComposerToolbar, SlashPopover, SessionHistory, AgentStatusCard | C'nin `types.ts` + `fixtures.ts`'i ile çalışır. Store hazır olana kadar fixture'ı doğrudan render eden bir `?fixture=` dev modu kullanır. Vitest: `markdown.ts` blok bölme/fence kapatma, slash filtreleme, diff satır hesaplama |

Entegrasyon (controller): A+B birleşir, sonra C+D birleşir, sonra uçtan uca senaryo çalıştırılır: "README'yi özetle", "X dosyasına fonksiyon ekle" (izin + diff + geri al), cancel, model/mod/effort değiştirme. Bu Claude, Codex, Gemini sırasıyla yapılır ve her biri için ekran görüntüsü alınır.

Kabul ölçütleri:
- İlk token gecikmesi adapter başlangıcı hariç ölçülür. Kurulu adapter için `node` spawn'dan `initialize` yanıtına kadar < 1.5 s hedeflenir **[doğrulanmadı]**.
- 1.000 chunk'lık akış 60 fps'te kalmalı. Reducer bir chunk'ı < 0.1 ms'de işlemeli.
- Xora kapanınca Görev Yöneticisi'nde `node.exe`/`claude.exe`/`codex.exe` kalmamalı.

---

## 7. Riskler ve açık kararlar

1. **Gemini'nin kararsız `session/set_model`'i** şemadan kaldırıldı ama Gemini hâlâ kullanıyor. Gemini `configOptions`'a geçince `controls.ts` otomatik olarak config yoluna geçer (öncelik orada). Ham çağrı yalnızca `models` alanı varken yapılır.
2. **Adapter sürüm hızı:** claude-agent-acp neredeyse günlük sürüm çıkarıyor (0.95.0, preview 0.95.1-preview.2). Pin + manuel yükseltme yapılır. Yükseltme kontrol listesi: initialize capability'leri, config id'leri (`model`/`mode`/`effort`/`reasoning_effort`), auth method id'leri.
3. **ACP v2 taslağı** var (`schema-v2.0.0-alpha.9`, Rust `unstable_protocol_v2`). Claude adapter v2 isteyene v2 veriyor. Biz `protocolVersion: 1` ve `CLAUDE_AGENT_ACP_PROTOCOL=v1` kullanıyoruz.
4. **Claude API anahtarı temizliği** bir ürün kararı (varsayılan açık öneriliyor). Kullanıcı bilerek API anahtarı kullanmak isterse ayarı kapatır. Not: Faz 2 kapsamında API key desteği yok, bu sadece istemeden fatura çıkmasını önler.
5. **Node.js bağımlılığı:** Claude adapter Node 22+ istiyor. Xora Node'u kendisi paketlemiyor (boyut). Faz 3'te opsiyonel "Node'u Xora kursun" eklenebilir.
6. **Lisans:** registry Claude kaydı için `license: "proprietary"` diyor (adapter Apache-2.0, ama bağımlı olduğu Claude Agent SDK "SEE LICENSE IN README"). Xora bunları **dağıtmaz**, kullanıcının makinesine npm ile kurar. MIT lisansı etkilenmez. Hakkında ekranında "üçüncü taraf agent'lar kendi lisanslarına tabidir" notu olmalı.
7. **Doğrulanmamış noktalar:** Claude/Codex model ve effort değer listeleri (hesaba ve modele göre değişir, UI dinamik olduğu için kritik değil), schema crate modül yolu, agent'ların `terminal/create` komut biçimi, Zed'in kirli buffer davranışı, Gemini thinking ayarı, Claude `_auth/status_update` payload'ı, başlangıç gecikmesi hedefi.

## 8. Kaynaklar (2026-10-25'te kontrol edildi)

- ACP overview / session config options: https://agentclientprotocol.com/protocol/overview, https://agentclientprotocol.com/protocol/session-config-options
- ACP şeması ve changelog: https://github.com/agentclientprotocol/agent-client-protocol/tree/main/schema/v1 (`meta.json`, `meta.unstable.json`, `schema.json`, `CHANGELOG.md`)
- ACP Registry: https://agentclientprotocol.com/get-started/registry, https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json
- Rust SDK: https://crates.io/crates/agent-client-protocol (3.5.0), https://docs.rs/agent-client-protocol/3.5.0, https://docs.rs/agent-client-protocol-schema/1.12.0, https://github.com/agentclientprotocol/rust-sdk (`examples/yolo_one_shot_client.rs`, `md/sending-requests.md`)
- Claude adapter: https://github.com/agentclientprotocol/claude-agent-acp (`src/acp-agent.ts`, `src/session-mode.ts`, `src/session-model.ts`, `src/session-effort.ts`, `src/index.ts`), npm `@agentclientprotocol/claude-agent-acp`
- Codex adapter: https://github.com/agentclientprotocol/codex-acp (README, `src/AgentMode.ts`, `src/ModelConfigOption.ts`, `src/FastModeConfig.ts`, `src/CollaborationModeConfig.ts`, `src/CodexAuthMethod.ts`, `src/CodexAcpServer.ts`), npm `@agentclientprotocol/codex-acp`
- Gemini CLI v0.65.0: https://github.com/google-gemini/gemini-cli (`packages/cli/src/config/config.ts`, `packages/cli/src/acp/*`, `packages/core/src/policy/types.ts`, `packages/core/src/core/contentGenerator.ts`)
- Claude Code auth: https://code.claude.com/docs/en/authentication
- npm registry: `@zed-industries/claude-code-acp`, `@zed-industries/claude-agent-acp`, `@zed-industries/codex-acp` (deprecated mesajları), `@anthropic-ai/claude-code`, `@openai/codex`, `@google/gemini-cli`, `marked`, `dompurify`

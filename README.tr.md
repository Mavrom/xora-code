# Xora Code

[English](README.md) · **Türkçe**

Açık kaynak, agent-first bir kod editörü. Kendi Claude, ChatGPT veya Gemini aboneliğini getir.

![Xora Code: dosya gezgini, sohbet alanı ve editör yan yana](docs/assets/screenshot.png)

Xora Code, pencerenin merkezine bir AI agent sohbetini koyar; bir yanda dosya gezgini, diğer yanda kod editörü durur. Agent'lar zaten kullandığın resmi CLI'lar (Claude Code, Codex, Gemini CLI) üzerinden, kendi aboneliğinle giriş yapılarak çalışacak. Xora Code'un kendi AI faturası yoktur ve API key istemez.

> **Durum:** Faz 1 (editör temeli) tamamlandı. Agent bağlantısı Faz 2'de geliyor; o zamana kadar sohbet paneli bir yer tutucu. İlk hedef Windows; kod çapraz platform kalacak şekilde yazılıyor. Arayüz metinleri şu an Türkçe.

## Özellikler

Bugün çalışanlar:

| Alan         | Ne sunuyor                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pencere      | Onyx / AMOLED siyahı arayüz, özel çerçevesiz başlık çubuğu (sürükleme, küçültme, büyütme, kapatma).                                                                                                                         |
| Yerleşim     | Boyutu ayarlanabilir üç panel: kenar çubuğu, sohbet, editör. Panel boyutları oturumlar arasında hatırlanır; editör paneli daraltılabilir.                                                                                   |
| Activity bar | Kenar çubuğunu **Explorer** ile **Inbox** arasında değiştirir. Son görünüm hatırlanır; Inbox simgesi açık not sayısını rozetle gösterir.                                                                                    |
| Explorer     | Lazy loading ile klasör ağacı (klasörler açıldıkça okunur), önce klasörler, `.git` gizli. Tam klavye gezintisi: roving tabindex, ok tuşları, Home/End, type-ahead.                                                          |
| Editör       | Monaco, yerel olarak paketlenmiş (çevrimdışı çalışır) ve yalnızca ilk dosya açıldığında lazy-load edilir. Özel `xora-onyx` teması, sekmeler, kaydedilmemiş değişiklik (dirty) takibi, kaydetme ve kapatma kısayolları.      |
| Inbox        | Hızlı not alma: ekleme, yerinde düzenleme, sabitleme, tamamlandı işaretleme, geri alınabilir silme. Rust `notes` modülü ile diske atomik olarak yazılır; debounce'lu kayıt, otomatik yeniden deneme ve kapanışta son flush. |
| Komut paleti | `Ctrl+K` veya `Ctrl+Shift+P`. Türkçe karakterleri tanıyan fuzzy arama (`klasor ac`, `Klasör aç`'ı bulur), gruplanmış komutlar, kısayol ipuçları.                                                                            |
| Sohbet       | Faz 2 agent bağlantısına hazır sohbet alanı ve mesaj kutusu.                                                                                                                                                                |

## Klavye kısayolları

macOS'ta palet, kaydetme, sekme kapatma ve geri alma için `Ctrl` yerine `Cmd` de çalışır.

### Genel

| Kısayol                   | İşlem                                  |
| ------------------------- | -------------------------------------- |
| `Ctrl+K` / `Ctrl+Shift+P` | Komut paletini aç/kapat                |
| `Ctrl+Shift+E`            | Explorer'ı göster                      |
| `Ctrl+Shift+N`            | Inbox'ı göster ve not kutusuna odaklan |
| `Ctrl+S`                  | Aktif dosyayı kaydet                   |
| `Ctrl+W`                  | Aktif sekmeyi kapat                    |

### Komut paleti

| Kısayol   | İşlem                 |
| --------- | --------------------- |
| `↑` / `↓` | Seçimi taşı           |
| `Enter`   | Seçili öğeyi çalıştır |
| `Esc`     | Paleti kapat          |

### Explorer

| Kısayol           | İşlem                                                |
| ----------------- | ---------------------------------------------------- |
| `↑` / `↓`         | Önceki / sonraki öğe                                 |
| `→`               | Klasörü aç veya ilk alt öğesine geç                  |
| `←`               | Klasörü kapat veya üst klasöre geç                   |
| `Home` / `End`    | İlk / son öğe                                        |
| `Enter` / `Space` | Dosyayı aç veya klasörü aç/kapat                     |
| Harfler           | Type-ahead: bu harflerle başlayan sonraki öğeye atla |

### Editör sekmeleri

| Kısayol        | İşlem                  |
| -------------- | ---------------------- |
| `←` / `→`      | Önceki / sonraki sekme |
| `Home` / `End` | İlk / son sekme        |
| `Delete`       | Odaktaki sekmeyi kapat |

### Inbox

| Kısayol         | Nerede                 | İşlem                        |
| --------------- | ---------------------- | ---------------------------- |
| `Enter`         | Not kutusu             | Notu ekle                    |
| `Shift+Enter`   | Not kutusu / düzenleme | Yeni satır                   |
| `Esc`           | Not kutusu             | Not kutusundan çık           |
| `↑` / `↓`       | Not listesi            | Önceki / sonraki not         |
| `Enter`         | Odaktaki not           | Yerinde düzenle              |
| `P`             | Odaktaki not           | Sabitle / sabitlemeyi kaldır |
| `E`             | Odaktaki not           | Tamamlandı / yeniden aç      |
| `Delete`        | Odaktaki not           | Sil                          |
| `Ctrl+Z`        | Inbox paneli           | Son silmeyi geri al          |
| `Enter` / `Esc` | Yerinde düzenleme      | Kaydet / vazgeç              |

## Yol haritası

Temel fikir **kendi aboneliğini getir**: Xora Code resmi agent CLI'larıyla [Agent Client Protocol (ACP)](https://agentclientprotocol.com/) üzerinden konuşur ve giriş her CLI'ın kendi login akışıyla yapılır. API key desteği şimdilik kapsam dışı.

| Faz | Kapsam                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Tamamlandı.** Editör temeli: yerleşim, tema, Explorer, Monaco, Inbox, komut paleti.                                                                                                                                 |
| 2   | Claude Code, Codex ve Gemini CLI için kendi aboneliğinle ACP agent bağlantısı. Streaming sohbet, izin onayları, agent değişikliklerinin diff review'u, dosya watcher, dosya sistemi komutları için workspace sandbox. |
| 3   | Hesaplar ekranı: sağlayıcı bazında durum, giriş ve CLI kurulu değilse kurulum yönlendirmesi.                                                                                                                          |
| 4   | Entegre terminal, proje bazlı oturum geçmişi, ayarlar, Windows installer.                                                                                                                                             |

## Teknoloji

| Katman   | Seçim                                                             |
| -------- | ----------------------------------------------------------------- |
| Kabuk    | [Tauri 2](https://v2.tauri.app/) (Rust çekirdek, sistem WebView)  |
| Arayüz   | React 19, TypeScript, Vite                                        |
| Stil     | Tailwind CSS v4, design token'lar `src/styles/globals.css` içinde |
| State    | Zustand                                                           |
| Editör   | Monaco (`monaco-editor` + `@monaco-editor/react`)                 |
| Yerleşim | `react-resizable-panels`                                          |
| İkonlar  | Lucide                                                            |
| Test     | Vitest (frontend), `cargo test` (Rust)                            |

## Başlarken

### Önkoşullar

- [Node.js](https://nodejs.org/) 24 veya üzeri
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- İşletim sistemin için Tauri önkoşulları (Windows'ta Microsoft C++ Build Tools ve WebView2): [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/)

### Çalıştırma

```bash
npm install
npm run tauri dev
```

İlk çalıştırma Rust çekirdeğini derler ve birkaç dakika sürer; sonrakiler artımlıdır.

### Script'ler

| Komut                 | Ne yapar                                                |
| --------------------- | ------------------------------------------------------- |
| `npm run tauri dev`   | Masaüstü uygulamasını hot reload ile çalıştırır         |
| `npm run tauri build` | Release paketi üretir                                   |
| `npm run check`       | Typecheck, lint, format kontrolü ve testler (CI kapısı) |
| `npm test`            | Vitest test paketini çalıştırır                         |
| `npm run lint`        | ESLint'i çalıştırır                                     |
| `npm run format`      | Depoyu Prettier ile formatlar                           |
| `npm run typecheck`   | TypeScript derleyicisini çıktı üretmeden çalıştırır     |

Rust kontrolleri `src-tauri/Cargo.toml` üzerinden çalışır; bkz. [CONTRIBUTING.md](CONTRIBUTING.md).

## Proje yapısı

```
src/
  app/          Uygulama kabuğu: yerleşim, başlık çubuğu, activity bar, UI store
  features/     Her özellik için bir klasör (chat, commands, editor, files, inbox, workspace)
  shared/       Ortak kod: lib/ (typed IPC, path yardımcıları), ui/ (temel bileşenler)
  styles/       globals.css: design token'lar ve temel stiller
src-tauri/
  src/          Rust çekirdek: error.rs, fs/, notes/ (her modül: mod.rs + commands.rs)
docs/           Mimari notları ve tasarım spec'i
```

Süreç modeli, tam klasör haritası ve veri akışları için [docs/architecture.md](docs/architecture.md) dosyasına bak.

## Katkı

Katkılara açığız. Kurulum, kalite kapıları ve konvansiyonlar için [CONTRIBUTING.md](CONTRIBUTING.md) ile başla.

## Lisans

[MIT](LICENSE) © 2026 Xora Code contributors

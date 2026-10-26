# Xora Code

[English](README.md) · **Türkçe**

Açık kaynak, agent-first bir kod editörü. Kendi Claude, ChatGPT veya Gemini aboneliğini getir.

![Xora Code: dosya gezgini, sohbet alanı ve editör yan yana](docs/assets/screenshot.png)

Xora Code, pencerenin merkezine bir AI agent sohbetini koyar. Sohbetlerin solda durur, dosya gezgini ve editör gerektiğinde açılır, yeni sohbet kendi görselinin altında açılabilir; görsel dither, ASCII, halftone ya da tarama çizgisi efektiyle yeniden çizilir. Agent'lar zaten kullandığın CLI'ların (Claude Code, Codex, Gemini CLI) resmi adapter'ları üzerinden, kendi aboneliğinle giriş yapılarak çalışır. Xora Code'un kendi AI faturası yoktur ve API key istemez.

> **Durum:** Faz 1 ve 2 hazır: editör temeli, ACP üzerinden çalışan agent sohbeti, ayarlar ve hesaplar, entegre terminal. Windows'ta Claude Code ile uçtan uca doğrulandı. Gemini CLI bağlanıp girişe kadar geliyor, ama Google kişisel hesapla Gemini CLI girişini kapattı (artık Antigravity'ye yönlendiriyor), bu yüzden Gemini aboneliği bugün bu yolla kullanılamıyor. Codex kuruluyor, başlıyor ve ChatGPT girişine geliyor; tam bir tur için ChatGPT hesabı gerekiyor. İlk hedef Windows; kod çapraz platform kalacak şekilde yazılıyor. Arayüz metinleri Türkçe.

## Özellikler

Bugün çalışanlar:

| Alan           | Ne sunuyor                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent sohbeti  | Claude Code, Codex ve Gemini CLI, [Agent Client Protocol](https://agentclientprotocol.com/) üzerinden. Akan cevaplar, düşünme blokları, araç kartları, planlar, slash komutları, durdurma.                                                                                                                                                                                                                                                       |
| Model ve mod   | Model, mod ve effort seçicileri her agent'ın bildirdiklerinden dolar (Gemini ACP'de effort sunmadığı için orada gizlenir).                                                                                                                                                                                                                                                                                                                       |
| Model listesi  | Ayarlar > Agent, her ajanın sunduğu modelleri listeler; kullanmadıklarını kapatınca seçiciden kalkar.                                                                                                                                                                                                                                                                                                                                            |
| Saydam pencere | Ayarlar > Görünüm > Pencere: Buzlu (Windows Acrylic, arkadaki uygulamalar bulanık), Net ya da Opak; koyuluk ayarıyla.                                                                                                                                                                                                                                                                                                                            |
| Haber verme    | Xora arka plandayken ajan işini bitirince ya da onay isteyince görev çubuğunda yanıp söner (Ayarlar > Genel).                                                                                                                                                                                                                                                                                                                                    |
| Ekler          | Dosyalar, klasörler ve görseller (yapıştırılan ekran görüntüleri ve Gezgin'den sürüklenenler dahil; `@` ve dosya adı yazınca klasördeki dosya eklenir) yazı kutusunun üstünde kart olarak durur; görseller agent'a görsel olarak gider.                                                                                                                                                                                                          |
| Worktree       | Bir sohbeti `xora/<ad>` branch'indeki kendi git worktree'sinde çalıştır; işini kendi branch'ine al (sadece fast-forward) ya da çöpe at.                                                                                                                                                                                                                                                                                                          |
| İzinler        | Agent'ın düzenlemeleri ve komutları önce izin ister, diff önizlemesiyle. Değişiklikler çubuğu turda dokunulan dosyaları listeler; her biri kabul edilebilir ya da geri alınabilir.                                                                                                                                                                                                                                                               |
| Sandbox        | Agent'ın dosya ve terminal erişimi açık klasörle sınırlı (symlink, `..` ve junction'lar kontrolden önce çözülür).                                                                                                                                                                                                                                                                                                                                |
| Sohbetler      | Kenar çubuğunda güne göre gruplu, projeye göre süzülebilen sohbetler; agent'ın kendi geçmişiyle yeniden açılır (`session/load` / `resume`). Satırdan ya da sağ tık menüsünden arşivlenir veya silinir.                                                                                                                                                                                                                                           |
| Ayarlar        | Bütün ayarlarda arama; varsayılandan farklı her ayarın yanında sıfırlama. Hesaplar, agent varsayılanları ve görünen modeller, genel (gönderme tuşu, sohbet yazı boyutu, bildirim), görünüm (saydam pencere, `Ctrl +`/`Ctrl -`/`Ctrl 0` ile arayüz ölçeği, görsel), editör (otomatik kaydetme, satır numaraları, imleç, yapışkan kaydırma, parantez renkleri…), terminal (kabuk, yazı boyutu), kısayollar, hakkında. `Ctrl+,`.                    |
| Görünüm        | Onyx / AMOLED siyahı, çerçevesiz pencere. Yeni sohbet için isteğe bağlı görsel; dither, ASCII, halftone ya da tarama efekti ve ayarlanabilir karartma.                                                                                                                                                                                                                                                                                           |
| Terminal       | Sohbet ve editörün altında PowerShell / kabuk sekmeleri (``Ctrl+` ``).                                                                                                                                                                                                                                                                                                                                                                           |
| Yerleşim       | Sohbet önce: editör bir dosya açılana kadar kapalı kalır. Boyutu ayarlanabilir paneller, boyutlar oturumlar arasında hatırlanır.                                                                                                                                                                                                                                                                                                                 |
| Kenar çubuğu   | Yeni sohbet (`Ctrl+N`), arama ve **Sohbetler**, **Inbox** (açık not sayısıyla); altta bu bilgisayar ve agent durumunu gösteren bir kart.                                                                                                                                                                                                                                                                                                         |
| Dosyalar       | Kenar çubuğunun yanında, fare kenarına gelince açılıp ayrılınca kapanan bir çekmece; başlık çubuğundaki düğme ya da `Ctrl+Shift+E` ile sabitlenir. Birden çok klasör ağacın üstünde yan yana sekme olarak açılır (+ yenisini ekler). Sanallaştırılmış klasör ağacı; dosya izleyiciyle canlı yenilenir, son açılan klasörler listelenir, açılışta son klasör geri gelir. Tam klavye gezintisi: roving tabindex, ok tuşları, Home/End, type-ahead. |
| Editör         | Monaco, yerel olarak paketlenmiş (çevrimdışı çalışır) ve yalnızca ilk dosya açıldığında lazy-load edilir. Özel `xora-onyx` teması, sekmeler, kaydedilmemiş değişiklik (dirty) takibi, kaydetme ve kapatma kısayolları.                                                                                                                                                                                                                           |
| Inbox          | Hızlı not alma: ekleme, yerinde düzenleme, sabitleme, tamamlandı işaretleme, geri alınabilir silme. Rust `notes` modülü ile diske atomik olarak yazılır; debounce'lu kayıt, otomatik yeniden deneme ve kapanışta son flush.                                                                                                                                                                                                                      |
| Komut paleti   | `Ctrl+K` veya `Ctrl+Shift+P`. Açık klasörün sohbetlerine ve son klasörlere de atlar. Türkçe karakterleri tanıyan fuzzy arama (`klasor ac`, `Klasör aç`'ı bulur), gruplanmış komutlar, kısayol ipuçları.                                                                                                                                                                                                                                          |

## Klavye kısayolları

macOS'ta palet, kaydetme, sekme kapatma ve geri alma için `Ctrl` yerine `Cmd` de çalışır.

### Genel

| Kısayol                   | İşlem                                  |
| ------------------------- | -------------------------------------- |
| `Ctrl+K` / `Ctrl+Shift+P` | Komut paletini aç/kapat                |
| `Ctrl+P`                  | Klasördeki bir dosyaya adıyla git      |
| `Ctrl+N`                  | Yeni sohbet                            |
| `Ctrl+L` (editör)         | Seçimi yeriyle birlikte sohbete gönder |
| `Ctrl+B`                  | Kenar çubuğunu göster/gizle            |
| `Ctrl+Shift+H`            | Sohbetleri göster                      |
| `Ctrl+Shift+E`            | Dosya çekmecesini sabitle/bırak        |
| `Ctrl+Shift+N`            | Inbox'ı göster ve not kutusuna odaklan |
| `Ctrl+S`                  | Aktif dosyayı kaydet                   |
| `Ctrl+W`                  | Aktif sekmeyi kapat                    |
| `Ctrl+,`                  | Ayarları aç/kapat                      |
| ``Ctrl+` ``               | Terminali aç/kapat                     |

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
| `G`             | Odaktaki not           | Sohbete gönder               |
| `Delete`        | Odaktaki not           | Sil                          |
| `Ctrl+Z`        | Inbox paneli           | Son silmeyi geri al          |
| `Enter` / `Esc` | Yerinde düzenleme      | Kaydet / vazgeç              |

## Yol haritası

Temel fikir **kendi aboneliğini getir**: Xora Code resmi agent CLI'larıyla [Agent Client Protocol (ACP)](https://agentclientprotocol.com/) üzerinden konuşur ve giriş her CLI'ın kendi login akışıyla yapılır. API key desteği şimdilik kapsam dışı.

| Faz      | Kapsam                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | **Tamamlandı.** Editör temeli: yerleşim, tema, Gezgin, Monaco, Inbox, komut paleti.                                                                        |
| 2        | **Tamamlandı.** Kendi aboneliğinle ACP agent bağlantısı: akan sohbet, izinler, diff incelemesi ve geri alma, sandbox, dosya izleyici.                      |
| 3        | **Tamamlandı.** Ayarlar ve hesaplar, yeni sohbet görseli ve efektleri, entegre terminal, sohbet geçmişi.                                                   |
| Sıradaki | Codex ve Gemini ile tam deneme, Windows kurulum paketi, Claude adapter'ı için isteğe bağlı yönetilen Node.js, sabitlenmiş adapter güncelleme bildirimleri. |

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

- [Node.js](https://nodejs.org/) 24 veya üzeri (agent adapter'ları çalışırken Node.js 22+ ister; Xora sabitlenmiş adapter sürümlerini ilk kullanımda kendisi kurar)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- İşletim sistemin için Tauri önkoşulları (Windows'ta Microsoft C++ Build Tools ve WebView2): [v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/)

### Çalıştırma

```bash
npm install
npm run tauri dev
```

İlk çalıştırma Rust çekirdeğini derler ve birkaç dakika sürer; sonrakiler artımlıdır.

Windows'ta Visual Studio Build Tools yok mu? `npm run tauri dev`, LLVM-MinGW kuruluysa ona otomatik geçer (`npm run dev:mingw` bunu zorlar): `rustup toolchain install stable-x86_64-pc-windows-gnullvm` ile kur, [llvm-mingw sürümlerinden](https://github.com/mstorsjo/llvm-mingw/releases) bir `*-ucrt-x86_64.zip` dosyasını `%LOCALAPPDATA%\xora-toolchain` içine aç (ya da `XORA_LLVM_MINGW` ayarla), sonra çalıştır.

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
  features/     Her özellik için bir klasör (agents, chat, commands, editor, files, inbox, settings, terminal, workspace)
  shared/       Ortak kod: lib/ (typed IPC, path yardımcıları), ui/ (temel bileşenler)
  styles/       globals.css: design token'lar ve temel stiller
src-tauri/
  src/          Rust çekirdek: agents/ (ACP), accounts/, fs/, notes/, settings/, terminal/ (her modül: mod.rs + commands.rs)
docs/           Mimari notları ve tasarım spec'i
```

Süreç modeli, tam klasör haritası ve veri akışları için [docs/architecture.md](docs/architecture.md) dosyasına bak.

## Katkı

Katkılara açığız. Kurulum, kalite kapıları ve konvansiyonlar için [CONTRIBUTING.md](CONTRIBUTING.md) ile başla.

## Lisans

[MIT](LICENSE) © 2026 Xora Code contributors

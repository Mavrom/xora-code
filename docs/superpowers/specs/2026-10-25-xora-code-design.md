# Xora Code: Tasarım ve Uygulama Planı

## Context
Hedef, Zed ve Mono Code tarzında, **agent-first** bir masaüstü kod uygulaması. Merkezde Claude Code benzeri bir AI sohbet/agent paneli olacak; yanında klasör ağacı ve VS Code tarzı bir editör yer alacak. Kullanıcılar kendi aboneliklerini (Claude, ChatGPT, Gemini) bağlayacak. Uygulamanın kendi AI faturası olmayacak. `C:\Users\Berk\Desktop\Xora Code` şu an boş, proje sıfırdan kuruluyor. İlk hedef Windows, ama kod çapraz platform yazılacak. **API key desteği kapsam dışı, ileride eklenebilir.**

## Temel kararlar
- **Shell:** Tauri 2 (Rust backend)
- **UI:** React + TypeScript + Vite, Tailwind, Zustand (state)
- **Editör:** Monaco (`@monaco-editor/react`): sekmeler ve AI değişiklikleri için diff görünümü
- **Terminal:** xterm.js + Rust tarafında `portable-pty`
- **Abonelik bağlama:** **Agent Client Protocol (ACP)**, yani Zed'in yöntemi. Rust, resmi CLI agent'larını alt süreç olarak başlatıyor ve stdio üzerinden JSON-RPC ile konuşuyor. Giriş işlemini kullanıcı CLI'ın kendi login akışıyla yapıyor, biz token taklit etmiyoruz. Bu yaklaşım ToS açısından güvenli.
  - Claude: `@zed-industries/claude-code-acp` adapter (Claude Code SDK)
  - ChatGPT: `@zed-industries/codex-acp` adapter (Codex CLI)
  - Gemini: `gemini --experimental-acp` (native destek)
  - Paket adları ve flag'ler uygulama sırasında npm/GitHub'dan doğrulanacak.
- `AgentBackend` trait'i soyut tutulacak. İleride API key ile çalışan yerleşik bir agent, UI'ya dokunmadan eklenebilecek.

## Mimari (birimler)
```
src-tauri/src/
  main.rs / lib.rs        Tauri setup, command kaydı
  fs/                     dosya ağacı, okuma/yazma, watcher (notify crate)
  terminal/               PTY oturumları
  agents/
    mod.rs                AgentBackend trait: start, prompt, cancel, events
    acp.rs                ACP client: alt süreç + JSON-RPC (agent-client-protocol crate)
    registry.rs           claude/codex/gemini tanımları, CLI var mı kontrolü, kurulum ipucu
  permissions.rs          dosya yazma / komut çalıştırma onay istekleri, UI'ya event
  settings.rs             ayarlar (JSON)
src/
  app/Layout.tsx          sol: dosya ağacı | orta: Agent sohbet (ana) | sağ/alt: editör + terminal (açılır-kapanır)
  features/chat/          mesajlar, streaming, tool-call kartları, onay butonları, agent/model seçici
  features/editor/        Monaco sekmeleri, diff review (AI değişikliğini kabul/ret)
  features/files/         dosya ağacı
  features/terminal/      xterm
  features/settings/      "Hesaplar" ekranı: her sağlayıcı için durum, Bağlan/Giriş yap
  lib/ipc.ts              typed Tauri invoke/event sarmalayıcıları
```
**Veri akışı:** UI `agent_prompt` gönderir. Rust tarafında ACP backend çalışır ve `agent://event` stream'i yayar (text delta, tool call, dosya diff, izin isteği). UI bunları render eder. İzin isteklerine kullanıcı onay/ret verir ve cevap Rust'a geri döner. Dosya değişiklikleri watcher üzerinden editöre ve ağaca yansır.

## Fazlar
1. **İskelet:** `npm create tauri-app` (React-TS), layout, tema (koyu), dosya ağacı ve Monaco ile dosya aç/kaydet. Git init, noreply e-posta config.
2. **ACP + Claude:** ACP client, Claude adapter, sohbet UI'sı, streaming, tool-call kartları, izin onayı, diff review.
3. **Codex + Gemini:** registry'ye eklenmesi, Hesaplar ekranı, CLI kurulu değilse kurulum yönlendirmesi ve giriş tetikleme.
4. **Terminal + cilalama:** xterm paneli, oturum geçmişi (proje bazlı), ayarlar, Windows installer (`tauri build`, NSIS).

## Hata yönetimi
- CLI bulunamadı: Hesaplar ekranında "Kurulu değil" bilgisi ve kurulum komutu gösterilir.
- Agent süreci çöktü: Sohbette hata kartı ve "Yeniden başlat" seçeneği çıkar. Süreç bitişleri izlenir.
- Auth hatası: ACP `authenticate` akışı tetiklenir ya da "Giriş yap" butonu gösterilir.
- Workspace dışına yazma ve tehlikeli komutlar her zaman onay gerektirir.

## Doğrulama
- `npm run tauri dev` ile uygulama açılır. Bir klasör seçilir, ağaç görünür, dosya Monaco'da açılıp kaydedilir.
- Claude agent seçilir. "Bu projedeki README'yi özetle" ve "X dosyasına fonksiyon ekle" komutları verilir. Streaming, tool kartları, izin onayı ve diff kabulü çalışmalı, dosya diskte değişmeli.
- Aynı senaryo Codex ve Gemini ile tekrarlanır.
- Rust tarafı: `cargo test` (ACP mesaj parse, registry, path sandbox). UI tarafı: Vitest (store ve event reducer'ları).
- Her fazın sonunda uygulama çalıştırılıp ekran görüntüsü alınarak kontrol edilir.

## Uygulama başlarken
Onaydan sonra bu tasarım `docs/superpowers/specs/2026-10-25-xora-code-design.md` olarak repoya yazılacak ve commit edilecek. Ardından Faz 1 için ayrıntılı implementasyon planı çıkarılacak.

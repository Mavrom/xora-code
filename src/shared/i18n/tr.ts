// Turkish for every interface message, keyed by its English text (see ./index.ts).
// Keep entries grouped by the file that first uses them.

export const TR: Record<string, string> = {
  // Same in both languages, listed so the catalog stays complete.
  Agent: "Agent",
  Checkout: "Checkout",
  Inbox: "Inbox",
  Minimal: "Minimal",
  Model: "Model",
  Plan: "Plan",
  Terminal: "Terminal",
  Xora: "Xora",
  // app/FilesDrawer.tsx
  "Show sidebar": "Kenar çubuğunu göster",
  Files: "Dosyalar",
  // app/Layout.tsx
  Sidebar: "Kenar çubuğu",
  "Resize sidebar": "Kenar çubuğunu yeniden boyutlandır",
  Chat: "Sohbet",
  "Resize editor": "Editörü yeniden boyutlandır",
  Editor: "Editör",
  Settings: "Ayarlar",
  // app/MainBar.tsx
  "New chat": "Yeni sohbet",
  "Hide editor": "Editörü gizle",
  "Show editor": "Editörü göster",
  "Unpin files (Ctrl+Shift+E)": "Dosyaları sabitlemeyi bırak (Ctrl+Shift+E)",
  "Pin files (Ctrl+Shift+E)": "Dosyaları sabitle (Ctrl+Shift+E)",
  "Chat options": "Sohbet seçenekleri",
  "Copy as Markdown": "Markdown olarak kopyala",
  "Export…": "Dışa aktar…",
  "Continue with {name}": "{name} ile devam et",
  // app/Sidebar.tsx
  "Hide sidebar": "Kenar çubuğunu gizle",
  Back: "Geri",
  Forward: "İleri",
  Search: "Ara",
  "Sidebar view": "Kenar çubuğu görünümü",
  Chats: "Sohbetler",
  "All projects": "Tüm projeler",
  Project: "Proje",
  Ready: "Hazır",
  "This computer": "Bu bilgisayar",
  Accounts: "Hesaplar",
  "Settings (Ctrl+,)": "Ayarlar (Ctrl+,)",
  // app/WindowControls.tsx
  Minimize: "Simge durumuna küçült",
  Restore: "Önceki boyuta getir",
  Maximize: "Ekranı kapla",
  Close: "Kapat",
  // features/agents/authMethods.ts
  "Sign in with a Claude subscription": "Claude aboneliğiyle giriş yap",
  "Sign in with Claude": "Claude ile giriş yap",
  "Sign in with ChatGPT": "ChatGPT ile giriş yap",
  "Sign in with Google": "Google ile giriş yap",
  // features/agents/controls.ts
  Mode: "Mod",
  // features/chat/AgentStatusCard.tsx
  "The {name} adapter is not installed": "{name} bağlayıcısı kurulu değil",
  "Xora installs the official ACP adapter for {name} into its app folder, once. Your account and settings stay as they are.":
    "Xora, {name} için resmi ACP bağlayıcısını uygulama klasörüne bir kez kurar. Hesabın ve ayarların değişmez.",
  Install: "Kur",
  "Node.js not found": "Node.js bulunamadı",
  "Node.js is too old": "Node.js sürümü eski",
  "Agent adapters need Node.js 22 or newer. Install it, then try again.":
    "Agent bağlayıcıları Node.js 22 veya üstüyle çalışır. Kurduktan sonra yeniden dene.",
  "Download Node.js": "Node.js indir",
  "Try again": "Yeniden dene",
  "Installing {name}…": "{name} kuruluyor…",
  "The first install can take about a minute.": "İlk kurulum bir dakika kadar sürebilir.",
  "Connecting to {name}…": "{name} bağlanıyor…",
  "Sign in to {name}": "{name} hesabına giriş yap",
  "{name} quit unexpectedly": "{name} beklenmedik şekilde kapandı",
  "Exit code {code}.": "Çıkış kodu {code}.",
  Restart: "Yeniden başlat",
  "Finish signing in in the console that opened; the chat picks up on its own when you are done.":
    "Açılan konsolda girişi tamamla; bitince sohbet kendiliğinden devam eder.",
  "Sign-in opens in your browser. Xora never sees a password or key.":
    "Giriş tarayıcıda açılır. Xora hiçbir parolayı ya da anahtarı görmez.",
  Setup: "Kurulum",
  "Hide details": "Ayrıntıları gizle",
  Details: "Ayrıntılar",
  // features/chat/ChangesBar.tsx
  Changes: "Değişiklikler",
  Accept: "Kabul et",
  new: "yeni",
  "File changed since": "Dosya sonra değişti",
  Revert: "Geri al",
  // features/chat/ChatPanel.tsx
  "Sign-in failed: {reason}": "Giriş başarısız: {reason}",
  "Sign-in failed.": "Giriş başarısız.",
  "Open a folder first; the agent works in that folder.":
    "Önce bir klasör aç; agent o klasörde çalışır.",
  "{name} is not ready yet.": "{name} henüz hazır değil.",
  "A new chat with {name} will open; the running turn continues in the background.":
    "{name} ile yeni bir sohbet açılacak; süren tur arka planda devam eder.",
  "Switch agent?": "Agent değişsin mi?",
  Cancel: "Vazgeç",
  "Could not change the setting: {err}": "Ayar değiştirilemedi: {err}",
  "Could not attach: {reason}": "Eklenemedi: {reason}",
  "Add folder": "Klasör ekle",
  "Add file": "Dosya ekle",
  stop: "durdur",
  "Queued messages": "Sıradaki mesajlar",
  Queued: "Sırada",
  "Remove from queue": "Sıradan çıkar",
  // features/chat/CheckoutChip.tsx
  "New worktree: {name} ({branch})": "Yeni worktree: {name} ({branch})",
  "Changes from {name} were merged into {into}; the worktree was removed.":
    "{name} değişiklikleri {into} branch'ine alındı; worktree kaldırıldı.",
  "The {name} worktree has uncommitted changes. Deleting it loses them.":
    "{name} worktree'sinde kaydedilmemiş değişiklikler var. Silinirse bunlar kaybolur.",
  "Delete worktree?": "Worktree silinsin mi?",
  Delete: "Sil",
  "Deleted the {name} worktree.": "{name} worktree'si silindi.",
  "Current checkout": "Mevcut checkout",
  "New worktree": "Yeni worktree",
  "Merge into {branch}": "{branch}'e al",
  "main branch": "Ana branch",
  "Delete worktree": "Worktree'yi sil",
  "Checkout the agent works in": "Agent'ın çalıştığı checkout",
  // features/chat/Composer.tsx
  Message: "Mesaj",
  Attachments: "Ekler",
  "Type a follow-up; it is sent when the turn ends…":
    "Devam etmesi için yaz; tur bitince gönderilir…",
  "Ask for anything…": "Bir şey iste…",
  "Reply or give a new task…": "Yanıtla ya da yeni bir görev ver…",
  "Remove attachment {name}": "{name} ekini kaldır",
  Remove: "Kaldır",
  "Stopping…": "Durduruluyor…",
  "Stop (Esc)": "Durdur (Esc)",
  Queue: "Sıraya ekle",
  Send: "Gönder",
  // features/chat/ComposerToolbar.tsx
  On: "Açık",
  Off: "Kapalı",
  "Thinking level": "Düşünme düzeyi",
  List: "Liste",
  "Choose visible models…": "Görünen modelleri seç…",
  "Agent, model and settings": "Agent, model ve ayarlar",
  "File…": "Dosya…",
  "Folder…": "Klasör…",
  "Open file: {name}": "Açık dosya: {name}",
  Add: "Ekle",
  "Context: {percent}% · {used} / {size}": "Bağlam: %{percent} · {used} / {size}",
  Environment: "Çalışma ortamı",
  "The agent runs on this computer.": "Agent bu bilgisayarda çalışır.",
  "Open another folder": "Başka bir klasör aç",
  "Open folder": "Klasör aç",
  "Choose a folder": "Klasör seç",
  "Git branch: {branch}": "Git dalı: {branch}",
  // features/chat/controlsView.ts
  Low: "Düşük",
  Medium: "Orta",
  High: "Yüksek",
  "Very high": "Çok yüksek",
  Max: "En yüksek",
  Default: "Varsayılan",
  "Not installed": "Kurulu değil",
  "Needs Node.js": "Node.js gerekli",
  Installing: "Kuruluyor",
  Connecting: "Bağlanıyor",
  "Sign-in needed": "Giriş gerekli",
  Stopped: "Kapandı",
  // features/chat/DiffPreview.tsx
  "Open in editor": "Editörde aç",
  "Content unchanged.": "İçerik değişmedi.",
  "Show 1 more line": "1 satır daha göster",
  "Show {n} more lines": "{n} satır daha göster",
  // features/chat/DropOverlay.tsx
  "Drop to add to the chat": "Sohbete eklemek için bırak",
  "Files, folders and images": "Dosyalar, klasörler ve görseller",
  // features/chat/exportChat.ts
  "Export chat": "Sohbeti dışa aktar",
  // features/chat/format.ts
  "{s}s": "{s} sn",
  "{m}m": "{m} dk",
  "{m}m {s}s": "{m} dk {s} sn",
  // features/chat/Markdown.tsx
  Copied: "Kopyalandı",
  Copy: "Kopyala",
  // features/chat/MentionPopover.tsx
  "Listing files…": "Dosyalar listeleniyor…",
  "No matching files": "Eşleşen dosya yok",
  // features/chat/MessageList.tsx
  "The reply hit its length limit.": "Yanıt uzunluk sınırına ulaştı.",
  "This turn hit its request limit.": "Bu tur için istek sınırına ulaşıldı.",
  "The agent declined this request.": "Agent bu isteği yanıtlamadı.",
  "Working…": "Çalışıyor…",
  "The turn could not finish.": "Tur tamamlanamadı.",
  "Jump to bottom": "En alta git",
  "Copy reply": "Yanıtı kopyala",
  "Attached image": "Eklenen görsel",
  "Loading session": "Oturum yükleniyor",
  // features/chat/PermissionPrompt.tsx
  "Permission needed": "İzin gerekiyor",
  "The agent wants to do something.": "Agent bir işlem yapmak istiyor.",
  // features/chat/PlanView.tsx
  priority: "öncelikli",
  Pending: "Bekliyor",
  "In progress": "Sürüyor",
  Done: "Bitti",
  // features/chat/renderMarkdown.ts
  text: "metin",
  "Copy code": "Kodu kopyala",
  // features/chat/SessionList.tsx
  Pinned: "Sabit",
  "No chats yet": "Henüz sohbet yok",
  "Your first message shows up here.": "İlk mesajın burada görünür.",
  "Open a folder and its chats appear here.": "Bir klasör açınca sohbetler burada.",
  Archived: "Arşiv",
  Refresh: "Yenile",
  "Untitled chat": "Adsız sohbet",
  'Delete "{title}"?': '"{title}" silinsin mi?',
  "Delete?": "Silinsin mi?",
  Unpin: "Sabitlemeyi kaldır",
  Pin: "Sabitle",
  Unarchive: "Arşivden çıkar",
  Archive: "Arşivle",
  Open: "Aç",
  Rename: "Yeniden adlandır",
  "Chat name": "Sohbetin adı",
  "Uses the agent's title": "Ajanın başlığı kullanılır",
  "Loading chats": "Sohbetler yükleniyor",
  // features/chat/sessionListView.ts
  Today: "Bugün",
  Yesterday: "Dün",
  "This week": "Bu hafta",
  Older: "Daha eski",
  // features/chat/slash.ts
  "Start a new chat": "Yeni sohbet başlat",
  "Close the chat, back to a blank page": "Sohbeti kapat, boş sayfaya dön",
  // features/chat/SlashPopover.tsx
  "Agent commands": "Agent komutları",
  Commands: "Komutlar",
  "No matching commands": "Eşleşen komut yok",
  // features/chat/ThinkingBlock.tsx
  "Thinking…": "Düşünüyor…",
  "Thought · {duration}": "Düşündü · {duration}",
  Thought: "Düşündü",
  // features/chat/ToolCallCard.tsx
  Running: "Çalışıyor",
  Completed: "Tamamlandı",
  Failed: "Başarısız",
  "All · 1 more line": "Tümü · 1 satır daha",
  "All · {n} more lines": "Tümü · {n} satır daha",
  "No output.": "Çıktı yok.",
  "Exit code 0": "Çıkış kodu 0",
  Terminated: "Sonlandırıldı",
  "Exit code {code}": "Çıkış kodu {code}",
  // features/chat/ToolImages.tsx
  Image: "Görsel",
  "Show in folder": "Klasörde göster",
  // features/chat/toolView.ts
  Allow: "İzin ver",
  "Always allow": "Hep izin ver",
  Reject: "Reddet",
  "Always reject": "Hep reddet",
  // features/chat/transcript.ts
  failed: "başarısız",
  pending: "bekliyor",
  "in progress": "sürüyor",
  "_[image]_": "_[görsel]_",
  "_[file: {name}]_": "_[dosya: {name}]_",
  "_[attachment: {uri}]_": "_[ek: {uri}]_",
  "_(the start of the conversation was cut)_\n\n…{tail}":
    "_(konuşmanın başı kısaltıldı)_\n\n…{tail}",
  "I was working through this conversation with {fromAgent}; take it from here.":
    "Bu konuşmayı {fromAgent} ile yürütüyordum; buradan sen devam et.",
  "First sum up where things stand in two or three sentences, then suggest the next step from where we left off.":
    "Önce durumu iki üç cümleyle özetle, sonra kaldığımız yerden sıradaki adımı öner.",
  // features/commands/CommandPalette.tsx
  "Command palette": "Komut paleti",
  "Search commands, chats or folders…": "Komut, sohbet ya da klasör ara…",
  "No results": "Sonuç yok",
  "No command matches “{query}”.": "“{query}” ile eşleşen bir komut bulunamadı.",
  move: "gez",
  run: "çalıştır",
  close: "kapat",
  // features/commands/registry.ts
  "Refresh file tree": "Dosya ağacını yenile",
  "Save active file": "Aktif dosyayı kaydet",
  "Close active tab": "Aktif sekmeyi kapat",
  "Go to file…": "Dosyaya git…",
  "Copy chat as Markdown": "Sohbeti Markdown olarak kopyala",
  "Export chat…": "Sohbeti dışa aktar…",
  "Toggle sidebar": "Kenar çubuğunu göster/gizle",
  "Toggle editor": "Editörü göster/gizle",
  "Go to chats": "Sohbetlere geç",
  "Pin or unpin the files drawer": "Dosya çekmecesini sabitle/bırak",
  "Go to Inbox": "Inbox'a geç",
  "New note": "Yeni not",
  "Toggle terminal": "Terminali aç/kapat",
  "Toggle window transparency": "Pencere saydamlığını aç/kapat",
  "Manage accounts": "Hesapları yönet",
  "Wallpaper and appearance": "Duvar kağıdı ve görünüm",
  // features/editor/closeTab.ts
  "Unsaved changes": "Kaydedilmemiş değişiklikler",
  "{name} has unsaved changes. Save before closing?":
    "{name} dosyasındaki değişiklikler kaydedilmedi. Kapatmadan önce kaydedilsin mi?",
  // features/editor/EditorArea.tsx
  "No open file": "Açık dosya yok",
  "Pick a file from the Files panel.": "Dosyalar panelinden bir dosya seç.",
  // features/editor/EditorPanel.tsx
  "Add selection to chat": "Seçimi sohbete ekle",
  // features/editor/EditorStatusBar.tsx
  "Saving overwrites the version on disk.": "Kaydedersen diskteki sürümün üzerine yazılır.",
  "Changed on disk; saving overwrites the version on disk.":
    "Diskte değişti; kaydedersen diskteki sürümün üzerine yazılır.",
  "Load from disk": "Diskten yükle",
  "Line {line}, column {column}": "Satır {line}, sütun {column}",
  // features/editor/EditorTabs.tsx
  "Open files": "Açık dosyalar",
  "{path}\nChanged on disk": "{path}\nDiskte değişti",
  "(changed on disk)": "(diskte değişti)",
  "Close {name}": "{name} kapat",
  "Close (Ctrl+W)": "Kapat (Ctrl+W)",
  // features/files/FileTree.tsx
  "No folder open": "Klasör açılmadı",
  "Open a folder or pick up where you left off.": "Bir klasör aç ya da kaldığın yerden devam et.",
  "Open a folder to get started.": "Başlamak için bir klasör aç.",
  Recent: "Son açılanlar",
  "“{gone}” was not found and was removed from the list.":
    "“{gone}” bulunamadı; listeden çıkarıldı.",
  // features/files/FolderTabs.tsx
  "Open folders": "Açık klasörler",
  "Close folder {name}": "{name} klasörünü kapat",
  // features/files/fsErrors.ts
  "File not found; it may have been deleted or moved.":
    "Dosya bulunamadı; silinmiş ya da taşınmış olabilir.",
  "Access denied.": "Erişim izni yok.",
  "Not a text file; binary files cannot be opened.":
    "Metin dosyası değil; ikili dosyalar açılamıyor.",
  "File too large (over 16 MB) to open.": "Dosya çok büyük (16 MB üstü); açılamıyor.",
  "This is a folder, not a file.": "Bu bir klasör, dosya değil.",
  // features/files/QuickOpen.tsx
  "Open a folder first.": "Önce bir klasör aç.",
  "No file matches “{query}”.": "“{query}” ile eşleşen dosya yok.",
  "Open file": "Dosya aç",
  "Type a file name…": "Dosya adı yaz…",
  // features/files/treeModel.ts
  "Empty folder": "Boş klasör",
  // features/files/useFileOpener.ts
  "“{path}” no longer exists; the list was refreshed.": "“{path}” artık yok; liste yenilendi.",
  // features/git/worktrees.ts
  "Git not found. Worktrees need Git installed.":
    "Git bulunamadı. Worktree için Git'in kurulu olması gerekiyor.",
  "The worktree has uncommitted changes.": "Worktree'de kaydedilmemiş değişiklikler var.",
  "The worktree was removed, but its branch has unmerged commits, so the branch was kept.":
    "Worktree kaldırıldı ama branch'inde birleştirilmemiş commit'ler var; branch duruyor.",
  "The main branch has moved on, so the changes could not be merged automatically. Merge them first.":
    "Ana branch ilerlemiş; değişiklikler otomatik alınamadı. Önce birleştirmen gerekiyor.",
  // features/inbox/InboxPanel.tsx
  "1 open note": "1 açık not",
  "{n} open notes": "{n} açık not",
  "Inbox is empty": "Inbox boş",
  "Drop whatever comes to mind here and come back to it later.":
    "Aklına geleni buraya bırak; sonra dönersin.",
  "Unknown error": "Bilinmeyen hata",
  "Could not save: {error}. Retrying automatically.":
    "Kaydedilemedi: {error}. Otomatik olarak yeniden denenecek.",
  "{n} notes deleted": "{n} not silindi",
  "Note deleted": "Not silindi",
  "Undo (Ctrl+Z)": "Geri al (Ctrl+Z)",
  Undo: "Geri al",
  Notes: "Notlar",
  "No open notes left.": "Açık not kalmadı.",
  "Done notes": "Tamamlanan notlar",
  "Could not load notes: {message}": "Notlar yüklenemedi: {message}",
  Retry: "Tekrar dene",
  "Loading notes": "Notlar yükleniyor",
  // features/inbox/NoteComposer.tsx
  "Jot a note…": "Bir not bırak…",
  add: "ekle",
  "new line": "yeni satır",
  // features/inbox/NoteItem.tsx
  less: "daralt",
  more: "devamı",
  "Send to chat (G)": "Sohbete gönder (G)",
  "Unpin (P)": "Sabitlemeyi kaldır (P)",
  "Pin (P)": "Sabitle (P)",
  "Reopen (E)": "Geri al (E)",
  "Mark done (E)": "Tamamla (E)",
  "Delete (Del)": "Sil (Del)",
  pinned: "sabit",
  done: "tamamlandı",
  "Edit note": "Notu düzenle",
  // features/inbox/retryCountdown.ts
  "Could not save · will retry": "Kaydedilemedi · tekrar denenecek",
  "Could not save · retrying in {seconds}s": "Kaydedilemedi · {seconds} sn içinde tekrar denenecek",
  "Could not save · retrying…": "Kaydedilemedi · tekrar deneniyor…",
  // features/settings/controls/NumberInput.tsx
  Increase: "Artır",
  Decrease: "Azalt",
  // features/settings/controls/SettingRow.tsx
  "Reset to default": "Varsayılana döndür",
  "{label}: reset to default": "{label}: varsayılana döndür",
  // features/settings/providers.ts
  "Type /login in the window that opens and confirm in your browser.":
    "Açılan pencerede /login yazın ve tarayıcıda onaylayın.",
  "Follow the ChatGPT sign-in steps in the window that opens.":
    "Açılan pencerede ChatGPT ile giriş adımlarını izleyin.",
  "Choose “Login with Google” in the window that opens.":
    "Açılan pencerede “Login with Google” seçeneğini seçin.",
  "Signed in": "Giriş yapılmış",
  "Signed out": "Giriş yapılmamış",
  Unknown: "Bilinmiyor",
  // features/settings/searchIndex.ts
  "Ignore ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY'i yok say",
  "Default agent": "Varsayılan ajan",
  "Default mode": "Varsayılan mod",
  "Thinking effort": "Düşünme eforu",
  "Visible models": "Görünen modeller",
  "Approval policy": "Onay politikası",
  "Verbose agent logs": "Ayrıntılı ajan günlükleri",
  "Send message with": "Mesajı gönder",
  "Chat text size": "Sohbet yazı boyutu",
  "Notify when done": "Bitince haber ver",
  "Reopen last folder": "Son klasörü aç",
  "Ask before closing an unsaved tab": "Kaydedilmemiş sekmeyi kapatırken sor",
  "Reduce motion": "Hareketi azalt",
  "Interface scale": "Arayüz ölçeği",
  Transparency: "Saydamlık",
  Darkness: "Koyuluk",
  "Show picture": "Görsel göster",
  Effect: "Efekt",
  Dim: "Karartma",
  "Font size": "Yazı boyutu",
  Ligatures: "Ligatürler",
  "Line numbers": "Satır numaraları",
  "Cursor style": "İmleç biçimi",
  "Sticky scroll": "Yapışkan kaydırma",
  "Bracket colors": "Parantez renkleri",
  "Tab size": "Sekme genişliği",
  "Word wrap": "Satır kaydırma",
  Minimap: "Mini harita",
  "Show whitespace": "Boşlukları göster",
  "Auto save": "Otomatik kaydet",
  "Format on save": "Kaydederken biçimlendir",
  "Default shell": "Varsayılan kabuk",
  "Terminal font size": "Terminal yazı boyutu",
  Shortcuts: "Kısayollar",
  About: "Hakkında",
  // features/settings/sections/AboutSection.tsx
  "An open-source, agent-first code editor.": "Açık kaynak, ajan öncelikli kod editörü.",
  "Reading version…": "Sürüm okunuyor…",
  License: "Lisans",
  "Source code": "Kaynak kodu",
  "Open-source licenses": "Açık kaynak lisansları",
  "Built by the Xora Code contributors under the MIT license.":
    "Xora Code katkıcıları tarafından MIT lisansıyla geliştirilir.",
  // features/settings/sections/AccountsSection.tsx
  "Xora runs the agent CLIs on your computer with your own subscription. Sign-in details stay with the CLI; Xora never reads them.":
    "Xora, bilgisayarınızdaki ajan CLI'larını kendi aboneliğinizle çalıştırır. Giriş bilgileri CLI'da kalır; Xora onları hiç okumaz.",
  "Detection failed: {error}": "Algılama başarısız: {error}",
  "New chats start with this agent.": "Yeni sohbetler bu ajanla başlar.",
  "Claude Code uses your subscription even when an API key is set in the environment.":
    "Ortamda bir API anahtarı tanımlı olsa bile Claude Code aboneliğinizle çalışır.",
  "Status unknown": "Durum bilinmiyor",
  "A console opened. {loginHint}": "Konsol açıldı. {loginHint}",
  "version unknown": "sürüm okunamadı",
  "not found on PATH": "PATH üzerinde bulunamadı",
  "Make default": "Varsayılan yap",
  "Sign in again": "Yeniden giriş",
  "Sign in": "Giriş yap",
  "Copy install command": "Kurulum komutunu kopyala",
  "Run it in a terminal (needs Node.js 20+), then press Refresh.":
    "Bir terminalde çalıştırın (Node.js 20+ gerekir), sonra Yenile'ye basın.",
  "Detecting {name}": "{name} algılanıyor",
  // features/settings/sections/AgentSection.tsx
  "Ask for everything": "Her şeyi sor",
  "Asks for your approval on every file edit and command.":
    "Dosya düzenlemeleri ve komutlar için her seferinde onayınızı ister.",
  "Auto-approve file edits": "Dosya düzenlemelerini otomatik onayla",
  "Edits inside the working folder apply right away; commands still ask.":
    "Çalışma klasöründeki düzenlemeler hemen uygulanır; komutlar için yine sorar.",
  "Fully automatic": "Tam otomatik",
  "The agent edits and runs commands without asking. Only turn this on for projects you trust.":
    "Ajan sormadan düzenler ve komut çalıştırır. Yalnızca güvendiğiniz projelerde açın.",
  "Choose which agent a new chat starts with, in which mode, and how freely it may act.":
    "Yeni bir sohbet başlarken Xora'nın hangi ajanı, hangi modda ve ne kadar serbestçe çalıştıracağını seçin.",
  Defaults: "Varsayılanlar",
  "not installed": "kurulu değil",
  "Agent acts, Plan drafts a plan first, Chat only answers.":
    "Ajan uygular, Plan önce bir plan çıkarır, Sohbet yalnızca yanıtlar.",
  "Applied where the agent supports it. Higher effort is slower but more thorough.":
    "Destekleyen ajanlarda uygulanır. Yüksek efor daha yavaş ama daha titizdir.",
  Diagnostics: "Tanılama",
  "Logs the protocol traffic with the agent, for troubleshooting.":
    "Ajanla yapılan protokol trafiğini sorun gidermek için günlüğe yazar.",
  "The models an agent offers are listed here once you start your first chat with it.":
    "Bir ajanla ilk sohbeti başlattığınızda sunduğu modeller burada listelenir.",
  "Visible models · {name}": "Görünen modeller · {name}",
  // features/settings/sections/AppearanceSection.tsx
  None: "Yok",
  Scanlines: "Tarama",
  Solid: "Opak",
  Frosted: "Buzlu",
  Clear: "Net",
  "Choose a picture": "Görsel seç",
  Images: "Görseller",
  Appearance: "Görünüm",
  "A picture sits at the top of the new-chat screen and fades into onyx below the composer. Use your own or turn it off.":
    "Yeni sohbet ekranının üstünde Xora'nın görseli durur ve composer'ın altında onyx'e karışır. Kendi görselinizi koyabilir ya da kapatabilirsiniz.",
  "Xora's picture · your own: PNG, JPG, WebP, GIF, AVIF or BMP, up to 40 MB":
    "Xora'nın görseli · kendi görseliniz: PNG, JPG, WebP, GIF, AVIF ya da BMP, en fazla 40 MB",
  "Back to default": "Varsayılana dön",
  "Adding…": "Ekleniyor…",
  "Change…": "Değiştir…",
  "Your own picture…": "Kendi görselin…",
  "Could not add the picture: {error}": "Görsel eklenemedi: {error}",
  Window: "Pencere",
  "Makes the whole interface larger or smaller. Shortcut: Ctrl + / Ctrl - / Ctrl 0.":
    "Bütün arayüzü büyütür ya da küçültür. Kısayol: Ctrl + / Ctrl - / Ctrl 0.",
  "Frosted: the apps and desktop behind show through, blurred. Clear: they show through without blur. Solid: pure onyx.":
    "Buzlu: arkadaki uygulamalar ve masaüstü bulanık görünür. Net: bulanıklık olmadan görünür. Opak: saf onyx.",
  "How much a see-through window is darkened, so text stays readable.":
    "Arkası görünen pencerenin ne kadar karartılacağı; yazılar okunaklı kalsın diye.",
  "When off, a new chat opens on plain onyx.": "Kapalıyken yeni sohbet saf onyx açılır.",
  "Redraws the picture with dither, ASCII, halftone or scanlines.":
    "Görseli dither, ASCII, halftone ya da tarama çizgileriyle yeniden çizer.",
  "Darkens bright pictures so the composer stands out.":
    "Parlak görsellerde composer'ın öne çıkması için görseli koyulaştırır.",
  "Appearance preview": "Görünüm önizlemesi",
  "Could not open the picture; choose another": "Görsel açılamadı, yenisini seçin",
  // features/settings/sections/EditorSection.tsx
  Boundary: "Sınırlar",
  All: "Tümü",
  Relative: "Göreli",
  Line: "Çizgi",
  Block: "Blok",
  Underline: "Alt çizgi",
  "After a pause": "Yazınca",
  "On focus change": "Odak değişince",
  "How the code editor looks and behaves. Changes apply to open tabs right away.":
    "Kod editörünün görünümü ve davranışı. Değişiklikler açık sekmelere anında uygulanır.",
  Text: "Yazı",
  "Size of the code in the editor.": "Editördeki kod yazısının boyutu.",
  "Draws symbols like =>, !== and -> as single glyphs.":
    "=>, !== ve -> gibi işaretleri tek bir glif olarak çizer.",
  "Cursor and gutter": "İmleç ve kenar",
  "Relative shows the distance from the cursor's line.":
    "Göreli, imlecin bulunduğu satıra olan uzaklığı gösterir.",
  "Keeps the enclosing class and function headers at the top while scrolling.":
    "Kaydırırken içinde bulunduğun sınıf ve fonksiyon başlıkları üstte kalır.",
  "Colors matching brackets by depth and draws a guide for the active pair.":
    "Eşleşen parantezleri derinliğine göre renklendirir ve aktif çiftin kılavuzunu çizer.",
  Layout: "Düzen",
  "How many spaces one indent counts as.": "Bir girintinin kaç boşluk sayılacağı.",
  "Long lines wrap instead of scrolling sideways.":
    "Uzun satırlar yatay kaydırma yerine alt satıra geçer.",
  "Shows a small overview of the file on the right edge.":
    "Sağ kenarda dosyanın küçük bir özetini gösterir.",
  "Draws spaces and tabs as faint marks.":
    "Boşluk ve sekme karakterlerini soluk işaretlerle çizer.",
  Saving: "Kaydetme",
  "After a pause: a second after you stop typing. On focus change: when you leave the editor or Xora. Files changed on disk are never auto-saved.":
    "Yazınca: yazmayı bıraktıktan bir saniye sonra. Odak değişince: editörden ya da Xora'dan çıkınca. Diskte değişmiş dosyalar asla otomatik kaydedilmez.",
  "Runs the formatter for the file's language, if there is one, before saving.":
    "Dosyanın dili için bir biçimlendirici varsa kaydetmeden önce çalıştırır.",
  "Editor preview": "Editör önizlemesi",
  "{size}px · {tab} spaces": "{size}px · {tab} boşluk",
  // features/settings/sections/GeneralSection.tsx
  System: "Sistem",
  Always: "Her zaman",
  Never: "Asla",
  General: "Genel",
  "How Xora behaves on start and day to day.":
    "Xora'nın açılışta ve gündelik kullanımda nasıl davrandığı.",
  Startup: "Başlangıç",
  "Xora opens with the folder you last worked in.":
    "Xora açıldığında en son çalıştığınız klasörle devam eder.",
  "Enter sends, Shift+Enter starts a new line.": "Enter gönderir, Shift+Enter alt satıra geçer.",
  "Ctrl+Enter sends, Enter starts a new line. Comfortable for long messages.":
    "Ctrl+Enter gönderir, Enter alt satıra geçer. Uzun mesajlar yazarken rahat.",
  "Text size of messages and agent replies.": "Mesajların ve ajan yanıtlarının yazı boyutu.",
  Notifications: "Bildirim",
  "While Xora is in the background, its taskbar button flashes when an agent finishes or asks for approval.":
    "Xora arka plandayken ajan işini bitirince ya da onay isteyince görev çubuğunda yanıp söner.",
  Editing: "Düzenleme",
  "When off, unsaved changes are discarded without asking.":
    "Kapalıyken kaydedilmemiş değişiklikler sorulmadan atılır.",
  Accessibility: "Erişilebilirlik",
  "System follows the operating system's setting. Always turns transition animations off.":
    "Sistem, işletim sisteminin ayarını izler. Her zaman, geçiş animasyonlarını kapatır.",
  // features/settings/sections/ShortcutsSection.tsx
  "Every command in the command palette and its keyboard shortcut. Editing shortcuts is coming later.":
    "Komut paletindeki her komut ve klavye kısayolu. Kısayolları düzenleme ileride gelecek.",
  "Search commands or keys…": "Komut ya da tuş ara…",
  "Search shortcuts": "Kısayollarda ara",
  Unassigned: "Atanmamış",
  // features/settings/sections/TerminalSection.tsx
  Automatic: "Otomatik",
  "PowerShell 7, else Windows PowerShell": "PowerShell 7, yoksa Windows PowerShell",
  "Command Prompt": "Komut İstemi",
  "The built-in terminal, opened with Ctrl+`. The shell applies to new terminals; the font size also applies to open ones right away.":
    "Ctrl+` ile açılan yerleşik terminal. Kabuk yeni açılan terminallerde, yazı boyutu açık olanlarda da hemen uygulanır.",
  Shell: "Kabuk",
  "Falls back to the automatic choice when the selected shell is not installed.":
    "Seçtiğin kabuk kurulu değilse otomatik seçime döner.",
  // features/settings/SettingsView.tsx
  "Settings sections": "Ayar bölümleri",
  "Back (Esc)": "Geri (Esc)",
  "Search settings": "Ayarlarda ara",
  "Clear search": "Aramayı temizle",
  "to open": "ile aç",
  "Could not save settings: {error}": "Ayarlar kaydedilemedi: {error}",
  "No setting matches “{query}”.": "“{query}” ile eşleşen bir ayar yok.",
  "Search results": "Arama sonuçları",
  "1 setting · Enter opens it": "1 ayar · Enter açar",
  "{n} settings · Enter opens the first": "{n} ayar · Enter ilkini açar",
  // features/terminal/session.ts
  "Could not start the terminal: {message}": "Terminal başlatılamadı: {message}",
  "Process exited": "İşlem sonlandı",
  "Process exited (exit code {code})": "İşlem sonlandı (çıkış kodu {code})",
  // features/terminal/TerminalDock.tsx
  "Terminal height": "Terminal yüksekliği",
  // features/terminal/TerminalPanel.tsx
  Terminals: "Terminaller",
  "New terminal (Ctrl+Shift+`)": "Yeni terminal (Ctrl+Shift+`)",
  "Hide terminal (Ctrl+`)": "Terminali gizle (Ctrl+`)",
  "(exited)": "(sonlandı)",
  "Close {label}": "{label} kapat",
  // shared/ui/ConfirmDialog.tsx
  Save: "Kaydet",
  "Don't save": "Kaydetme",
  // shared/ui/ErrorBoundary.tsx
  "{area} ran into an error": "{area} bir hatayla karşılaştı",
  // features/commands (palette groups)
  File: "Dosya",
  View: "Görünüm",
  Preferences: "Tercihler",
  "Recent folders": "Son klasörler",
  // app/language.ts, features/settings/sections/GeneralSection.tsx
  Language: "Dil",
  "Interface language": "Arayüz dili",
  "System follows your computer's language. Changing it reloads the window.":
    "Sistem, bilgisayarının dilini izler. Değiştirince pencere yeniden yüklenir.",
};

// One xterm instance bound to one Rust PTY session. Lives outside React so a tab keeps
// its scrollback and shell across re-renders, StrictMode remounts and panel collapses.
// Only the lazily loaded terminal chunk imports this file (it pulls in xterm).

import { Channel } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { registerCloseGuard } from "@/app/closeGuards";
import { terminalIpc, toBytes, type OutputMessage } from "./ipc";
import { clipboardAction } from "./keys";
import { buildTerminalTheme, readTokens } from "./theme";
import { createWriteQueue, type WriteQueue } from "./writeQueue";

export interface SessionEvents {
  onStarted: (shell: string) => void;
  /** The shell exited; `code` is null when the OS did not report one. */
  onExit: (code: number | null) => void;
  onFailed: (message: string) => void;
}

const FONT_FAMILY = '"JetBrains Mono Variable", ui-monospace, monospace';
const FONT_SIZE = 13;

// ANSI dim grey / red for the notes this app writes into the terminal itself.
const note = (text: string) => `\r\n\x1b[90m${text}\x1b[0m\r\n`;
const errorNote = (text: string) => `\x1b[31m${text}\x1b[0m\r\n`;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isWindows = () => /windows/i.test(navigator.userAgent);

/** Waits (briefly) for the mono font so xterm measures the right cell size. */
async function fontReady() {
  try {
    await Promise.race([
      document.fonts.load(`${FONT_SIZE}px ${FONT_FAMILY}`),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
  } catch {
    // Measuring with the fallback font is still usable.
  }
}

export class TerminalSession {
  /** Stays in the DOM wherever the tab's view puts it. */
  readonly host = document.createElement("div");
  private readonly term: Terminal;
  private readonly fitAddon = new FitAddon();
  private readonly queue: WriteQueue;
  private readonly ready: Promise<number | null>;
  private resolveReady!: (id: number | null) => void;
  private id: number | null = null;
  private started = false;
  private exited = false;
  private disposed = false;

  constructor(
    private readonly cwd: string | null,
    private readonly events: SessionEvents,
  ) {
    // Padding sits on the .xterm element, which the fit addon subtracts.
    this.host.className = "h-full w-full [&>.xterm]:h-full [&>.xterm]:pt-1.5 [&>.xterm]:pl-3";
    this.ready = new Promise((resolve) => (this.resolveReady = resolve));

    this.term = new Terminal({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      lineHeight: 1.25,
      fontWeight: "400",
      fontWeightBold: "600",
      cursorStyle: "bar",
      cursorWidth: 2,
      cursorInactiveStyle: "outline",
      cursorBlink: !prefersReducedMotion(),
      scrollback: 5000,
      smoothScrollDuration: 0,
      // Lets a translucent `--glass` theme background show the wallpaper behind the panel.
      allowTransparency: true,
      drawBoldTextInBrightColors: false,
      macOptionIsMeta: true,
      theme: buildTerminalTheme(
        readTokens((v) => getComputedStyle(document.documentElement).getPropertyValue(v)),
      ),
      ...(isWindows() ? { windowsPty: { backend: "conpty" as const } } : {}),
    });
    this.term.loadAddon(this.fitAddon);
    // Ctrl/Cmd+click opens a link, so a plain click can still select text.
    this.term.loadAddon(
      new WebLinksAddon((event, uri) => {
        if (event.ctrlKey || event.metaKey) void openUrl(uri).catch(console.error);
      }),
    );
    this.term.attachCustomKeyEventHandler(this.onKey);

    this.queue = createWriteQueue(async (data) => {
      const id = await this.ready;
      if (id !== null && !this.exited) await terminalIpc.write(id, data);
    });
    this.term.onData((data) => this.queue.push(data));
    this.term.onResize(({ cols, rows }) => {
      if (this.id !== null && !this.exited)
        void terminalIpc.resize(this.id, cols, rows).catch(() => {});
    });
  }

  /** Moves the terminal into `container`; the first call opens xterm and starts the shell. */
  attach(container: HTMLElement) {
    if (this.disposed) return;
    if (this.host.parentElement !== container) container.appendChild(this.host);
    if (this.started) return;
    this.started = true;
    void this.start();
  }

  private async start() {
    await fontReady();
    if (this.disposed) return;
    this.term.open(this.host);
    this.fit();

    try {
      // Inside the try: outside Tauri (plain browser) creating a Channel already throws.
      const onData = new Channel<OutputMessage>((message) => {
        if (!this.disposed) this.term.write(toBytes(message));
      });
      const onExit = new Channel<number | null>((code) => this.handleExit(code));
      const info = await terminalIpc.spawn(
        this.term.cols,
        this.term.rows,
        this.cwd,
        onData,
        onExit,
      );
      this.id = info.id;
      this.resolveReady(info.id);
      if (this.disposed) {
        void terminalIpc.kill(info.id).catch(() => {});
        return;
      }
      this.events.onStarted(info.shell);
    } catch (err) {
      this.resolveReady(null);
      const message = err instanceof Error ? err.message : String(err);
      this.exited = true;
      if (!this.disposed) {
        this.term.write(errorNote(`Terminal başlatılamadı: ${message}`));
        this.events.onFailed(message);
      }
    }
  }

  private handleExit(code: number | null) {
    if (this.exited) return;
    this.exited = true;
    if (this.disposed) return;
    if (code !== 0) {
      this.term.write(note(`İşlem sonlandı${code === null ? "" : ` (çıkış kodu ${code})`}`));
    }
    this.events.onExit(code);
  }

  /** Clipboard keys; everything else goes to xterm (and on to the shell). */
  private onKey = (e: KeyboardEvent): boolean => {
    // Another app shortcut (palette, sidebar switch) already handled this key.
    if (e.defaultPrevented) return false;
    const action = clipboardAction(e, this.term.hasSelection());
    if (action === "copy") {
      e.preventDefault();
      const text = this.term.getSelection();
      void navigator.clipboard.writeText(text).catch(console.error);
      this.term.clearSelection();
      return false;
    }
    // Not handled by xterm and not prevented: the browser fires a native paste event
    // on xterm's textarea, which xterm pastes (bracketed-paste aware).
    if (action === "paste") return false;
    return true;
  };

  /** Refits to the container; skipped while hidden (a zero-size fit would break the PTY). */
  fit() {
    if (this.disposed || !this.term.element) return;
    if (this.host.offsetWidth === 0 || this.host.offsetHeight === 0) return;
    try {
      this.fitAddon.fit();
    } catch {
      // The renderer has not measured yet; the next resize fits.
    }
  }

  focus() {
    this.term.focus();
  }

  get isAlive() {
    return this.started && !this.exited && !this.disposed;
  }

  /** Kills the shell (if still running) and frees xterm. */
  dispose(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.disposed = true;
    this.queue.dispose();
    const wasRunning = !this.exited;
    this.exited = true;
    this.term.dispose();
    this.host.remove();
    if (!wasRunning) return Promise.resolve();
    return this.ready
      .then((id) => (id === null ? undefined : terminalIpc.kill(id)))
      .catch(() => {});
  }
}

const sessions = new Map<number, TerminalSession>();

/** The session for a tab, created on first use. */
export function sessionFor(key: number, cwd: string | null, events: SessionEvents) {
  let session = sessions.get(key);
  if (!session) {
    session = new TerminalSession(cwd, events);
    sessions.set(key, session);
  }
  return session;
}

export const getSession = (key: number) => sessions.get(key);

export function disposeSession(key: number) {
  const session = sessions.get(key);
  sessions.delete(key);
  return session?.dispose() ?? Promise.resolve();
}

/** Kills every shell; runs before the window closes (Rust also kills on window destroy). */
export function disposeAllSessions() {
  const all = [...sessions.keys()].map(disposeSession);
  return Promise.all(all).then(() => undefined);
}

registerCloseGuard(disposeAllSessions);

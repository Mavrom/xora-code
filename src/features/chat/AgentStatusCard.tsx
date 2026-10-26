import { useId, useState, type ReactNode } from "react";
import {
  CircleAlert,
  Download,
  KeyRound,
  Loader,
  PlugZap,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AcpAuthMethod, AgentInfo } from "@/features/agents/types";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { Collapse } from "./Disclosure";

const NODE_URL = "https://nodejs.org/";

interface AgentStatusCardProps {
  agent: AgentInfo;
  onInstall: () => void;
  onAuthenticate: (methodId: string) => void;
  onRestart: () => void;
}

/**
 * What stands between the user and a working agent: Node or the adapter missing, an
 * install in progress, a sign-in, a crash. One card, one clear next step.
 */
export function AgentStatusCard({
  agent,
  onInstall,
  onAuthenticate,
  onRestart,
}: AgentStatusCardProps) {
  const name = agent.displayName;
  const { status } = agent;

  switch (status.state) {
    case "notInstalled":
      if (status.reason === "package-missing") {
        return (
          <Card
            icon={Download}
            title={`${name} bağlayıcısı kurulu değil`}
            body={`Xora, ${name} için resmi ACP bağlayıcısını uygulama klasörüne bir kez kurar. Hesabın ve ayarların değişmez.`}
            actions={
              <Button variant="primary" icon={Download} onClick={onInstall}>
                Kur
              </Button>
            }
          />
        );
      }
      return (
        <Card
          icon={CircleAlert}
          title={status.reason === "node-missing" ? "Node.js bulunamadı" : "Node.js sürümü eski"}
          body="Agent bağlayıcıları Node.js 22 veya üstüyle çalışır. Kurduktan sonra yeniden dene."
          actions={
            <>
              <Button variant="primary" onClick={() => void openUrl(NODE_URL)}>
                Node.js indir
              </Button>
              <Button variant="ghost" icon={RotateCcw} onClick={onRestart}>
                Yeniden dene
              </Button>
            </>
          }
        />
      );

    case "installing":
      return (
        <Card
          icon={Download}
          live
          title={`${name} kuruluyor…`}
          body="İlk kurulum bir dakika kadar sürebilir."
          footer={<Progress value={status.progress} />}
        />
      );

    case "starting":
      return <Card icon={PlugZap} live title={`${name} bağlanıyor…`} />;

    case "authRequired":
      return (
        <Card
          icon={KeyRound}
          title={`${name} hesabına giriş yap`}
          body={authHint(status.authMethods)}
          actions={status.authMethods.map((method, index) => (
            <Button
              key={method.id}
              variant={index === 0 ? "primary" : "secondary"}
              onClick={() => onAuthenticate(method.id)}
              title={method.description ?? undefined}
            >
              {method.name}
            </Button>
          ))}
        />
      );

    case "crashed":
      return (
        <Card
          icon={CircleAlert}
          tone="danger"
          title={`${name} beklenmedik şekilde kapandı`}
          body={status.code === null ? undefined : `Çıkış kodu ${status.code}.`}
          actions={
            <Button variant="primary" icon={RotateCcw} onClick={onRestart}>
              Yeniden başlat
            </Button>
          }
          footer={status.stderrTail.length > 0 ? <Details lines={status.stderrTail} /> : null}
        />
      );

    default:
      return null;
  }
}

function authHint(methods: AcpAuthMethod[]): string {
  return methods.some((m) => m.type === "terminal")
    ? "Açılan konsolda girişi tamamla; bitince sohbet kendiliğinden devam eder."
    : "Giriş tarayıcıda açılır. Xora hiçbir parolayı ya da anahtarı görmez.";
}

interface CardProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  /** In-progress state: the title shimmers and the icon turns slowly. */
  live?: boolean;
  tone?: "default" | "danger";
}

function Card({ icon: Icon, title, body, actions, footer, live, tone = "default" }: CardProps) {
  return (
    <section
      role={tone === "danger" ? "alert" : "status"}
      className="rounded-xl border border-border bg-surface p-3.5 transition-[opacity,translate] duration-base ease-out-quint starting:translate-y-1 starting:opacity-0"
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md border border-border bg-elevated shadow-well",
            tone === "danger" ? "text-danger" : "text-fg-muted",
          )}
        >
          {live ? (
            <Loader
              size={14}
              strokeWidth={1.75}
              aria-hidden
              className="animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none"
            />
          ) : (
            <Icon size={14} strokeWidth={1.75} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={cn("text-ui font-medium", live ? "shimmer" : "text-fg")}>{title}</p>
          {body && <p className="mt-0.5 text-xs text-balance text-fg-muted">{body}</p>}
          {actions && <div className="mt-3 flex flex-wrap gap-1.5">{actions}</div>}
          {footer}
        </div>
      </div>
    </section>
  );
}

/** Determinate when the installer reports progress, a slow sweep otherwise. */
function Progress({ value }: { value: number | null }) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label="Kurulum"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      className="mt-3 h-1 overflow-hidden rounded-full bg-elevated"
    >
      {percent === null ? (
        <div className="skeleton h-full w-full animate-skeleton" />
      ) : (
        <div
          className="h-full rounded-full bg-fg-muted transition-[width] duration-slow ease-out-quint"
          style={{ width: `${percent}%` }}
        />
      )}
    </div>
  );
}

/** The last stderr lines, folded away by default. */
function Details({ lines }: { lines: string[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="text-2xs text-fg-subtle underline-offset-2 transition-colors duration-fast hover:text-fg-muted hover:underline"
      >
        {open ? "Ayrıntıları gizle" : "Ayrıntılar"}
      </button>
      <Collapse open={open} id={id}>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-bg px-3 py-2 font-mono text-3xs leading-4 whitespace-pre-wrap text-fg-muted select-text">
          {lines.join("\n")}
        </pre>
      </Collapse>
    </div>
  );
}

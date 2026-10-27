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
import { authMethodLabel, subscriptionAuthMethods } from "@/features/agents/authMethods";
import type { AcpAuthMethod, AgentInfo } from "@/features/agents/types";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { Collapse } from "./Disclosure";
import { t } from "@/shared/i18n";

const NODE_URL = "https://nodejs.org/";

interface AgentStatusCardProps {
  agent: AgentInfo;
  /** Why the last sign-in attempt failed, shown until the next attempt. */
  authError?: string | null;
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
  authError = null,
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
            title={t("The {name} adapter is not installed", { name })}
            body={t(
              "Xora installs the official ACP adapter for {name} into its app folder, once. Your account and settings stay as they are.",
              { name },
            )}
            actions={
              <Button variant="primary" icon={Download} onClick={onInstall}>
                {t("Install")}
              </Button>
            }
          />
        );
      }
      return (
        <Card
          icon={CircleAlert}
          title={
            status.reason === "node-missing" ? t("Node.js not found") : t("Node.js is too old")
          }
          body={t("Agent adapters need Node.js 22 or newer. Install it, then try again.")}
          actions={
            <>
              <Button variant="primary" onClick={() => void openUrl(NODE_URL)}>
                {t("Download Node.js")}
              </Button>
              <Button variant="ghost" icon={RotateCcw} onClick={onRestart}>
                {t("Try again")}
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
          title={t("Installing {name}…", { name })}
          body={t("The first install can take about a minute.")}
          footer={<Progress value={status.progress} />}
        />
      );

    case "starting":
      return <Card icon={PlugZap} live title={t("Connecting to {name}…", { name })} />;

    case "authRequired": {
      const methods = subscriptionAuthMethods(agent.id, status.authMethods);
      return (
        <Card
          icon={KeyRound}
          title={t("Sign in to {name}", { name })}
          body={authHint(methods)}
          footer={
            authError ? (
              <p role="alert" className="mt-2.5 text-xs leading-relaxed text-danger">
                {authError}
              </p>
            ) : null
          }
          actions={methods.map((method, index) => (
            <Button
              key={method.id}
              variant={index === 0 ? "primary" : "secondary"}
              onClick={() => onAuthenticate(method.id)}
              title={method.description ?? undefined}
            >
              {authMethodLabel(method)}
            </Button>
          ))}
        />
      );
    }

    case "crashed":
      return (
        <Card
          icon={CircleAlert}
          tone="danger"
          title={t("{name} quit unexpectedly", { name })}
          body={status.code === null ? undefined : t("Exit code {code}.", { code: status.code })}
          actions={
            <Button variant="primary" icon={RotateCcw} onClick={onRestart}>
              {t("Restart")}
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
    ? t(
        "Finish signing in in the console that opened; the chat picks up on its own when you are done.",
      )
    : t("Sign-in opens in your browser. Xora never sees a password or key.");
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
      aria-label={t("Setup")}
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
        {open ? t("Hide details") : t("Details")}
      </button>
      <Collapse open={open} id={id}>
        <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-bg px-3 py-2 font-mono text-3xs leading-4 whitespace-pre-wrap text-fg-muted select-text">
          {lines.join("\n")}
        </pre>
      </Collapse>
    </div>
  );
}

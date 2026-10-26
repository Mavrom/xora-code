import { useEffect, useRef, useState } from "react";
import { homeDir } from "@tauri-apps/api/path";
import { Download, KeyRound, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/ui/cn";
import { useAccountsStore } from "../accountsStore";
import { CopyField } from "../controls/CopyField";
import { Segmented } from "../controls/Segmented";
import { SectionHeader, SettingGroup, SettingRow } from "../controls/SettingRow";
import { Toggle } from "../controls/Toggle";
import { settingsIpc, type ProviderStatus } from "../ipc";
import {
  PROVIDERS,
  providerState,
  shortenPath,
  SIGN_IN_LABEL,
  type ProviderInfo,
  type ProviderState,
} from "../providers";
import { useSettingsStore } from "../store";

export function AccountsSection() {
  const statuses = useAccountsStore((s) => s.statuses);
  const detecting = useAccountsStore((s) => s.detecting);
  const detectedAt = useAccountsStore((s) => s.detectedAt);
  const error = useAccountsStore((s) => s.error);
  const agent = useSettingsStore((s) => s.settings.agent);
  const update = useSettingsStore((s) => s.update);
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    void useAccountsStore.getState().detect();
    homeDir().then(setHome, () => setHome(null));
  }, []);

  const refresh = () => void useAccountsStore.getState().detect();
  const firstRun = detectedAt === null;

  return (
    <>
      <SectionHeader
        title="Hesaplar"
        description="Xora, bilgisayarınızdaki ajan CLI'larını kendi aboneliğinizle çalıştırır. Giriş bilgileri CLI'da kalır; Xora onları hiç okumaz."
        action={
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={refresh}
            disabled={detecting}
            className={cn(detecting && "[&>svg]:animate-spin")}
          >
            Yenile
          </Button>
        }
      />

      {error && (
        <p role="alert" className="mt-4 text-xs text-danger">
          Algılama başarısız: {error}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3" aria-busy={detecting}>
        {PROVIDERS.map((info) =>
          firstRun ? (
            <ProviderSkeleton key={info.id} info={info} />
          ) : (
            <ProviderCard
              key={info.id}
              info={info}
              status={statuses[info.id]}
              home={home}
              isDefault={agent.defaultAgent === info.id}
              onMakeDefault={() => update({ agent: { defaultAgent: info.id } })}
              onRefresh={refresh}
            />
          ),
        )}
      </div>

      <SettingGroup title="Varsayılan" className="mt-10">
        <SettingRow
          label="Varsayılan ajan"
          setting="agent.defaultAgent"
          description="Yeni sohbetler bu ajanla başlar."
          control={(id) => (
            <Segmented
              labelledBy={id}
              value={agent.defaultAgent}
              options={PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(defaultAgent) => update({ agent: { defaultAgent } })}
            />
          )}
        />
      </SettingGroup>

      <SettingGroup title="Claude Code">
        <SettingRow
          label="ANTHROPIC_API_KEY'i yok say"
          setting="agent.claudeIgnoreApiKey"
          description="Ortamda bir API anahtarı tanımlı olsa bile Claude Code aboneliğinizle çalışır."
          control={(id) => (
            <Toggle
              labelledBy={id}
              checked={agent.claudeIgnoreApiKey}
              onChange={(claudeIgnoreApiKey) => update({ agent: { claudeIgnoreApiKey } })}
            />
          )}
        />
      </SettingGroup>
    </>
  );
}

const STATE_LABEL: Record<ProviderState, string> = {
  ready: "Hazır",
  signedOut: "Giriş gerekli",
  missing: "Kurulu değil",
  unknown: "Durum bilinmiyor",
};

function StatusChip({ state }: { state: ProviderState }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-2xs font-medium",
        state === "ready"
          ? "border-border-strong bg-elevated text-fg"
          : "border-border text-fg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          state === "ready" && "bg-fg shadow-[0_0_8px_var(--color-fg)]",
          state === "signedOut" && "bg-warning",
          state === "missing" && "border border-fg-subtle",
          state === "unknown" && "bg-fg-subtle",
        )}
      />
      {STATE_LABEL[state]}
    </span>
  );
}

function ProviderMark({ info, dim }: { info: ProviderInfo; dim?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-md border border-border bg-bg font-mono text-xs font-semibold tracking-tight shadow-well",
        dim ? "text-fg-subtle" : "text-fg",
      )}
    >
      {info.mark}
    </span>
  );
}

interface ProviderCardProps {
  info: ProviderInfo;
  status: ProviderStatus | undefined;
  home: string | null;
  isDefault: boolean;
  onMakeDefault: () => void;
  onRefresh: () => void;
}

function ProviderCard({
  info,
  status,
  home,
  isDefault,
  onMakeDefault,
  onRefresh,
}: ProviderCardProps) {
  const state = providerState(status);
  const installed = state !== "missing";
  const [installOpen, setInstallOpen] = useState(!installed);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const awaitingFocus = useRef(false);

  // Coming back from the login console: check again so the card updates by itself.
  useEffect(() => {
    const onFocus = () => {
      if (!awaitingFocus.current) return;
      awaitingFocus.current = false;
      onRefresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [onRefresh]);

  const login = async () => {
    try {
      await settingsIpc.login(info.id);
      awaitingFocus.current = true;
      setNote({ text: `Konsol açıldı. ${info.loginHint}` });
    } catch (err) {
      setNote({ text: String(err), error: true });
    }
  };

  const signIn = status?.signIn ?? "unknown";
  const meta = installed
    ? [
        status?.version ? `v${status.version}` : "sürüm okunamadı",
        shortenPath(status?.path ?? "", home),
      ]
    : ["PATH üzerinde bulunamadı"];

  return (
    <article
      aria-label={info.name}
      className="overflow-hidden bg-surface rounded-lg border border-border transition-colors duration-base hover:border-border-strong"
    >
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <ProviderMark info={info} dim={!installed} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-ui font-medium text-fg">{info.name}</h3>
            <span className="text-2xs text-fg-subtle">{info.vendor}</span>
            {isDefault && (
              <span className="rounded-xs border border-border-strong px-1.5 text-3xs font-medium tracking-wide text-fg-muted uppercase">
                Varsayılan
              </span>
            )}
          </div>
          <p
            className="mt-0.5 truncate font-mono text-2xs text-fg-subtle"
            title={status?.path ?? undefined}
          >
            {meta.join("  ·  ")}
          </p>
        </div>
        <StatusChip state={state} />
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border bg-bg/40 px-4 py-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted">
          {signIn === "signedIn" ? (
            <ShieldCheck size={13} strokeWidth={1.75} className="shrink-0 text-fg" aria-hidden />
          ) : (
            <KeyRound
              size={13}
              strokeWidth={1.75}
              className="shrink-0 text-fg-subtle"
              aria-hidden
            />
          )}
          {SIGN_IN_LABEL[signIn]}
        </span>
        <div className="flex items-center gap-1.5">
          {installed && !isDefault && (
            <Button variant="ghost" size="sm" onClick={onMakeDefault}>
              Varsayılan yap
            </Button>
          )}
          {installed ? (
            <Button
              variant={signIn === "signedIn" ? "ghost" : "secondary"}
              size="sm"
              icon={LogIn}
              onClick={() => void login()}
            >
              {signIn === "signedIn" ? "Yeniden giriş" : "Giriş yap"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              aria-expanded={installOpen}
              onClick={() => setInstallOpen((o) => !o)}
            >
              Kur
            </Button>
          )}
        </div>
      </div>

      {!installed && installOpen && (
        <div className="border-t border-border px-4 py-3 transition-opacity duration-base starting:opacity-0">
          <CopyField value={info.install} label="Kurulum komutunu kopyala" />
          <p className="mt-2 text-2xs text-fg-subtle">
            Bir terminalde çalıştırın (Node.js 20+ gerekir), sonra Yenile'ye basın.
          </p>
        </div>
      )}

      {note && (
        <p
          role="status"
          className={cn(
            "border-t border-border px-4 py-2.5 text-xs text-pretty transition-opacity duration-base starting:opacity-0",
            note.error ? "text-danger" : "text-fg-muted",
          )}
        >
          {note.text}
        </p>
      )}
    </article>
  );
}

function ProviderSkeleton({ info }: { info: ProviderInfo }) {
  return (
    <div
      aria-label={`${info.name} algılanıyor`}
      className="flex items-center gap-3.5 bg-surface rounded-lg border border-border px-4 py-3.5"
    >
      <ProviderMark info={info} dim />
      <div className="flex-1">
        <div className="text-ui font-medium text-fg-muted">{info.name}</div>
        <div className="skeleton mt-1.5 h-2.5 w-48 animate-skeleton rounded-xs" />
      </div>
      <div className="skeleton h-6 w-20 animate-skeleton rounded-full" />
    </div>
  );
}

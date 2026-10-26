import { useEffect, useState } from "react";
import { getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/shared/ui/cn";
import { SettingGroup } from "../controls/SettingRow";

/** Placeholder until the public repository exists. */
export const REPO_URL = "https://github.com/xora-code/xora-code";

/** Main third-party pieces shipped in the app (runtime only). */
const LICENSES: { name: string; license: string }[] = [
  { name: "Tauri", license: "MIT / Apache-2.0" },
  { name: "React", license: "MIT" },
  { name: "Monaco Editor", license: "MIT" },
  { name: "Zustand", license: "MIT" },
  { name: "react-resizable-panels", license: "MIT" },
  { name: "Tailwind CSS", license: "MIT" },
  { name: "Lucide", license: "ISC" },
  { name: "Inter", license: "SIL OFL 1.1" },
  { name: "JetBrains Mono", license: "SIL OFL 1.1" },
];

function useVersions() {
  const [versions, setVersions] = useState<{ app: string; tauri: string } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([getVersion(), getTauriVersion()]).then(
      ([app, tauri]) => alive && setVersions({ app, tauri }),
      () => alive && setVersions(null),
    );
    return () => {
      alive = false;
    };
  }, []);
  return versions;
}

/** The app mark at hero size; same geometry as the title bar and assets/brand. */
function XoraLogo() {
  return (
    <svg viewBox="0 0 16 16" className="size-14" aria-hidden>
      <rect width="16" height="16" rx="3.5" className="fill-fg" />
      <g fill="none" strokeWidth={1.6} className="stroke-bg">
        <path d="M4.25 4.25 11.75 11.75" />
        <path d="M11.75 4.25 9.5 6.5M6.5 9.5 4.25 11.75" />
      </g>
    </svg>
  );
}

export function AboutSection() {
  const versions = useVersions();
  const [licensesOpen, setLicensesOpen] = useState(false);

  return (
    <>
      <div className="relative flex flex-col items-center border-b border-border pt-6 pb-10 text-center">
        <div
          aria-hidden
          className="hero-glow pointer-events-none absolute inset-x-0 -top-10 h-64"
        />
        <div className="relative rounded-[14px] shadow-[0_0_48px_-12px_var(--color-fg)]">
          <XoraLogo />
        </div>
        <h2 className="relative mt-5 text-title font-semibold text-fg">Xora Code</h2>
        <p className="relative mt-1 text-ui text-fg-muted">
          Açık kaynak, ajan öncelikli kod editörü.
        </p>
        <p className="relative mt-4 inline-flex h-6 items-center gap-2 rounded-full border border-border px-3 font-mono text-2xs text-fg-subtle tabular-nums">
          {versions ? (
            <>
              <span className="text-fg-muted">v{versions.app}</span>
              <span aria-hidden>·</span>
              <span>Tauri {versions.tauri}</span>
            </>
          ) : (
            "Sürüm okunuyor…"
          )}
        </p>
      </div>

      <SettingGroup>
        <InfoRow label="Lisans" value="MIT" />
        <button
          type="button"
          onClick={() => void openUrl(REPO_URL)}
          className="flex h-11 w-full items-center justify-between px-4 text-left transition-colors duration-fast hover:bg-hover/60 focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-subtle"
        >
          <span className="text-ui text-fg">Kaynak kodu</span>
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            GitHub
            <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
          </span>
        </button>
        <button
          type="button"
          aria-expanded={licensesOpen}
          onClick={() => setLicensesOpen((o) => !o)}
          className="flex h-11 w-full items-center justify-between px-4 text-left transition-colors duration-fast hover:bg-hover/60 focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-fg-subtle"
        >
          <span className="text-ui text-fg">Açık kaynak lisansları</span>
          <ChevronRight
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className={cn(
              "text-fg-subtle transition-transform duration-base ease-out-quint",
              licensesOpen && "rotate-90",
            )}
          />
        </button>
        {licensesOpen && (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-4 py-3.5 transition-opacity duration-base starting:opacity-0">
            {LICENSES.map((item) => (
              <li key={item.name} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-fg-muted">{item.name}</span>
                <span className="shrink-0 font-mono text-2xs text-fg-subtle">{item.license}</span>
              </li>
            ))}
          </ul>
        )}
      </SettingGroup>

      <p className="mt-8 text-center text-2xs text-fg-subtle">
        Xora Code katkıcıları tarafından MIT lisansıyla geliştirilir.
      </p>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-11 items-center justify-between px-4">
      <span className="text-ui text-fg">{label}</span>
      <span className="text-xs text-fg-muted">{value}</span>
    </div>
  );
}

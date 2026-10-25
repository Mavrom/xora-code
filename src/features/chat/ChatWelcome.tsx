import { useId } from "react";
import { Bug, FlaskConical, ScrollText, Sparkle, type LucideIcon } from "lucide-react";
import { IconWell } from "@/shared/ui/EmptyState";

interface Suggestion {
  icon: LucideIcon;
  label: string;
}

const SUGGESTIONS: Suggestion[] = [
  { icon: ScrollText, label: "Bu projeyi özetle" },
  { icon: Bug, label: "Bir hatayı ayıkla" },
  { icon: FlaskConical, label: "Test yaz" },
];

/** First thing the user sees in an empty conversation: one question, three ways in. */
export function ChatWelcome() {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="relative flex max-w-120 flex-col items-center text-center"
    >
      {/* A breath of light behind the headline; pure decoration. */}
      <div aria-hidden className="hero-glow pointer-events-none absolute -inset-x-24 -inset-y-16" />
      <IconWell icon={Sparkle} size="hero" className="relative mb-5" />
      <h2 id={titleId} className="relative text-title font-medium text-fg">
        Ne inşa ediyoruz?
      </h2>
      <p className="relative mt-1.5 text-ui text-balance text-fg-muted">
        Claude, Codex ve Gemini bağlantısı yakında.
      </p>
      <ul aria-label="Öneriler" className="relative mt-7 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map(({ icon: Icon, label }) => (
          <li key={label}>
            {/* Inert until agents land: dimmed, plain cursor, no hover response. */}
            <button
              type="button"
              disabled
              title="Agent bağlantısıyla birlikte açılacak"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-xs text-fg-muted disabled:cursor-default disabled:opacity-60"
            >
              <Icon size={14} strokeWidth={1.5} className="text-fg-subtle" aria-hidden />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

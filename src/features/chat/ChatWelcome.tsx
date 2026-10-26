import { useId, type ReactNode } from "react";
import { Bug, FlaskConical, ScrollText, type LucideIcon } from "lucide-react";

interface Suggestion {
  icon: LucideIcon;
  label: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  {
    icon: ScrollText,
    label: "Bu projeyi özetle",
    prompt: "Bu projeyi özetle: amacı, yapısı ve önemli dosyaları.",
  },
  { icon: Bug, label: "Bir hatayı ayıkla", prompt: "Şu hatayı ayıklamama yardım et: " },
  { icon: FlaskConical, label: "Test yaz", prompt: "Şu modül için test yaz: " },
];

interface ChatWelcomeProps {
  /** The hero composer (and its context row) sits between the headline and the suggestions. */
  children: ReactNode;
  onPick: (prompt: string) => void;
}

/** Empty chat: one headline, the big composer, and three quiet ways in. */
export function ChatWelcome({ children, onPick }: ChatWelcomeProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="relative flex flex-col">
      {/* A breath of light behind the headline; pure decoration. */}
      <div
        aria-hidden
        className="hero-glow pointer-events-none absolute -inset-x-16 -top-24 h-64"
      />
      <h2
        id={titleId}
        className="relative mb-6 text-center text-title font-medium text-fg [@media(max-height:620px)]:mb-4"
      >
        Ne inşa ediyoruz?
      </h2>
      <div className="relative">{children}</div>
      <ul
        aria-label="Öneriler"
        className="relative mt-3 flex flex-wrap justify-center gap-2 [@media(max-height:680px)]:hidden"
      >
        {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
          <li key={label}>
            <button
              type="button"
              // Keep focus where it is until the click lands; then the composer takes it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(prompt)}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-glass-border bg-glass px-3.5 text-xs text-fg-muted backdrop-blur-xl transition-[background-color,border-color,color] duration-fast ease-out-quint hover:border-border-strong hover:text-fg"
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

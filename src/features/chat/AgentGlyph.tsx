import type { AgentId } from "@/features/agents/types";
import { cn } from "@/shared/ui/cn";

interface AgentGlyphProps {
  agent: AgentId;
  size?: number;
  /** Draws the mark in the agent's own colour instead of the text colour. */
  tinted?: boolean;
  className?: string;
}

/** Each agent's colour, used for its mark in lists and the model chip. */
const AGENT_TINT: Record<AgentId, string> = {
  claude: "#d97757",
  codex: "#e8e8e8",
  gemini: "#7aa7f5",
};

/**
 * Marks that tell the three agents apart at a glance without borrowing their brand
 * logos: a burst for Claude, a hexagon for Codex, a four-point star for Gemini.
 */
export function AgentGlyph({ agent, size = 14, tinted, className }: AgentGlyphProps) {
  return (
    <svg
      style={tinted ? { color: AGENT_TINT[agent] } : undefined}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {agent === "claude" && (
        <path d="M8 2.25v11.5M2.25 8h11.5M3.93 3.93l8.14 8.14M12.07 3.93l-8.14 8.14" />
      )}
      {agent === "codex" && (
        <>
          <path d="M8 1.9 13.3 5v6L8 14.1 2.7 11V5Z" />
          <path d="M6.2 6.6 4.9 8l1.3 1.4M9.8 6.6 11.1 8 9.8 9.4" strokeWidth={1.3} />
        </>
      )}
      {agent === "gemini" && (
        <path
          d="M8 1.75c.45 3.3 2.95 5.8 6.25 6.25-3.3.45-5.8 2.95-6.25 6.25C7.55 10.95 5.05 8.45 1.75 8 5.05 7.55 7.55 5.05 8 1.75Z"
          fill="currentColor"
          stroke="none"
        />
      )}
    </svg>
  );
}

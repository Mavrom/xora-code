import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { t } from "@/shared/i18n";

interface ErrorBoundaryProps {
  /** What failed, for the message ("Sohbet", "Editör"). */
  area: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Bumped by "Yeniden dene" so the area mounts fresh. */
  attempt: number;
}

/**
 * Keeps one area's crash to that area: the rest of the window keeps working, and the area
 * shows what went wrong with a retry (a fresh mount) instead of the whole app going black.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`${this.props.area} crashed`, error, info.componentStack);
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    const { error, attempt } = this.state;
    if (!error) return <ErrorBoundaryKey key={attempt}>{this.props.children}</ErrorBoundaryKey>;
    return (
      <div role="alert" className="grid h-full place-items-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-warning">
            <TriangleAlert size={18} strokeWidth={1.75} aria-hidden />
          </span>
          <p className="text-ui font-medium text-fg">
            {t("{area} ran into an error", { area: this.props.area })}
          </p>
          <p className="max-h-24 overflow-auto font-mono text-2xs break-all text-fg-subtle select-text">
            {error.message}
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white/[0.04] px-3 text-xs text-fg transition-colors duration-fast hover:bg-white/[0.08]"
          >
            <RotateCcw size={13} strokeWidth={1.75} aria-hidden />
            {t("Try again")}
          </button>
        </div>
      </div>
    );
  }
}

/** A plain wrapper whose `key` remounts the children on retry. */
function ErrorBoundaryKey({ children }: { children: ReactNode }) {
  return children;
}

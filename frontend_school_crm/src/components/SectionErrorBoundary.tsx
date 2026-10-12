import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  /** Optional human label shown in the error message ("Recent activity", "Chart", …). */
  label?: string;
  /** Custom fallback UI. If omitted, a compact inline card is rendered. */
  fallback?: React.ReactNode;
  /** Hook to forward errors to logging (Sentry, etc.). */
  onError?: (error: Error, info: React.ErrorInfo) => void;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * SectionErrorBoundary — wraps a single page section so a render error in one
 * widget does not blank out the whole page (in contrast to the root
 * ErrorBoundary which takes over the entire viewport).
 *
 * Usage:
 *   <SectionErrorBoundary label="Recent activity">
 *     <RecentActivityFeed entries={...} />
 *   </SectionErrorBoundary>
 */
export class SectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[SectionErrorBoundary${this.props.label ? ` · ${this.props.label}` : ""}] Render error:`,
      error,
      info.componentStack
    );
    this.props.onError?.(error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <Card className="border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10">
        <CardContent className="p-6 flex flex-col items-center text-center">
          <AlertCircle className="w-7 h-7 text-red-500 mb-2" />
          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
            {this.props.label
              ? `${this.props.label} failed to load`
              : "This section failed to load"}
          </p>
          {this.state.error?.message && (
            <p className="font-mono text-[11px] text-red-600 dark:text-red-400 mt-1.5 max-w-md break-all">
              {this.state.error.message}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={this.handleRetry}
            className="mt-4 gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }
}

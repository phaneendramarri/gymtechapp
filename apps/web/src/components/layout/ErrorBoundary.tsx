import React, { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Called when error is logged (useful for telemetry) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  children: ReactNode;
}

/**
 * M-11: Consistent error boundary for all lazy-loaded page chunks.
 * Catches rendering errors in child components and displays a clean
 * recovery UI instead of a blank screen / crash.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
    // Log to console in development; wire to your error reporting service here.
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              This page encountered an unexpected error. Try reloading, or contact support if the problem persists.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={this.handleReload}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Reload page
            </Button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-destructive/70 bg-destructive/5 p-3 rounded-md max-w-lg overflow-x-auto">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

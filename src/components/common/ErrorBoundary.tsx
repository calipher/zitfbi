import React from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  scope?: 'app' | 'module' | 'widget';
  moduleName?: string;
  userEmail?: string;
  userRole?: string;
  onReset?: () => void;
  onNavigateSafe?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  showDetails: boolean;
  reportStatus: 'idle' | 'sent' | 'failed';
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
      showDetails: false,
      reportStatus: 'idle',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const componentStack = errorInfo?.componentStack || '';
    this.setState({ componentStack });
    void this.reportErrorToServer(error, componentStack);
  }

  private async reportErrorToServer(error: Error, componentStack: string): Promise<void> {
    if (typeof fetch !== 'function') return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('zitf_auth_token') : null;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch {
        // ignore storage errors
      }
      const res = await fetch('/api/system/client-errors', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          scope: this.props.scope || 'module',
          moduleName: this.props.moduleName || 'Active Workspace',
          message: error?.message || 'Unhandled React exception',
          stackPreview: error?.stack || '',
          componentStackPreview: componentStack,
          userEmail: this.props.userEmail,
          userRole: this.props.userRole,
          urlPath: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
        }),
      });
      this.setState({ reportStatus: res.ok ? 'sent' : 'failed' });
    } catch {
      this.setState({ reportStatus: 'failed' });
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: '',
      showDetails: false,
      reportStatus: 'idle',
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleNavigateSafe = (): void => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: '',
      showDetails: false,
      reportStatus: 'idle',
    });
    if (this.props.onNavigateSafe) {
      this.props.onNavigateSafe();
    }
  };

  handleReloadApp = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const scope = this.props.scope || 'module';
    const moduleLabel = this.props.moduleName || 'Dashboard View';
    const errMsg = this.state.error?.message || 'An unexpected rendering failure occurred.';

    if (scope === 'widget') {
      return (
        <div
          role="alert"
          className="bg-white border border-rose-200 rounded-xl p-4 text-xs text-slate-800 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <div className="font-semibold text-slate-900">
                {moduleLabel} encountered a display error
              </div>
              <p className="text-slate-600 break-words">{errMsg}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">
              {this.state.reportStatus === 'sent'
                ? 'Incident recorded to server error log'
                : 'Isolated component boundary active'}
            </span>
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Widget</span>
            </button>
          </div>
        </div>
      );
    }

    const outerWrapClass =
      scope === 'app'
        ? 'min-h-screen bg-slate-50 flex items-center justify-center p-6'
        : 'py-8 px-4 flex items-center justify-center';

    return (
      <div role="alert" className={outerWrapClass}>
        <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-5 text-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>Fault Isolation Boundary</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-700">{moduleLabel}</span>
                {this.state.reportStatus === 'sent' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700 font-medium">Logged to SQLite Warehouse</span>
                  </>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {scope === 'app'
                  ? 'Platform Interface Interrupted'
                  : `Unable to render ${moduleLabel}`}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                This error has been contained to prevent losing your session or corrupting warehouse data. You can retry rendering or return to a safe workspace.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs font-mono text-rose-800 break-words">
            {errMsg}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Retry Module</span>
            </button>

            {this.props.onNavigateSafe && (
              <button
                type="button"
                onClick={this.handleNavigateSafe}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5 text-slate-600" />
                <span>Return to Safe Home</span>
              </button>
            )}

            <button
              type="button"
              onClick={this.handleReloadApp}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reload Application</span>
            </button>
          </div>

          {(this.state.error?.stack || this.state.componentStack) && (
            <div className="border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                {this.state.showDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                <span>{this.state.showDetails ? 'Hide Technical Diagnostics' : 'View Technical Diagnostics'}</span>
              </button>

              {this.state.showDetails && (
                <pre className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {this.state.error?.stack}
                  {this.state.componentStack ? `\n\nComponent Stack:${this.state.componentStack}` : ''}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

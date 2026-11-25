import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('JR13 SAVINGS ErrorBoundary:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#060B16] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#0B1324] border border-red-500/30 rounded-2xl p-6 space-y-4">
            <h1 className="font-display text-xl font-bold text-slate-100">
              Session Safeguard Triggered
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              JR13 SAVINGS paused this view to protect ledger consistency. Please reload or reset
              your workspace session.
            </p>
            <pre className="text-xs font-mono text-red-300 bg-[#060B16] border border-slate-800 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#060B16] font-semibold text-sm hover:bg-[#E5C158] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

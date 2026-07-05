import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-bg px-6 text-center">
          <div className="w-16 h-16 bg-red-400/10 rounded-full flex items-center justify-center mb-5">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--red-400, #f87171)"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-fg mb-2">Something went wrong</h2>
          <p className="text-fg/50 text-sm max-w-xs mb-6">
            An unexpected error occurred. Try reloading the app.
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="bg-accent text-on-accent rounded-xl px-6 py-2.5 font-semibold hover:bg-accent-hover transition-colors"
          >
            Reload
          </button>
          <p className="text-fg/30 text-xs mt-4 max-w-sm break-all">
            {this.state.error.message}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
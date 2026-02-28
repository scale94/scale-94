import React from 'react';

/**
 * ErrorBoundary — catches render errors in the component tree
 * and shows a styled "KERNEL_PANIC" screen instead of a blank crash.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }

  handleReboot = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black font-mono flex items-center justify-center p-8">
          <div className="border border-red-500/50 bg-black/80 p-8 max-w-lg w-full text-center">
            <div className="text-red-400 text-xl font-bold mb-2 tracking-widest uppercase">
              KERNEL_PANIC
            </div>
            <div className="text-fuchsia-400 text-xs mb-6 tracking-wide">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </div>
            <button
              onClick={this.handleReboot}
              className="text-cyan-400 border border-cyan-500/50 px-6 py-2 text-xs uppercase tracking-widest hover:bg-cyan-900/20 transition-colors"
            >
              REBOOT
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

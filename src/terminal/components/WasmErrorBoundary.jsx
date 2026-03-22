// WasmErrorBoundary.jsx — catches WASM/canvas init failures gracefully
// Wraps any tab that depends on scale94_kernels.wasm. On error, renders a
// minimal fallback instead of crashing the whole application shell.

import React from 'react';

export class WasmErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Surface to console with context so it's easy to debug in devtools
    console.error('[WasmErrorBoundary]', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isWasm = error?.message?.includes('wasm') ||
                   error?.message?.includes('WebAssembly') ||
                   error?.message?.includes('scale94');

    return (
      <div
        className="flex flex-col items-center justify-center min-h-[320px] gap-4 select-none"
        style={{ color: 'rgba(251,191,36,0.6)' }}
      >
        <div className="text-3xl font-bold tracking-widest font-mono">
          {isWasm ? '⌀ WASM FAULT' : '⌀ RENDER FAULT'}
        </div>
        <div
          className="text-xs font-mono max-w-md text-center leading-relaxed"
          style={{ color: 'rgba(251,191,36,0.35)' }}
        >
          {isWasm
            ? 'WebAssembly kernel failed to initialize. Your browser may not support WASM, or the binary failed to fetch.'
            : 'Component render error. Check console for details.'}
        </div>
        <div
          className="text-xs font-mono px-3 py-1 rounded border border-amber-900/30"
          style={{ color: 'rgba(251,191,36,0.25)' }}
        >
          {error?.message ?? 'unknown error'}
        </div>
        <button
          onClick={this.handleRetry}
          className="text-xs font-mono px-4 py-2 border border-amber-700/40 rounded-sm hover:border-amber-500/60 transition-colors"
          style={{ color: 'rgba(251,191,36,0.6)' }}
        >
          ↻ retry
        </button>
      </div>
    );
  }
}

export default WasmErrorBoundary;

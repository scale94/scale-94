import { useState, useEffect } from 'react';
import { loadWasm } from '../../wasm/wasmSingleton';

export default function KineticStatecraftPanel() {
  const [sanction,   setSanction]   = useState(6);
  const [grid,       setGrid]       = useState(0.4);
  const [propaganda, setPropaganda] = useState(0.7);
  const [output,     setOutput]     = useState(null);
  const [running,    setRunning]    = useState(false);
  const [mod,        setMod]        = useState(null);

  // Load WASM on mount
  useEffect(() => {
    loadWasm().then(setMod).catch(console.error);
  }, []);

  // Run simulation whenever inputs or mod change
  useEffect(() => {
    if (!mod) return;
    setRunning(true);
    const result = mod.boot_geopolitical_kinetics(sanction, grid, propaganda);
    setRunning(false);
    setOutput(result);
  }, [sanction, grid, propaganda, mod]);

  return (
    <div className="border border-red-900/30 rounded-lg bg-black/40 mt-6 overflow-hidden max-w-4xl mx-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-red-900/20">
        <span className="text-[10px] font-mono font-bold text-red-400/80 uppercase tracking-widest">
          ◈ REGIME STABILITY SIMULATION
        </span>
      </div>

      {/* Sliders */}
      <div className="px-4 py-4 border-b border-zinc-600/[0.04] space-y-4">
        {/* SANCTION PRESSURE */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
              SANCTION PRESSURE
            </span>
            <span className="text-[9px] font-mono text-red-300/70">
              {sanction.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={sanction}
            onChange={e => setSanction(parseFloat(e.target.value))}
            style={{ accentColor: '#ef4444' }}
            className="w-full"
          />
        </div>

        {/* GRID RESILIENCE */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
              GRID RESILIENCE
            </span>
            <span className="text-[9px] font-mono text-red-300/70">
              {grid.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={grid}
            onChange={e => setGrid(parseFloat(e.target.value))}
            style={{ accentColor: '#ef4444' }}
            className="w-full"
          />
        </div>

        {/* PROPAGANDA INDEX */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
              PROPAGANDA INDEX
            </span>
            <span className="text-[9px] font-mono text-red-300/70">
              {propaganda.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={propaganda}
            onChange={e => setPropaganda(parseFloat(e.target.value))}
            style={{ accentColor: '#ef4444' }}
            className="w-full"
          />
        </div>
      </div>

      {/* Output */}
      <div
        className="px-4 py-4 font-mono text-[8px] leading-relaxed text-green-400/70 whitespace-pre-wrap"
        style={{ minHeight: 120 }}
      >
        {running
          ? <span className="text-red-400">RUNNING...</span>
          : output}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-zinc-600/[0.04] text-[6.5px] font-mono text-zinc-600">
        WASM · boot_geopolitical_kinetics · kinetic-statecraft-kernel-1.0
      </div>
    </div>
  );
}

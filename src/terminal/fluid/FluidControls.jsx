import { useRef, useCallback } from 'react';

// ── Slider ─────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, onChange, format }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const pct = ((value - min) / (max - min)) * 100;

  const updateFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    // Snap to step
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  }, [min, max, step, onChange]);

  const handlePointerDown = useCallback((e) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromEvent(e);
  }, [updateFromEvent]);

  const handlePointerMove = useCallback((e) => {
    if (dragging.current) updateFromEvent(e);
  }, [updateFromEvent]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[8px] font-mono text-indigo-400/60 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-mono text-indigo-300">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <div
        ref={trackRef}
        className="w-full h-[4px] bg-indigo-950/50 rounded-full relative cursor-pointer"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Fill */}
        <div
          className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full"
          style={{ width: `${pct}%`, boxShadow: '0 0 8px rgba(99,102,241,0.4)' }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-400 pointer-events-none"
          style={{ left: `${pct}%`, transform: `translate(-50%, -50%)`, boxShadow: '0 0 8px rgba(99,102,241,0.6)' }}
        />
      </div>
    </div>
  );
}

// ── FluidControls ──────────────────────────────────────────────────────────
export default function FluidControls({ params, onChange, fps, particleCount }) {
  const set = (key) => (val) => onChange({ ...params, [key]: val });

  return (
    <div className="space-y-3">
      <div className="border border-white/[0.05] rounded-lg bg-black/30 p-3 space-y-3">
        <Slider label="Flow Velocity"    value={params.speed}      min={0.01} max={0.20} step={0.005} onChange={set('speed')} />
        <Slider label="Current Drift"    value={params.curlAmp}    min={0.00} max={0.20} step={0.005} onChange={set('curlAmp')} />
        <Slider label="Luminance Density" value={params.density}   min={2000} max={12000} step={500}  onChange={set('density')} format={(v) => Math.round(v).toLocaleString()} />
        <Slider label="Signal Depth"     value={params.tubeRadius} min={0.10} max={0.40} step={0.01}  onChange={set('tubeRadius')} />
        <Slider label="Chromatic Drift"  value={params.chromatic}  min={-1.0} max={1.0}  step={0.05}  onChange={set('chromatic')} format={(v) => (v >= 0 ? '+' : '') + v.toFixed(2)} />
      </div>

      {/* System status readout */}
      <div className="mt-2 pt-3 border-t border-white/[0.05]">
        <div className="text-[7px] font-mono text-white/20 uppercase tracking-widest mb-2">
          ── SYSTEM STATUS ──────────
        </div>
        <div className="space-y-0.5">
          {[
            ['FPS', fps],
            ['PARTICLES', particleCount.toLocaleString()],
            ['DRAW CALLS', '2'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-[8px] font-mono">
              <span className="text-white/20">{label}</span>
              <span className="text-indigo-400/40">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

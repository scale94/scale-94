import { useRef, useCallback } from 'react';

function Slider({ label, value, min, max, step, onChange, format }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const pct = ((value - min) / (max - min)) * 100;

  const updateFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const snapped = Math.round((min + ratio * (max - min)) / step) * step;
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

  const handlePointerUp = useCallback(() => { dragging.current = false; }, []);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] font-mono text-amber-400/60 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-mono text-amber-300">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <div
        className="w-full flex items-center cursor-pointer"
        style={{ touchAction: 'none', height: '44px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div ref={trackRef} className="w-full h-[4px] bg-amber-950/50 rounded-full relative">
          <div
            className="absolute left-0 top-0 h-full bg-amber-600 rounded-full"
            style={{ width: `${pct}%`, boxShadow: '0 0 8px rgba(180,83,9,0.45)' }}
          />
          <div
            className="absolute top-1/2 w-4 h-4 rounded-full bg-amber-400 pointer-events-none"
            style={{ left: `${pct}%`, transform: 'translate(-50%,-50%)', boxShadow: '0 0 8px rgba(251,191,36,0.5)' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function EarthControls({ params, onChange, fps, particleCount }) {
  const set = (key) => (val) => onChange({ ...params, [key]: val });

  return (
    <div className="space-y-3">
      <div className="border border-amber-900/20 rounded-lg bg-black/30 p-3 space-y-3">
        <Slider label="Settle Velocity"  value={params.speed}         min={0.03} max={0.20} step={0.005} onChange={set('speed')} />
        <Slider label="Turbulence"       value={params.turbulence}    min={0.05} max={1.0}  step={0.01}  onChange={set('turbulence')} />
        <Slider label="Erupt Strength"   value={params.eruptStrength} min={0.1}  max={2.0}  step={0.05}  onChange={set('eruptStrength')} />
        <Slider label="Particle Count"   value={params.density}       min={2000} max={12000} step={500}  onChange={set('density')} format={(v) => Math.round(v).toLocaleString()} />
      </div>

      <div className="mt-4 pt-3 border-t border-amber-900/20">
        <div className="text-[9px] font-mono text-amber-900/60 uppercase tracking-widest mb-2">
          ── GEOLOGICAL STATUS ──────
        </div>
        <div className="space-y-0.5">
          {[
            ['FPS',       fps > 0 ? fps : '--'],
            ['PARTICLES', particleCount.toLocaleString()],
            ['ERUPTIONS', Math.round(particleCount * 0.10).toLocaleString()],
            ['DRAW CALLS','2'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-[10px] font-mono">
              <span className="text-amber-900/50">{label}</span>
              <span className={label === 'FPS'
                ? fps >= 50 ? 'text-amber-300/60' : fps >= 30 ? 'text-yellow-500/60' : fps > 0 ? 'text-red-500/60' : 'text-amber-900/40'
                : 'text-amber-600/40'
              }>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 pt-3 border-t border-amber-900/20">
        <div className="text-[9px] font-mono text-amber-900/60 uppercase tracking-widest mb-2">
          ── LITHOSPHERIC SPECTRUM ──
        </div>
        <div
          className="h-[6px] w-full rounded-full"
          style={{
            background: 'linear-gradient(to right, #e8ddc8, #d4905a, #c06820, #aa4422, #882211, #383030, #101010)',
            boxShadow: '0 0 6px rgba(180,83,9,0.2)',
          }}
        />
        <div className="flex justify-between mt-1 text-[8px] font-mono text-amber-900/50">
          <span>chalk</span>
          <span>sandstone</span>
          <span>basalt</span>
        </div>
      </div>
    </div>
  );
}

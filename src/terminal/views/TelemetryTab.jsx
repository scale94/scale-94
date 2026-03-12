import React, { useState, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';

// Colour scale: cold (#0f2027) → warm (#ff8c00) → hot (#ffff00)
function heatColour(intensity) {
  if (intensity <= 0) return '#0f2027';
  if (intensity >= 1) return '#ffff00';
  if (intensity < 0.5) {
    const t = intensity * 2;
    return `rgb(${Math.round(15 + t * 200)}, ${Math.round(32 + t * 100)}, ${Math.round(39 + t * 0)})`;
  }
  const t = (intensity - 0.5) * 2;
  return `rgb(${Math.round(215 + t * 40)}, ${Math.round(132 + t * 83)}, ${Math.round(0)})`;
}

function ParamHeatmap({ paramName, buckets }) {
  if (!buckets?.length) return null;
  const max = Math.max(...buckets.map(b => b.count));
  return (
    <div className="mb-4">
      <div className="text-[9px] font-bold tracking-widest text-cyan-600/60 uppercase mb-1.5">{paramName}</div>
      <div className="flex gap-px flex-wrap">
        {buckets.map(({ value, count }) => {
          const intensity = max > 0 ? count / max : 0;
          const bg = heatColour(intensity);
          return (
            <div
              key={value}
              title={`${paramName}=${value}  ·  ${count} run${count !== 1 ? 's' : ''}`}
              style={{ backgroundColor: bg, width: 14, height: 14, borderRadius: 2, flexShrink: 0 }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px] text-cyan-900/50">{buckets[0]?.value}</span>
        <span className="text-[8px] text-cyan-900/50">{buckets[buckets.length - 1]?.value}</span>
      </div>
    </div>
  );
}

function KernelDetail({ kernelId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/telemetry/read?kernel=${encodeURIComponent(kernelId)}`)
      .then(r => r.json())
      .then(setData)
      .catch(err => setError(err.message));
  }, [kernelId]);

  return (
    <div>
      <button
        onClick={onBack}
        className="text-[9px] font-bold tracking-widest text-cyan-600 hover:text-cyan-300 uppercase mb-4 flex items-center gap-1"
      >
        ← back
      </button>
      <div className="text-xs font-bold text-cyan-400 tracking-widest mb-1">{kernelId}</div>
      {data && <div className="text-[9px] text-cyan-700 mb-4">{data.runs} total run{data.runs !== 1 ? 's' : ''}</div>}
      {error && <div className="text-[10px] text-red-500/60">error: {error}</div>}
      {data && Object.keys(data.params).length === 0 && (
        <div className="text-[10px] text-cyan-900/50">no parameter data recorded yet</div>
      )}
      {data && Object.entries(data.params).map(([name, buckets]) => (
        <ParamHeatmap key={name} paramName={name} buckets={buckets} />
      ))}
    </div>
  );
}

export default function TelemetryTab() {
  const [index, setIndex]       = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);

  const loadIndex = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/telemetry/read')
      .then(r => r.json())
      .then(d => { setIndex(d.kernels ?? []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => { loadIndex(); }, [loadIndex]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col font-mono" style={{ height: 'calc(100dvh - 200px)', minHeight: '540px' }}>

      <div className="flex items-center gap-3 mb-5 shrink-0">
        <Activity className="w-4 h-4 text-amber-400" style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.7))' }} />
        <span className="text-sm font-bold tracking-widest text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(90deg, #FF8C00, #FFD700, #FFFF00)', backgroundSize: '200% auto' }}>
          /sys/telemetry
        </span>
        <span className="text-[9px] text-cyan-900/40 tracking-widest ml-auto">kernel parameter heatmap</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
        {selected ? (
          <KernelDetail kernelId={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            {loading && (
              <div className="text-[10px] text-cyan-900/50 tracking-widest animate-pulse">loading telemetry...</div>
            )}
            {error && (
              <div className="text-[10px] text-red-500/60">
                KV unavailable — configure KV_REST_API_URL + KV_REST_API_TOKEN in Vercel dashboard.
              </div>
            )}
            {index?.length === 0 && !loading && (
              <div className="text-[10px] text-cyan-900/40 tracking-widest">
                no data yet — run a kernel with parameters to begin logging.
              </div>
            )}
            {index?.map(({ id, runs }) => (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className="w-full flex items-center justify-between px-3 py-2.5 mb-1.5 border border-cyan-900/20 rounded hover:border-amber-600/40 hover:bg-amber-900/5 transition-all group text-left"
              >
                <span className="text-[10px] font-bold text-cyan-600/70 group-hover:text-amber-400 tracking-wide truncate">{id}</span>
                <span className="text-[9px] text-cyan-900/50 shrink-0 ml-3">{runs} run{runs !== 1 ? 's' : ''}</span>
              </button>
            ))}
          </>
        )}
      </div>

    </div>
  );
}

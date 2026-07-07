import React from 'react';
import { useInverseEngine } from '../../hooks/useInverseEngine';
import { ENGINE_TUNING, postUrl } from '../../lib/inverseEngine';

// ── Inverse Extinction Engine — TRANSMISSION live section ────────────────────
// Subthreshold harvest display: bandwidth gauge, signal cards, harvest status.
// The API-restraint policy is part of the display: public AppView only,
// 3 probes per 8 h window, GraphTracks untouched.

const relTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const bandLabel = (b) =>
  b >= 75 ? 'COHERENT' : b >= 45 ? 'STRONG' : b >= 20 ? 'CARRIER' : 'FAINT';

const cacheAge = (harvestedAt) => {
  const h = Math.floor((Date.now() - harvestedAt) / 3600000);
  return h < 1 ? '<1h' : `${h}h`;
};

const InverseEngine = () => {
  const { state, status, runHarvest } = useInverseEngine();

  const H = state?.healingIndex ?? 0;
  const S = state?.sicknessCap ?? 0;
  const B = state?.bandwidth ?? 0;
  const signals = (state?.signals ?? []).slice(0, ENGINE_TUNING.SIGNAL_DISPLAY_COUNT);

  return (
    <div className="mb-10">
      {/* Section header */}
      <div className="text-[9px] font-bold tracking-[0.3em] text-fuchsia-400/50 uppercase mb-3 border-b border-fuchsia-900/20 pb-2 flex items-center gap-2">
        <span className="text-fuchsia-500/70" style={{ animation: 'tx-iconPulse 2.5s ease-in-out infinite', display: 'inline-block' }}>◉</span>
        INVERSE_EXTINCTION_ENGINE // SUBTHRESHOLD HARVEST
        <span className="ml-auto flex items-center gap-2 normal-case tracking-normal font-mono text-fuchsia-400/25">
          {status === 'harvesting' && <span className="animate-pulse text-fuchsia-400/60">HARVESTING…</span>}
          {status === 'stale' && <span className="text-amber-500/60">STALE</span>}
          {status === 'live' && <span className="text-fuchsia-400/50">LIVE</span>}
        </span>
      </div>

      {/* Idle / error state — no cache, nothing harvested */}
      {!state && (
        <div className="border border-fuchsia-900/25 bg-black/40 px-4 py-6 text-center">
          <div className="text-[10px] font-bold tracking-widest text-fuchsia-800 uppercase mb-3">
            [ SIGNAL BELOW THRESHOLD — AWAITING HARVEST WINDOW ]
          </div>
          {status === 'error' && (
            <button
              onClick={runHarvest}
              className="text-[9px] font-bold tracking-widest uppercase text-fuchsia-400/60 border border-fuchsia-900/40 px-3 py-1.5 hover:text-fuchsia-300 hover:border-fuchsia-500/40 transition-colors"
            >
              ⌖ RETRY HARVEST
            </button>
          )}
        </div>
      )}

      {state && (
        <>
          {/* Bandwidth gauge */}
          <div className="border border-fuchsia-900/25 bg-black/40 p-4 mb-4">
            <div className="flex items-center justify-between mb-2 text-[9px] font-bold tracking-widest uppercase">
              <span className="text-fuchsia-400/50">TRANSMISSION_BANDWIDTH</span>
              <span className="text-fuchsia-300/80 font-mono">
                {B.toFixed(1)} / 100 — SIGNAL: {bandLabel(B)}
              </span>
            </div>
            <div className="h-2 bg-fuchsia-950/30 relative overflow-hidden">
              {/* Healing index — full potential */}
              <div className="absolute inset-y-0 left-0 bg-fuchsia-900/40 transition-all duration-700"
                style={{ width: `${H}%` }} />
              {/* Throttled bandwidth — what the sickness cap lets through */}
              <div className="absolute inset-y-0 left-0 transition-all duration-700"
                style={{ width: `${B}%`, background: 'linear-gradient(90deg, #a21caf, #d946ef)', boxShadow: '0 0 10px rgba(217,70,239,0.5)' }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-[8px] font-mono text-fuchsia-400/30 tracking-wider">
              <span>HEALING_INDEX {H.toFixed(1)}</span>
              <span className={S > 0.4 ? 'text-amber-500/60' : ''}>
                SICKNESS_CAP {(S * 100).toFixed(0)}% {S > 0 ? `· throttling −${(H - B).toFixed(1)}` : '· pipe fully open'}
              </span>
            </div>
          </div>

          {/* Signal cards */}
          {signals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {signals.map((s, i) => (
                <div key={s.uri}
                  className="border border-fuchsia-900/25 bg-black/40 p-4 hover:border-fuchsia-500/40 hover:bg-fuchsia-950/10 transition-all flex flex-col"
                  style={{ animation: `tx-cardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both` }}
                >
                  <div className="flex items-center justify-between mb-2 text-[9px] font-mono tracking-widest uppercase">
                    <span className="text-fuchsia-900">SUBTHRESHOLD_{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-fuchsia-400/25">{s.createdAt ? relTime(s.createdAt) : ''}</span>
                  </div>
                  <p className="text-[11px] text-fuchsia-200/60 leading-relaxed mb-3 flex-1 whitespace-pre-wrap">
                    {s.text}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-fuchsia-900/15 text-[9px] font-mono">
                    <span className="text-fuchsia-400/35 truncate">@{s.handle}</span>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-fuchsia-400/25" title="healing score × inverse-virality weight">
                        ⌁{s.healingScore} ×{s.weight.toFixed(2)}
                      </span>
                      <span className="text-fuchsia-400/20">♡{s.likes} ⟳{s.reposts}</span>
                      <a href={postUrl(s)} target="_blank" rel="noreferrer"
                        className="text-fuchsia-400/40 hover:text-fuchsia-300 border border-fuchsia-900/30 hover:border-fuchsia-500/40 px-1.5 py-0.5 uppercase tracking-widest transition-all">
                        ↗
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Harvest status line — the restraint policy is part of the display */}
          <div className="text-[8px] font-mono text-fuchsia-400/25 tracking-wider flex flex-wrap gap-x-4 gap-y-1">
            <span>HARVESTED {cacheAge(state.harvestedAt)} AGO</span>
            <span>PROBES: {(state.probesUsed ?? []).join(' · ')}</span>
            <span>NEXT WINDOW: {Math.max(0, Math.ceil((state.harvestedAt + ENGINE_TUNING.TTL_MS - Date.now()) / 3600000))}h</span>
            <span className="text-fuchsia-400/35">public AppView only · 3 calls / 8h · GraphTracks untouched</span>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(InverseEngine);

// CastleCard.jsx — One fairy-tale castle. Active-phase card glows.

import { buildStatusLine } from './castles';

export default function CastleCard({ castle, isActive, mercury, canvas }) {
  const status = mercury ? buildStatusLine(castle, mercury, canvas) : '—';

  return (
    <div
      className="border rounded-lg p-4 transition-all duration-500 relative overflow-hidden"
      style={{
        borderColor: isActive ? 'rgba(192,192,192,0.5)' : 'rgba(192,192,192,0.08)',
        background:  isActive ? 'rgba(192,192,192,0.03)' : 'rgba(0,0,0,0.4)',
        opacity:     isActive ? 1 : 0.45,
        animation:   isActive ? 'mc-castleBreath 6s ease-in-out infinite' : 'none',
      }}
    >
      <style>{`
        @keyframes mc-castleBreath {
          0%, 100% { box-shadow: 0 0 8px rgba(192,192,192,0.04); }
          50%      { box-shadow: 0 0 28px rgba(192,192,192,0.16); }
        }
      `}</style>

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">{castle.glyph}</span>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
            {castle.phase} · {castle.phaseLabel}
          </span>
        </div>
        {isActive && (
          <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-300 border border-zinc-500/40 px-1.5 py-0.5 rounded-sm">
            [ ACTIVE ]
          </span>
        )}
      </div>

      {/* Castle name */}
      <h3 className="text-base font-bold leading-tight mb-3 whitespace-pre-line"
        style={{
          background: 'linear-gradient(90deg, #c0c0c0, #e8e8e8, #a0a0a0)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
        {castle.name}
      </h3>

      {/* ASCII silhouette */}
      <pre className="text-[10px] font-mono leading-tight text-zinc-400 mb-4 whitespace-pre"
        style={{ textShadow: '0 0 4px rgba(192,192,192,0.3)' }}>
        {castle.silhouette}
      </pre>

      {/* COMMEMORATES */}
      <div className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
        COMMEMORATES
      </div>
      <p className="text-[10px] font-mono text-zinc-300 mb-3 leading-relaxed">
        {castle.commemorates}
      </p>

      {/* BUILT FROM */}
      <div className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">
        BUILT FROM
      </div>
      <p className="text-[10px] font-mono text-zinc-400 mb-3 leading-relaxed">
        {castle.builtFrom}
      </p>

      {/* CYCLE / STATUS */}
      <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-1 text-[9px] font-mono mb-3">
        <span className="text-zinc-600 uppercase tracking-widest">CYCLE</span>
        <span className="text-zinc-400">{castle.cycle}</span>
        <span className="text-zinc-600 uppercase tracking-widest">STATUS</span>
        <span className="text-zinc-200 tabular-nums">{status}</span>
      </div>

      <div className="border-t border-zinc-600/[0.08] pt-2 text-[10px] font-mono italic text-zinc-300">
        &ldquo;{castle.dedication}&rdquo;
      </div>
    </div>
  );
}

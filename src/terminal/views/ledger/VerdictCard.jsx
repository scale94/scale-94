import { useState } from 'react';

const STATUS_COLORS = {
  APPROVED:       { text: 'text-green-400', border: 'border-green-800/30', glow: 'shadow-[0_0_12px_rgba(34,197,94,0.1)]' },
  CONDITIONAL:    { text: 'text-yellow-400', border: 'border-yellow-800/30', glow: 'shadow-[0_0_12px_rgba(234,179,8,0.1)]' },
  REJECTED:       { text: 'text-red-400', border: 'border-red-800/30', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.1)]' },
  EMERGENCY_VETO: { text: 'text-red-500', border: 'border-red-700/40', glow: 'shadow-[0_0_16px_rgba(239,68,68,0.15)]' },
  UNKNOWN:        { text: 'text-gray-400', border: 'border-gray-800/30', glow: '' },
};

const CARD_STYLES = `
@keyframes vc-borderGlow {
  0%, 100% { border-color: var(--vc-border-base); }
  50% { border-color: var(--vc-border-glow); }
}
@keyframes vc-hashReveal {
  0%   { opacity: 0; letter-spacing: 4px; filter: blur(2px); }
  100% { opacity: 1; letter-spacing: 1px; filter: blur(0); }
}
`;

const STATUS_BORDER = {
  APPROVED:       { base: 'rgba(34,197,94,0.15)', glow: 'rgba(34,197,94,0.35)' },
  CONDITIONAL:    { base: 'rgba(234,179,8,0.15)', glow: 'rgba(234,179,8,0.35)' },
  REJECTED:       { base: 'rgba(239,68,68,0.15)', glow: 'rgba(239,68,68,0.35)' },
  EMERGENCY_VETO: { base: 'rgba(239,68,68,0.2)', glow: 'rgba(239,68,68,0.45)' },
  UNKNOWN:        { base: 'rgba(107,114,128,0.15)', glow: 'rgba(107,114,128,0.25)' },
};

export default function VerdictCard({ verdict, onExport }) {
  const [expanded, setExpanded] = useState(false);
  const colors = STATUS_COLORS[verdict.status] || STATUS_COLORS.UNKNOWN;
  const borderCfg = STATUS_BORDER[verdict.status] || STATUS_BORDER.UNKNOWN;

  return (
    <>
    <style>{CARD_STYLES}</style>
    <div
      className={`border ${colors.border} ${colors.glow} rounded-sm p-4 bg-black/50 transition-all duration-300`}
      style={{
        '--vc-border-base': borderCfg.base,
        '--vc-border-glow': borderCfg.glow,
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.animation = 'vc-borderGlow 2s ease-in-out infinite';
        e.currentTarget.style.boxShadow = colors.glow.replace('shadow-[', '').replace(']', '');
      }}
      onMouseLeave={e => {
        e.currentTarget.style.animation = 'none';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Subtle top edge light */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${borderCfg.glow}, transparent)`,
        opacity: 0.6,
      }} />
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`font-mono text-sm font-bold tracking-wider ${colors.text}`}>{verdict.status}</span>
          <span className="text-[10px] font-mono text-gray-600 tracking-wider">
            {verdict.dependency?.toUpperCase()}
          </span>
        </div>
        <span className="text-[10px] font-mono text-gray-600">
          {new Date(verdict.timestamp).toISOString().replace('T', ' ').slice(0, 19)} UTC
        </span>
      </div>

      {/* Coordinates + Hash */}
      <div className="font-mono text-xs text-gray-400 mb-2">
        <span className="text-teal-600">coordinates:</span>{' '}
        {verdict.coordinates.lat.toFixed(4)}, {verdict.coordinates.lon.toFixed(4)}
        {verdict.input?.siteName && (
          <span className="text-gray-500 ml-2">// {verdict.input.siteName}</span>
        )}
      </div>
      <div className="font-mono text-[10px] text-gray-600 mb-3">
        <span className="text-teal-700">hash:</span> {verdict.hash?.slice(0, 12)}...{verdict.hash?.slice(-8)}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          ['TEMP', verdict.input?.temp, 'C'],
          ['DO', verdict.input?.do, 'mg/L'],
          ['BOD', verdict.input?.bod, 'mg/L'],
          ['DT', verdict.input?.dt, 'C'],
        ].map(([label, val, unit]) => (
          <div key={label} className="text-center">
            <div className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{label}</div>
            <div className="text-sm font-mono text-teal-300">{val}<span className="text-gray-600 text-[9px] ml-0.5">{unit}</span></div>
          </div>
        ))}
      </div>

      {/* Expandable ruling */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest transition-colors"
      >
        {expanded ? '[ - ] COLLAPSE RULING' : '[ + ] FULL RULING'}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-teal-900/20 pt-3">
          <pre className="font-mono text-[11px] text-gray-400 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {verdict.ruling}
          </pre>
          {onExport && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onExport(verdict, 'json')} className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors">JSON-LD</button>
              <button onClick={() => onExport(verdict, 'pdf')} className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors">PDF</button>
              <button onClick={() => onExport(verdict, 'embed')} className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors">EMBED</button>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

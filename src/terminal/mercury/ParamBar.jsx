// ParamBar.jsx — Shared monospace bar used by Lunar's environmental modulators
// panel and Mercury's observation instruments panel.

export default function ParamBar({ label, value, unit, min, max, color }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[9px] font-mono">
      <span className="w-16 sm:w-24 text-right text-zinc-500 uppercase tracking-wider sm:tracking-widest shrink-0 leading-tight">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-200/[0.04] rounded-full overflow-hidden min-w-0">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 sm:w-16 text-zinc-400 tabular-nums text-right shrink-0">
        {typeof value === 'number' ? value.toFixed(3) : value}
        {unit && <span className="ml-1 text-zinc-600">{unit}</span>}
      </span>
    </div>
  );
}

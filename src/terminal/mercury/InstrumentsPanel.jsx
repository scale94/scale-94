// InstrumentsPanel.jsx — §A: Six alien observation instruments.
// Outer cosmos baselines × inner mirror modulators.

import ParamBar from './ParamBar';
import { computeInstruments } from './instruments';

const BAR_COLOR = 'bg-gradient-to-r from-zinc-500 to-zinc-200';

export default function InstrumentsPanel({ mercury, canvas }) {
  if (!mercury) return null;
  const instruments = computeInstruments(mercury, canvas);

  return (
    <div className="border border-zinc-600/[0.05] rounded-lg bg-black/30 p-4 mt-8">
      <div className="text-[10px] font-mono text-zinc-400/80 uppercase tracking-[0.2em] mb-1">
        ◉ OBSERVATION INSTRUMENTS — outer cosmos × inner mirror
      </div>
      <div className="text-[8px] font-mono text-zinc-600 mb-3">
        {`// six readings · the sphere is the instrument · all values computed`}
      </div>

      <div className="space-y-2.5">
        {instruments.map(inst => (
          <ParamBar
            key={inst.label}
            label={inst.label}
            value={inst.value}
            unit={inst.unit}
            min={inst.min}
            max={inst.max}
            color={BAR_COLOR}
          />
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-zinc-600/[0.04] text-[7px] font-mono text-zinc-600 leading-relaxed">
        {`// derived from astro.rs · solar flux 1361 W/m² (1 AU) · canvas state vector`}
      </div>
    </div>
  );
}

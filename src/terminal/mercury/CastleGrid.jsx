// CastleGrid.jsx — §B: 2×2 grid of the four fairy-tale castle cards.

import CastleCard from './CastleCard';
import { CASTLES } from './castles';

export default function CastleGrid({ activePhase, mercury, canvas }) {
  return (
    <div className="mt-8">
      <div className="text-[10px] font-mono text-zinc-400/80 uppercase tracking-[0.2em] mb-1">
        ▣ FAIRY-TALE CASTLES — four phase-bound dedications
      </div>
      <div className="text-[8px] font-mono text-zinc-600 mb-4">
        {`// active phase glows · status lines bound to live Mercury state`}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CASTLES.map(castle => (
          <CastleCard
            key={castle.phase}
            castle={castle}
            isActive={castle.phase === activePhase}
            mercury={mercury}
            canvas={canvas}
          />
        ))}
      </div>
    </div>
  );
}

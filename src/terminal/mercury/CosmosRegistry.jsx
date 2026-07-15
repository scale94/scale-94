// ── CosmosRegistry ───────────────────────────────────────────────────────────
// §D of the Mercury Terminal. Five RegistryCards in a responsive grid. Renders
// the fifth element's taxonomy of the site; each card mirrors live state from
// the observatoryBus.
//
// Re-renders on every emit (so freshness pulses appear within one frame) and
// also on a 1Hz tick (so isDim/isFresh boundaries update without a new emit).

import React, { useEffect, useState } from 'react';
import { useObservatoryState }  from '../../observatory/useObservatoryState';
import { REGISTRY_CATEGORIES }  from './registryCategories';
import RegistryCard             from './RegistryCard';

const SILVER = 'rgba(192,192,192,';

export default function CosmosRegistry() {
  const { totals } = useObservatoryState();
  // 1Hz tick so isFresh/isDim transitions repaint without a new emit
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => (n + 1) | 0), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="mt-10">
      <header className="mb-3">
        <div className="text-[10px] tracking-[0.20em] uppercase" style={{ color: SILVER + '0.75)' }}>
          ⌬ COSMOS REGISTRY — five categories of human signal
        </div>
        <div className="text-[8px] tracking-[0.14em] mt-0.5" style={{ color: SILVER + '0.35)' }}>
          {`// four elements anchor the site · aether mirrors what surfaces · the fifth element's taxonomy`}
        </div>
        <div className="mt-2 h-px" style={{
          background: 'linear-gradient(90deg, rgba(192,192,192,0.35), rgba(192,192,192,0.05), transparent)',
        }} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {REGISTRY_CATEGORIES.map(cat => (
          <RegistryCard key={cat.id} category={cat} totals={totals} />
        ))}
      </div>
    </section>
  );
}

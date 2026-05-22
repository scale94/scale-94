// ── useObservatoryState ──────────────────────────────────────────────────────
// React hook over observatoryBus. Subscribes and forces a re-render on every
// emit so the consumer can read fresh totals/journal. Used by Mercury's
// CosmosRegistry and ObservationMatrix.

import { useEffect, useState } from 'react';
import { subscribe, getTotals, getJournal } from './observatoryBus';

export function useObservatoryState() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(n => (n + 1) | 0)), []);
  return { totals: getTotals(), journal: getJournal() };
}

// SolHud.jsx — the readout under the star. Numbers and one-line states only.
//
// Rows: MAGNETIC TENSION (always), LAST RELEASE (after the first snap), and
// for a while after each snap the light line. `clouds` and `landings` are
// accepted now and drawn by the clock task.

import React from 'react';
import { LIGHT_DELAY_S } from './solPhysics';

const LIGHT_MIN = Math.floor(LIGHT_DELAY_S / 60);
const LIGHT_SEC = LIGHT_DELAY_S - LIGHT_MIN * 60;
export const LIGHT_LINE = `LIGHT · ${LIGHT_MIN} min ${LIGHT_SEC} s OLD`;

/** 5e32 -> "5.0e32"; one decimal of mantissa, rounding carried into the exponent. */
export function formatErg(erg) {
  return Number(erg).toExponential(1).replace('e+', 'e');
}

const ROW = 'flex items-baseline justify-between gap-6';
const LABEL = 'text-[9px] sm:text-[10px] text-yellow-100/55 uppercase tracking-widest';
const VALUE = 'text-xs sm:text-sm font-bold text-yellow-100 tabular-nums';

function SolHud({ tensionG, lastReleaseErg, lightDelayVisible }) {
  const g = Number.isFinite(tensionG) ? Math.round(tensionG) : 0;
  const hasRelease = Number.isFinite(lastReleaseErg) && lastReleaseErg > 0;
  return (
    <div
      data-testid="sol-hud"
      className="mt-3 w-full sm:w-80 border border-yellow-200/25 rounded-sm px-3 py-2 font-mono space-y-1"
    >
      <div className={ROW}>
        <span className={LABEL}>MAGNETIC TENSION</span>
        <span className={VALUE}>{g} G</span>
      </div>
      {hasRelease && (
        <div className={ROW}>
          <span className={LABEL}>LAST RELEASE</span>
          <span className={VALUE}>{formatErg(lastReleaseErg)} erg</span>
        </div>
      )}
      {lightDelayVisible && (
        <div className="text-[9px] sm:text-[10px] text-yellow-100/80 tracking-widest">{LIGHT_LINE}</div>
      )}
    </div>
  );
}

export default React.memo(SolHud);

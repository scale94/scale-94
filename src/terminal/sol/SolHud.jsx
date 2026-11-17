// SolHud.jsx — the readout under the star. Numbers and one-line states only.
//
// Rows: MAGNETIC TENSION (always), LAST RELEASE (after the first snap), for
// a while after each snap the light line, one row per cloud in flight (time
// to arrival on the true clock, orientation unread until the read moment),
// and one line per landing. The caller chooses which clouds and landings.

import React from 'react';
import { LIGHT_LINE, formatErg, formatEta, landingLine } from './hudFormat';

const ROW = 'flex items-baseline justify-between gap-6';
const LABEL = 'text-[9px] sm:text-[10px] text-yellow-100/55 uppercase tracking-widest';
const VALUE = 'text-xs sm:text-sm font-bold text-yellow-100 tabular-nums';
const LINE = 'text-[9px] sm:text-[10px] text-yellow-100/80 tracking-widest';
const NONE = [];

function SolHud({ tensionG, lastReleaseErg, lightDelayVisible, clouds = NONE, landings = NONE }) {
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
      {lightDelayVisible && <div className={LINE}>{LIGHT_LINE}</div>}
      {clouds.map((c) => (
        <div key={c.id} data-testid="sol-cloud" className={ROW}>
          <span className={LABEL}>IN FLIGHT</span>
          <span className={VALUE}>
            {formatEta(c.etaMs)}
            <span className="font-normal text-yellow-100/60"> · {c.orientation || 'unread'}</span>
          </span>
        </div>
      ))}
      {landings.map((l) => (
        <div key={l.id} data-testid="sol-landing" className={LINE}>{landingLine(l)}</div>
      ))}
    </div>
  );
}

export default React.memo(SolHud);

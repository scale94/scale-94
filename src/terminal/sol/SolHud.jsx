// SolHud.jsx — the readout under the star. Numbers and one-line states only.
//
// Rows: MAGNETIC TENSION (always), LAST RELEASE (after the first snap), for
// a while after each snap the light line, one row per cloud in flight (time
// to arrival on the true clock, orientation unread until the read moment),
// and one line per landing. The caller chooses which clouds and landings.

import React from 'react';
import { LIGHT_DELAY_S } from './solPhysics';

const LIGHT_MIN = Math.floor(LIGHT_DELAY_S / 60);
const LIGHT_SEC = LIGHT_DELAY_S - LIGHT_MIN * 60;
export const LIGHT_LINE = `LIGHT · ${LIGHT_MIN} min ${LIGHT_SEC} s OLD`;

/** 5e32 -> "5.0e32"; one decimal of mantissa, rounding carried into the exponent. */
export function formatErg(erg) {
  return Number(erg).toExponential(1).replace('e+', 'e');
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Time to arrival as HH:MM:SS; seconds round up, so a cloud in flight never reads 00:00:00. */
export function formatEta(ms) {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(total % 60)}`;
}

/** One line per fate. U+2212 for the minus sign. */
export function landingLine({ fate, nT }) {
  if (fate === 'passed') return 'arrived · northward · passed';
  if (fate === 'unwitnessed') return 'arrived · unwitnessed';
  const n = Math.round(Math.abs(Number.isFinite(nT) ? nT : 0));
  return `arrived · southward · coupled · −${n} nT`;
}

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

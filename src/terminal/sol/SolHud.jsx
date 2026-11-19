// SolHud.jsx — the readout under the star. Numbers and one-line states only.
//
// Rows: MAGNETIC TENSION (always), LAST RELEASE (after the first snap), the
// selected cloud's five messenger clocks (the stack), one button row per
// other cloud in flight (click to select), and one line per landing. The
// caller chooses which clouds and landings.

import React from 'react';
import {
  MESSENGER_LABEL, forgeRows, formatClock, formatErg, formatEta, landingLine, messengerValue,
} from './hudFormat';

const ROW = 'flex flex-wrap items-baseline justify-between gap-x-6';
const LABEL = 'text-[9px] sm:text-[10px] text-yellow-100/55 uppercase tracking-widest';
const VALUE = 'min-w-0 break-words text-xs sm:text-sm font-bold text-yellow-100 tabular-nums';
const LINE = 'text-[9px] sm:text-[10px] text-yellow-100/80 tracking-widest';
const NONE = [];
const TOGGLE = 'bg-transparent border-0 p-0 m-0 font-mono cursor-pointer text-[9px] sm:text-[10px] uppercase tracking-widest focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-100/60';

function ViewButton({ id, label, view, onView }) {
  const on = view === id;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onView?.(id)}
      className={`${TOGGLE} ${on ? 'text-yellow-100' : 'text-yellow-100/55'}`}
    >
      {on ? `[ ${label} ]` : label}
    </button>
  );
}

function SolHud({ tensionG, lastReleaseErg, view = 'clocks', onView, forge = null, stack = null, selectedId = null, onSelect, clouds = NONE, landings = NONE }) {
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
      <div className="flex gap-4">
        <ViewButton id="clocks" label="CLOCKS" view={view} onView={onView} />
        <ViewButton id="forge" label="FORGE" view={view} onView={onView} />
      </div>
      {view === 'forge' && forgeRows(forge).map((r) => (
        <div
          key={r.symbol}
          data-testid="sol-forge-row"
          className={`${ROW} ${r.dark ? 'text-yellow-100/20' : ''}`}
        >
          <span className={r.dark ? 'text-[9px] sm:text-[10px] tracking-widest' : LABEL}>
            {r.symbol} <span className="tabular-nums">{r.z}</span>
          </span>
          {!r.dark && (
            <span className={VALUE}>
              {r.value}
              {r.year && <span className="font-normal text-yellow-100/60"> · {r.year}</span>}
            </span>
          )}
        </div>
      ))}
      {view !== 'forge' && stack && (
        <div data-testid="sol-stack" data-selected={selectedId ?? undefined} className="space-y-1">
          <div className={`${LINE} border-t border-yellow-200/20 pt-1`}>
            ── {formatClock(stack.launchedAt)} ──
          </div>
          {stack.rows.map((m) => (
            <div key={m.key} data-testid="sol-stack-row" className={ROW}>
              <span className={LABEL}>{MESSENGER_LABEL[m.key]}</span>
              <span className={VALUE}>{messengerValue(m)}</span>
            </div>
          ))}
        </div>
      )}
      {view !== 'forge' && clouds.map((c) => (
        <button
          key={c.id}
          type="button"
          data-testid="sol-cloud"
          onClick={() => onSelect?.(c.id)}
          className={`${ROW} w-full bg-transparent border-0 p-0 m-0 text-left font-mono cursor-pointer focus-visible:outline focus-visible:outline-1 focus-visible:outline-yellow-100/60`}
        >
          <span className={LABEL}>IN FLIGHT</span>
          <span className={VALUE}>
            {formatEta(c.etaMs)}
            <span className="font-normal text-yellow-100/60"> · {c.orientation || 'unread'}</span>
          </span>
        </button>
      ))}
      {view !== 'forge' && landings.map((l) => (
        <div key={l.id} data-testid="sol-landing" className={LINE}>{landingLine(l)}</div>
      ))}
    </div>
  );
}

export default React.memo(SolHud);

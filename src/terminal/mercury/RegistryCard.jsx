// ── RegistryCard ─────────────────────────────────────────────────────────────
// One category card for §D Cosmos Registry. Mirrors the structure of
// CastleCard so the visual rhythm of §B continues. `isFresh` triggers a
// [FRESH] pill + sc-borderBreath pulse for ~8s after a new event.

import React from 'react';

const SILVER = 'rgba(192,192,192,';

export default function RegistryCard({ category, totals }) {
  const { glyph, name, tint, members, dedication, lastLine, stateLine } = category;
  const t = totals[category.id] ?? {};
  const last  = lastLine(t);
  const state = stateLine(t);
  const isFresh = t.lastTs && (Date.now() - t.lastTs) < 8000;
  const isDim   = !t.lastTs || (Date.now() - t.lastTs) > 30000;

  return (
    <div
      className="relative rounded-sm border px-4 py-3 font-mono"
      style={{
        borderColor:    isFresh ? tint.replace('1)', '0.45)') : 'rgba(192,192,192,0.10)',
        background:     'rgba(0,0,0,0.35)',
        opacity:        isDim && !isFresh ? 0.6 : 1,
        animation:      isFresh ? 'sc-borderBreath 6s ease-in-out infinite' : undefined,
        transition:     'opacity 600ms ease, border-color 600ms ease',
      }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[16px] leading-none" style={{ color: tint.replace('1)', '0.85)') }}>
            {glyph}
          </span>
          <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: SILVER + '0.85)' }}>
            {name}
          </span>
        </div>
        {isFresh && (
          <span
            className="text-[7px] tracking-[0.25em] px-1.5 py-0.5 rounded-sm"
            style={{
              color: tint.replace('1)', '0.95)'),
              border: `1px solid ${tint.replace('1)', '0.5)')}`,
              background: tint.replace('1)', '0.06)'),
            }}
          >
            FRESH
          </span>
        )}
      </div>

      {/* Commemorates */}
      <div className="text-[7px] tracking-[0.18em] uppercase mb-0.5" style={{ color: SILVER + '0.40)' }}>
        commemorates
      </div>
      <div className="text-[9px] leading-snug mb-3" style={{ color: SILVER + '0.65)' }}>
        {dedication}
      </div>

      {/* Members */}
      <div className="text-[7px] tracking-[0.18em] uppercase mb-1" style={{ color: SILVER + '0.40)' }}>
        members
      </div>
      <ul className="mb-3 space-y-0.5">
        {members.map(m => (
          <li key={m.name} className="text-[8.5px] leading-snug flex gap-2" style={{ color: SILVER + '0.55)' }}>
            <span className="shrink-0" style={{ color: tint.replace('1)', '0.7)') }}>{m.glyph}</span>
            <span>{m.name}<span style={{ color: SILVER + '0.30)' }}>{` — ${m.blurb}`}</span></span>
          </li>
        ))}
      </ul>

      {/* Last observed */}
      <div className="text-[7px] tracking-[0.18em] uppercase mb-0.5" style={{ color: SILVER + '0.40)' }}>
        last observed
      </div>
      <div className="text-[8.5px] mb-2" style={{ color: SILVER + (last ? '0.7)' : '0.25)') }}>
        {last ?? <em>// awaiting transmission</em>}
      </div>

      {/* State */}
      <div className="text-[7px] tracking-[0.18em] uppercase mb-0.5" style={{ color: SILVER + '0.40)' }}>
        state
      </div>
      <div className="text-[8.5px] mb-3" style={{ color: SILVER + '0.65)' }}>
        {state}
      </div>

      {/* Dedication footer */}
      <div className="border-t pt-2" style={{ borderColor: 'rgba(192,192,192,0.06)' }}>
        <div className="text-[8.5px] italic leading-snug" style={{ color: SILVER + '0.55)' }}>
          "{dedication}"
        </div>
      </div>
    </div>
  );
}

// src/terminal/lunar/DoctrineRegister.jsx — the reading (spec §7).
// Presentational only: every value arrives already compiled. Recomputes for
// free when currentAge changes, so dragging the time-scrub recompiles the
// doctrine live.
import React from 'react';
import { snapshotPeriphery } from '../quintessence/periphery';

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2 sm:gap-3 items-baseline">
      <div className="text-[7px] font-mono text-violet-500/45 uppercase tracking-[0.2em] pt-0.5">
        {label}
      </div>
      <div className="text-[9px] sm:text-[10px] font-mono text-zinc-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function DoctrineRegister({ reading, planetData, aspectGlyph }) {
  if (!reading) return null;

  const { dominant, provenance } = reading;
  const d1 = planetData?.[dominant.p1];
  const d2 = planetData?.[dominant.p2];

  // Only the entropy lens claims the chaos house; the cross-link would be a
  // non-sequitur under any other kernel.
  const chaos = reading.lensId === 'hudelschublade' ? snapshotPeriphery()?.art ?? null : null;
  const showChaos = reading.lensId === 'hudelschublade';

  return (
    <div className="mt-8 border border-violet-500/20 rounded-lg bg-violet-950/[0.07] overflow-hidden">
      {/* header — names itself as the register, so it does not read as a
          contradiction of the tab's cited-mechanics posture */}
      <div className="px-4 py-3 border-b border-violet-900/30">
        <div className="text-[10px] font-mono font-bold text-violet-400/80 uppercase tracking-widest">
          ◈ DOCTRINE REGISTER
        </div>
        <div className="text-[7px] font-mono text-violet-500/40 mt-0.5">
          // the alchemy to the chemistry above · astrology to its astronomy
        </div>
      </div>

      {/* lens */}
      <div className="px-4 py-3 border-b border-zinc-600/[0.04] bg-black/20">
        <div className="text-[7px] font-mono text-zinc-600 uppercase tracking-widest mb-1">LENS</div>
        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/80 tracking-wide break-words">
          {reading.kernel}
        </div>
        <div className="text-[8px] font-mono text-zinc-500/70 italic mt-1 leading-relaxed">
          {reading.axis}
        </div>
        <div className="text-[7px] font-mono text-zinc-600 mt-1.5 flex items-center gap-1 flex-wrap">
          <span>selected by</span>
          <span className="text-zinc-500">{provenance.phaseId.replace(/-/g, ' ')}</span>
          <span>×</span>
          <span style={{ color: d1?.color }}>{d1?.glyph ?? dominant.p1}</span>
          <span className="text-zinc-500">{aspectGlyph?.[dominant.aspect] ?? ''} {dominant.aspect}</span>
          <span style={{ color: d2?.color }}>{d2?.glyph ?? dominant.p2}</span>
          <span className="text-zinc-600">orb {dominant.orb}°</span>
          {dominant.synthetic && (
            <span className="text-zinc-700">· sun–moon elongation</span>
          )}
        </div>
      </div>

      {/* the triad */}
      <div className="px-4 py-4 space-y-2.5">
        <Row label="PLATO">{reading.plato}</Row>
        <Row label="PROMO">{reading.promo}</Row>
        <Row label="PARADOX">{reading.paradox}</Row>
      </div>

      {/* the imperative */}
      <div className="px-4 py-3 border-t border-violet-500/15 bg-violet-950/10">
        <div className="flex items-start gap-2.5">
          <span className="text-violet-400/70 text-[11px] leading-none pt-0.5">⟶</span>
          <p className="text-[11px] sm:text-[12px] font-mono text-violet-100/90 leading-relaxed tracking-wide">
            {reading.directive}
          </p>
        </div>
      </div>

      {/* spine coda */}
      <div className="px-4 py-2 border-t border-zinc-600/[0.04]">
        <p className="text-[8px] font-mono text-zinc-500/70 italic leading-relaxed">
          {reading.coda}
        </p>
      </div>

      {/* chaos cross-link — the entropy lens names the Feigenbaum house */}
      {showChaos && (
        <div className="px-4 py-2 border-t border-zinc-600/[0.04] text-[7px] font-mono tracking-wide flex items-center gap-1.5">
          <span className="text-violet-400/35">↗</span>
          <span className="text-violet-400/45">house: chaos</span>
          <span className="text-violet-300/65">
            {chaos ? 'witnessed — the drawer has been opened' : 'unindexed — never entered'}
          </span>
        </div>
      )}

      {/* provenance */}
      <div className="px-4 py-2 border-t border-zinc-600/[0.04] text-[6.5px] font-mono text-zinc-600 leading-relaxed">
        moon {(provenance.illumination * 100).toFixed(1)}% ·
        day {provenance.age.toFixed(1)} ·
        dryness {provenance.dryness} · {provenance.accord}
        {provenance.element ? ` · spine ${provenance.element}` : ''}
      </div>
    </div>
  );
}

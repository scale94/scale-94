// OceanHud.jsx — the Ledger ocean's instrument overlay (spec §4 HUD).
// Monospace, over the canvas; pointer events only on the controls and the
// source rings. Per-frame text (clock, frame monitor) is written through the
// imperative handle, not React state, so the HUD does not re-render at the
// display rate. The probe readout is state: it changes at most at 10 Hz.

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  HUD_TITLE, LEGEND_NOTES, LEGEND_SWATCHES, MODE_LABEL, PROBE_HINT, PROBE_NOTE,
  formatClock, formatFrame, lonLatToPct, summaryLine, tooltipLines,
} from './hudFormat';

const INK = 'rgba(20,184,166,0.72)';
const DIM = 'rgba(20,184,166,0.42)';
const FRAME_TEXT_MS = 250;
const RING_PX = 16;
// Phone: the hit target is the drawn ring (10 px box, ring inset 1 px → 8 px
// circle), so a tap on open water a few rings away probes instead of opening
// a tooltip. Chrome's own touch adjustment can still snap a tap to a ring.
const RING_PX_COMPACT = 10;
const TIP_Z = 3;
const TIP_MARGIN_PX = 4;

const controlStyle = {
  pointerEvents: 'auto',
  background: 'transparent',
  border: 'none',
  padding: 0,
  font: 'inherit',
  letterSpacing: 'inherit',
  color: 'rgba(94,234,212,0.9)',
  cursor: 'pointer',
  textDecoration: 'underline dotted',
};

function Swatch({ color, ring }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: 7, height: 7, marginRight: 3, verticalAlign: 'middle',
        background: color, border: ring ? `1px solid ${ring}` : 'none',
      }}
    />
  );
}

function tooltipBox(site, compact) {
  const { left, top } = lonLatToPct(site.site[0], site.site[1]);
  const box = {
    position: 'absolute',
    zIndex: TIP_Z,
    ...(left > 60 ? { right: `calc(${100 - left}% + 12px)` } : { left: `calc(${left}% + 12px)` }),
    ...(top > 60 ? { bottom: `calc(${100 - top}% + 10px)` } : { top: `calc(${top}% + 10px)` }),
    background: 'rgba(0,0,0,0.9)',
    border: `1px solid ${site.color}`,
    padding: '4px 7px',
    color: site.color,
    whiteSpace: 'nowrap',
  };
  if (!compact) return box;
  // Phone: opaque, wraps inside a max width; the layout effect in OceanHud
  // then clamps it inside the hero.
  return {
    ...box,
    background: '#000',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    maxWidth: `min(230px, calc(100% - ${2 * TIP_MARGIN_PX}px))`,
    boxSizing: 'border-box',
  };
}

const OceanHud = forwardRef(function OceanHud({
  compact = false,
  mode = 'live',
  reducedMotion = false,
  daysPerSecond,
  onCycleCompression,
  sites = [],
  latestHash = null,
  verdicts = [],
}, ref) {
  const clockRef = useRef(null);
  const frameRef = useRef(null);
  const frameAtRef = useRef(-Infinity);
  const [probe, setProbe] = useState(null);
  const [focus, setFocus] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const rootRef = useRef(null);
  const tipRef = useRef(null);

  useImperativeHandle(ref, () => ({
    setFrame({ simDays, frameMs, now }) {
      const clock = formatClock(simDays);
      if (clockRef.current && clockRef.current.textContent !== clock) clockRef.current.textContent = clock;
      if (frameRef.current && now - frameAtRef.current >= FRAME_TEXT_MS) {
        frameRef.current.textContent = formatFrame(frameMs);
        frameAtRef.current = now;
      }
    },
    setProbe(text) {
      setProbe(text);
    },
    // Compact taps are resolved by distance in LedgerOcean (the rings take no
    // pointer events there): open a site's tooltip, or null to dismiss it.
    openSite(id) {
      setFocus(id);
    },
  }), []);

  const focused = sites.find((s) => s.id === focus) ?? null;
  const live = mode === 'live';
  const ringPx = compact ? RING_PX_COMPACT : RING_PX;

  // Phone: any press dismisses an open tooltip (the page, a HUD control, the
  // ocean). A press on the ocean then reopens a ring on pointerup if it lands
  // within the tap radius (LedgerOcean), so the net effect is "elsewhere closes".
  const tipOpen = focused !== null;
  useEffect(() => {
    if (!compact || !tipOpen) return undefined;
    const close = () => setFocus(null);
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [compact, tipOpen]);

  // Phone: keep the tooltip inside the hero (TIP_MARGIN_PX from each edge).
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const root = rootRef.current;
    if (!compact || !tip || !root) return;
    tip.style.transform = '';
    const t = tip.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    const shift = (lo, hi, bLo, bHi) => {
      if (hi > bHi - TIP_MARGIN_PX) return Math.max(bHi - TIP_MARGIN_PX - hi, bLo + TIP_MARGIN_PX - lo);
      if (lo < bLo + TIP_MARGIN_PX) return bLo + TIP_MARGIN_PX - lo;
      return 0;
    };
    const dx = shift(t.left, t.right, b.left, b.right);
    const dy = shift(t.top, t.bottom, b.top, b.bottom);
    if (dx || dy) tip.style.transform = `translate(${dx}px, ${dy}px)`;
  }, [compact, focused]);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        font: `${compact ? 8 : 9}px monospace`, letterSpacing: '0.12em', lineHeight: 1.5, color: INK,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 360 180"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {sites
          .filter((s) => s.kind === 'verdict' && Math.abs(s.snap[0] - s.site[0]) <= 180)
          .map((s) => (
            <line
              key={s.id}
              x1={s.site[0] + 180} y1={90 - s.site[1]} x2={s.snap[0] + 180} y2={90 - s.snap[1]}
              stroke={s.color} strokeOpacity="0.6" strokeWidth="1" vectorEffect="non-scaling-stroke"
            />
          ))}
      </svg>

      {sites.map((s) => {
        const { left, top } = lonLatToPct(s.site[0], s.site[1]);
        const latest = s.id === latestHash;
        return (
          <button
            key={s.id}
            type="button"
            data-site={s.id}
            aria-label={tooltipLines(s).join(' · ')}
            onMouseEnter={() => setFocus(s.id)}
            onMouseLeave={() => setFocus((f) => (f === s.id ? null : f))}
            onFocus={() => setFocus(s.id)}
            onBlur={() => setFocus((f) => (f === s.id ? null : f))}
            // Set, never toggle: a real tap/click arrives as mouseenter →
            // focus → click, and a toggle would clear what enter just opened.
            // Dismissal: blur or mouseleave (tapping elsewhere does both).
            onClick={() => setFocus(s.id)}
            style={{
              position: 'absolute', left: `${left}%`, top: `${top}%`, width: ringPx, height: ringPx,
              transform: 'translate(-50%, -50%)', padding: 0, border: 'none', background: 'transparent',
              // Phone: no pointer events, so Chrome's touch adjustment has
              // nothing to snap a tap to; still focusable from the keyboard.
              cursor: 'pointer', pointerEvents: compact ? 'none' : 'auto',
            }}
          >
            <span
              style={{
                position: 'absolute', inset: compact ? (latest ? 0 : 1) : (latest ? 2 : 4), borderRadius: '50%',
                border: `${latest ? 2 : 1.5}px solid ${s.color}`, opacity: s.kind === 'preset' ? 0.6 : 0.95,
              }}
            />
          </button>
        );
      })}

      <div style={{ position: 'absolute', left: 8, top: 6 }}>
        {live ? (
          <>
            <span ref={clockRef} data-hud="clock" />
            {reducedMotion ? (
              <span style={{ color: DIM }}> · STILL · REDUCED MOTION</span>
            ) : (
              <>
                {' · '}
                <button
                  type="button"
                  data-hud="compression"
                  onClick={onCycleCompression}
                  aria-label={`Time compression: 1 s = ${daysPerSecond} simulated days. Click to change.`}
                  style={controlStyle}
                >
                  {`1 s = ${daysPerSecond} d`}
                </button>
                {!compact && (
                  <>
                    {' · '}
                    <span ref={frameRef} data-hud="frame" style={{ color: DIM }} />
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <span data-hud="mode">{MODE_LABEL[mode]}</span>
        )}
      </div>

      {!compact && (
        <div data-hud="title" style={{ position: 'absolute', right: 8, top: 6, color: DIM, letterSpacing: '0.2em' }}>
          {HUD_TITLE}
        </div>
      )}

      <div style={{ position: 'absolute', left: 8, bottom: 6, maxWidth: compact ? 'calc(100% - 16px)' : '58%' }}>
        {compact && probe ? (
          <>
            <div data-hud="probe">{probe}</div>
            <div style={{ color: DIM }}>{PROBE_NOTE}</div>
          </>
        ) : (
          <>
            {!compact && <div data-hud="summary">{summaryLine(verdicts)}</div>}
            {compact ? (
              <div data-hud="legend" style={{ color: DIM }}>
                {notesOpen && (
                  <div data-hud="notes" style={{ background: 'rgba(0,0,0,0.8)', padding: '2px 4px', marginBottom: 2 }}>
                    <div data-hud="summary" style={{ color: INK }}>{summaryLine(verdicts)}</div>
                    {LEGEND_NOTES.map((note) => <div key={note}>{note}</div>)}
                  </div>
                )}
                <div data-hud="legend-key" style={{ whiteSpace: 'nowrap' }}>
                  {LEGEND_SWATCHES.map((s) => (
                    <span key={s.label} style={{ marginRight: 6 }}>
                      <Swatch color={s.color} ring={s.ring} />
                      {s.label}
                    </span>
                  ))}
                  <button
                    type="button"
                    data-hud="notes-toggle"
                    aria-expanded={notesOpen}
                    aria-label={notesOpen ? 'Hide legend notes' : 'Show legend notes'}
                    onClick={() => setNotesOpen((o) => !o)}
                    style={{ ...controlStyle, color: INK, marginLeft: 2 }}
                  >
                    {notesOpen ? 'NOTES ▾' : 'NOTES ▸'}
                  </button>
                </div>
              </div>
            ) : (
              <div data-hud="legend" style={{ color: DIM }}>
                {LEGEND_SWATCHES.map((s) => (
                  <span key={s.label} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
                    <Swatch color={s.color} ring={s.ring} />
                    {s.label}
                  </span>
                ))}
                <div>{LEGEND_NOTES.join(' / ')}</div>
              </div>
            )}
          </>
        )}
      </div>

      {!compact && (
        <div style={{ position: 'absolute', right: 8, bottom: 6, maxWidth: '40%', textAlign: 'right' }}>
          <div data-hud="probe">{probe ?? PROBE_HINT}</div>
          {probe && <div style={{ color: DIM }}>{PROBE_NOTE}</div>}
        </div>
      )}

      {/* Last in the HUD and on its own z-index: nothing draws over it. */}
      {focused && (
        <div ref={tipRef} data-hud="tooltip" role="tooltip" style={tooltipBox(focused, compact)}>
          {tooltipLines(focused).map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
    </div>
  );
});

export default OceanHud;

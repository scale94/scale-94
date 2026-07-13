import { useState, useEffect, useMemo, useCallback } from 'react';
import { SIXTEEN_MINDS } from '../../data/sixteenMinds';
import { seatAngle, polarToXY } from './councilRingMath';
import SixteenPanel from './SixteenPanel';
import { useCouncilCollider } from './useCouncilCollider';
import MindSidebar from './MindSidebar';
import CouncilSynthesisPanel from './CouncilSynthesisPanel';
import { emit as emitObs } from '../../../observatory/observatoryBus';

const CX = 320, CY = 320;
const R_CEILING = 290;    // biophysical ceiling (outer)
const R_FOUNDATION = 150; // social foundation (inner)
const R_SEAT = 220;       // node seat radius (safe operating space)
const MONO = "'Geist Mono', ui-monospace, monospace";

// Boot rainbow arc — same spectrum as the Fade Doctrine boot card.
const RAINBOW = ['#FF0088', '#FF3300', '#FF8C00', '#FFD700', '#AAFF00', '#00FFAA', '#00AAFF', '#0044FF', '#7700FF'];
function arcHue(seatIndex, total) {
  const t = seatIndex / Math.max(1, total - 1);
  const pos = t * (RAINBOW.length - 1);
  return RAINBOW[Math.round(pos)];
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1200);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 1200);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}

// Build seated minds once: each mind gets an absolute ring angle + arc hue.
function useSeatedMinds() {
  return useMemo(() => {
    const canon = SIXTEEN_MINDS.filter(m => m.caste === 'canon');
    const side  = SIXTEEN_MINDS.filter(m => m.caste === 'sidelined');
    const seat = (arr, caste) => arr.map((m, i) => ({
      ...m,
      angle: seatAngle(i, caste),
      hue: arcHue(i, arr.length),
      casteStroke: caste === 'canon' ? '#7700FF' : '#00FFAA',
    }));
    return [...seat(canon, 'canon'), ...seat(side, 'sidelined')];
  }, []);
}

function Node({ mind, active, onSelect, showLabel = true }) {
  const { x, y } = polarToXY(mind.angle, R_SEAT, CX, CY);
  const labelSide = mind.angle > 180 ? 'end' : 'start';
  const dx = mind.angle > 180 ? -12 : 12;
  const fill = active ? '#FFD700' : mind.hue;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(mind)}
      data-testid={`node-${mind.dimIndex}`}
    >
      {/* Invisible touch target — 44px diameter, independent of the visible
          dot's radius (6/9px), so mobile taps satisfy WCAG 2.5.5 without
          growing the ring's visual density. */}
      <circle cx={x} cy={y} r={22} fill="transparent" />
      <circle cx={x} cy={y} r={active ? 9 : 6} fill={fill} stroke={mind.casteStroke} strokeWidth={active ? 2.5 : 1.5}
        style={{ transition: 'r 160ms, fill 80ms', pointerEvents: 'none' }} />
      {/* Labels are suppressed on mobile widths (showLabel=false, passed by
          the caller) — 8-9px SVG text has no ellipsis and would clip or
          overlap between closely-spaced touch targets. Full name/dim surface
          via the ARMED banner and the synthesis panel's pair header instead. */}
      {showLabel && (
        <>
          <text x={x + dx} y={y - 4} textAnchor={labelSide} fontFamily={MONO} fontSize={12} fill={active ? '#FFD700' : '#e8e8f0'} style={{ pointerEvents: 'none' }}>
            {mind.anchorName}
          </text>
          <text x={x + dx} y={y + 10} textAnchor={labelSide} fontFamily={MONO} fontSize={9} fill={`${mind.hue}bb`} style={{ pointerEvents: 'none' }}>
            [dim:{String(mind.dimIndex).padStart(2, '0')}] {mind.dimName}
          </text>
        </>
      )}
    </g>
  );
}

function RingScaffold() {
  return (
    <g>
      <circle cx={CX} cy={CY} r={R_CEILING} fill="none" stroke="#00FFAA" strokeWidth={1} strokeOpacity={0.28} />
      <circle cx={CX} cy={CY} r={R_FOUNDATION} fill="none" stroke="#FF0088" strokeWidth={1} strokeOpacity={0.28} />
      <text x={CX} y={CY - R_CEILING - 8} textAnchor="middle" fontFamily={MONO} fontSize={10} fill="#00FFAA" fillOpacity={0.6} letterSpacing="0.25em">BIOPHYSICAL CEILING</text>
      <text x={CX} y={CY + R_FOUNDATION + 16} textAnchor="middle" fontFamily={MONO} fontSize={9} fill="#FF0088" fillOpacity={0.6} letterSpacing="0.2em">SOCIAL FOUNDATION</text>
      <text x={CX} y={CY + 6} textAnchor="middle" fontFamily={MONO} fontSize={22} fill="#7788cc" fillOpacity={0.4}>◉</text>
    </g>
  );
}

export default function CouncilRing() {
  const seated = useSeatedMinds();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState(null);

  const collider = useCouncilCollider({ seated, enabled: true });
  const isNarrow = useIsNarrow();
  const { onNodeClick } = collider; // stable useCallback — plain identifier satisfies exhaustive-deps
  const handleSelect = useCallback((mind) => {
    onNodeClick(mind); // selection is the primary verb — dossier moved to [dossier] affordances
  }, [onNodeClick]);
  const openDossier = useCallback((mind) => setSelected(mind), []);

  // Output notification (spec §3): visible from SYNTHESIZED until the panel
  // has been scrolled into view.
  const [alertDismissed, setAlertDismissed] = useState(false);
  useEffect(() => {
    if (collider.mode !== 'SYNTHESIZED') { setAlertDismissed(false); return; }
    const panel = document.getElementById('council-synthesis-panel');
    if (!panel) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setAlertDismissed(true); });
    io.observe(panel);
    return () => io.disconnect();
  }, [collider.mode, collider.synthesisRecord?.id]);

  // Desktop — 3-column grid: sidebars flank the torus while a pair is selected
  // (spec §3). Canvas renders UNDER the SVG. Torus cell has min-width:0 and
  // overflow:hidden on the CANVAS wrapper only; SVG keeps its full widened
  // viewBox so labels never clip (spec §7). Sidebars are grid siblings.
  const showSidebars = collider.mode !== 'AMBIENT';
  const [mindA, mindB] = collider.pairMinds || [collider.armedMind, null];
  const hueOf = (m) => (m ? seated.find(s => s.dimIndex === m.dimIndex)?.hue : null);

  // Flanking sidebars inside the manifesto's max-w-6xl column would squeeze
  // the torus to ~578px (7px labels — verified illegible). While flanking, the
  // ring box breaks out to near-viewport width; SixteenPanel and the synthesis
  // panel stay siblings OUTSIDE this box (transform creates a containing
  // block for fixed-position descendants).
  const flanking = showSidebars && !isNarrow;
  const breakout = flanking
    ? { width: 'min(94vw, 1360px)', marginLeft: '50%', transform: 'translateX(-50%)' }
    : {};

  return (
    <div style={{ width: '100%' }}>
      <div style={{ background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4, ...breakout }}>
        <div style={{ display: 'grid', gridTemplateColumns: flanking ? 'minmax(170px, 200px) minmax(0, 1fr) minmax(170px, 200px)' : 'minmax(0, 1fr)', gap: 12, padding: flanking ? '12px' : 0, alignItems: 'start' }}>
          {flanking && (
            <MindSidebar mind={mindA} side="left" hue={hueOf(mindA)} onDossier={openDossier} />
          )}
          <div style={{ position: 'relative', minWidth: 0, overflow: 'hidden' }}>
            <canvas
              ref={collider.canvasRef}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
            {/* viewBox widened horizontally (−170..810) so long anchor labels on both
                arcs (e.g. "Nicholas Georgescu-Roegen", "D'Arcy Wentworth Thompson")
                have margin and are not clipped by the SVG edge; ring stays centered on 320. */}
            <svg viewBox="-170 0 980 640" style={{ width: '100%', height: 'auto', display: 'block', position: 'relative' }}>
              <RingScaffold />
              {seated.map(m => (
                <Node
                  key={m.dimIndex}
                  mind={m}
                  active={
                    collider.mode === 'ARMED'
                      ? collider.armedMind?.dimIndex === m.dimIndex
                      : collider.activePairIds.includes(m.dimIndex)
                  }
                  onSelect={handleSelect}
                  showLabel={!isMobile}
                />
              ))}
            </svg>
          </div>
          {flanking && (
            <MindSidebar mind={mindB} side="right" hue={hueOf(mindB)} onDossier={openDossier} />
          )}
        </div>

        {/* Narrow viewports: sidebars stack below the torus (spec §3) */}
        {showSidebars && isNarrow && (
          <div style={{ display: 'flex', gap: 12, padding: '0 12px 12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}><MindSidebar mind={mindA} side="left" hue={hueOf(mindA)} onDossier={openDossier} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><MindSidebar mind={mindB} side="right" hue={hueOf(mindB)} onDossier={openDossier} /></div>
          </div>
        )}

        {/* ARMED banner */}
        {collider.mode === 'ARMED' && (
          <div style={{ padding: '6px 14px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: '#FFD700', borderTop: '1px solid rgba(255,215,0,0.25)', display: 'flex', gap: 14, alignItems: 'center' }}>
            ⌖ ARMED: {collider.armedMind?.anchorName.split(' ').pop().toUpperCase()} · SELECT SECOND MIND
            <button onClick={() => openDossier(collider.armedMind)} style={{ background: 'none', border: 'none', color: 'rgba(120,140,200,0.8)', fontFamily: MONO, fontSize: 9, cursor: 'pointer' }}>[dossier]</button>
            <button onClick={collider.disarm} style={{ background: 'none', border: 'none', color: 'rgba(255,0,136,0.8)', fontFamily: MONO, fontSize: 9, cursor: 'pointer' }}>[disarm]</button>
          </div>
        )}

        {/* Ticker strip — fixed height, no layout shift */}
        <div style={{ height: 44, padding: '8px 14px', borderTop: '1px solid rgba(120,140,200,0.12)', fontFamily: MONO, fontSize: 11, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          {collider.lastCollision ? (
            <span style={{ display: 'inline-block', minWidth: 0, color: collider.lastCollision.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {collider.lastCollision.line}
            </span>
          ) : (
            <span style={{ color: 'rgba(120,140,200,0.4)', letterSpacing: '0.2em' }}>◉ COUNCIL COLLIDER · AWAITING FIRST EVENT</span>
          )}
        </div>

        {/* Output notification (spec §3) */}
        {collider.mode === 'SYNTHESIZED' && !alertDismissed && (
          <div
            onClick={() => document.getElementById('council-synthesis-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{ padding: '8px 14px', fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em', textAlign: 'center', cursor: 'pointer', color: collider.synthesisRecord?.metrics.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA', borderTop: '1px solid rgba(120,140,200,0.12)', animation: 'council-alert-pulse 1.2s ease-in-out infinite' }}
          >
            ▼ {'//'} SYSTEM_OUTPUT_READY :: SCROLL_DOWN_FOR_SYNTHESIS ▼
          </div>
        )}
      </div>

      {/* Breakdown panel (spec §6) — below the ring container */}
      {collider.mode === 'SYNTHESIZED' && collider.synthesisRecord && (
        <CouncilSynthesisPanel
          record={collider.synthesisRecord}
          minds={seated}
          onDossier={openDossier}
          onReset={collider.reset}
          onFragmentMarked={(payload) => emitObs('gaze', 'manifesto_fragment_marked', payload)}
        />
      )}

      <style>{`
        @keyframes council-alert-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @media (prefers-reduced-motion: reduce) { [style*="council-alert-pulse"] { animation: none !important; } }
      `}</style>

      {selected && <SixteenPanel mind={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

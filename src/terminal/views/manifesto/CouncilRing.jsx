import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SIXTEEN_MINDS } from '../../data/sixteenMinds';
import { seatAngle, polarToXY, angleToNearestSeatIndex } from './councilRingMath';
import SixteenPanel from './SixteenPanel';
import { useCouncilCollider } from './useCouncilCollider';

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

function Node({ mind, active, onSelect }) {
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
      <circle cx={x} cy={y} r={active ? 9 : 6} fill={fill} stroke={mind.casteStroke} strokeWidth={active ? 2.5 : 1.5}
        style={{ transition: 'r 160ms, fill 80ms' }} />
      <text x={x + dx} y={y - 4} textAnchor={labelSide} fontFamily={MONO} fontSize={12} fill={active ? '#FFD700' : '#e8e8f0'} style={{ pointerEvents: 'none' }}>
        {mind.anchorName}
      </text>
      <text x={x + dx} y={y + 10} textAnchor={labelSide} fontFamily={MONO} fontSize={9} fill={`${mind.hue}bb`} style={{ pointerEvents: 'none' }}>
        [dim:{String(mind.dimIndex).padStart(2, '0')}] {mind.dimName}
      </text>
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

  const collider = useCouncilCollider({ seated, enabled: !isMobile });
  const handleSelect = useCallback((mind) => {
    setSelected(mind);
    collider.onNodeClick(mind);
  }, [collider.onNodeClick]);

  // Mobile rotation state
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef({ dragging: false, startAngle: 0, startRotation: 0 });

  const seatAngles = useMemo(() => seated.map(m => m.angle), [seated]);
  const activeIndex = useMemo(
    () => (isMobile ? angleToNearestSeatIndex(rotation, seatAngles) : -1),
    [isMobile, rotation, seatAngles]
  );
  const activeMind = activeIndex >= 0 ? seated[activeIndex] : null;

  const pointerAngle = useCallback((touch, rect) => {
    const px = touch.clientX - rect.left - rect.width / 2;
    const py = touch.clientY - rect.top - rect.height / 2;
    return (Math.atan2(py, px) * 180) / Math.PI;
  }, []);

  const onTouchStart = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      dragging: true,
      startAngle: pointerAngle(e.touches[0], rect),
      startRotation: rotation,
    };
  }, [rotation, pointerAngle]);

  const onTouchMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const now = pointerAngle(e.touches[0], rect);
    setRotation(dragRef.current.startRotation + (now - dragRef.current.startAngle));
  }, [pointerAngle]);

  const onTouchEnd = useCallback(() => {
    dragRef.current.dragging = false;
    // Snap so the nearest seat sits exactly under the crosshair (0°).
    const idx = angleToNearestSeatIndex(rotation, seatAngles);
    const target = -seatAngles[idx];
    setRotation(((target % 360) + 360) % 360);
  }, [rotation, seatAngles]);

  if (isMobile) {
    return (
      <div>
        {/* Crosshair-visible upper segment */}
        <div style={{ height: 360, overflow: 'hidden', position: 'relative', background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4 }}>
          {/* Gold crosshair at 12 o'clock */}
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 3, color: '#FFD700', fontFamily: MONO, fontSize: 14 }}>▼</div>
          <svg
            viewBox="0 0 640 640"
            style={{ width: '200%', marginLeft: '-50%', display: 'block', touchAction: 'none' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <g transform={`rotate(${rotation} ${CX} ${CY})`}>
              <RingScaffold />
              {seated.map((m, i) => (
                <g key={m.dimIndex} transform={`rotate(${-rotation} ${polarToXY(m.angle, R_SEAT, CX, CY).x} ${polarToXY(m.angle, R_SEAT, CX, CY).y})`}>
                  <Node mind={m} active={i === activeIndex} onSelect={setSelected} />
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Fixed-height telemetry panel — no layout shift, no keyboard */}
        <div
          onClick={() => activeMind && setSelected(activeMind)}
          style={{ minHeight: 132, height: 132, marginTop: 10, padding: '12px 14px', background: '#04040a', border: `1px solid ${activeMind ? (activeMind.caste === 'canon' ? '#FFD700' : '#00FFAA') : 'rgba(120,140,200,0.12)'}33`, borderRadius: 4, fontFamily: MONO, cursor: 'pointer', overflow: 'hidden' }}
        >
          {activeMind && (
            <>
              <div style={{ fontSize: 10, color: activeMind.hue, letterSpacing: '0.2em' }}>[dim:{String(activeMind.dimIndex).padStart(2, '0')}] {activeMind.dimName}</div>
              <div style={{ fontSize: 16, color: activeMind.caste === 'canon' ? '#FFD700' : '#00FFAA', fontWeight: 700, marginTop: 2 }}>{activeMind.anchorName}</div>
              <div style={{ fontSize: 14, color: '#FFD700', marginTop: 6 }}>{activeMind.coreEquation}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,255,170,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>▸ {activeMind.systemDirective}</div>
            </>
          )}
        </div>

        {selected && <SixteenPanel mind={selected} onClose={() => setSelected(null)} />}
      </div>
    );
  }

  // Desktop — canvas collider layer sits UNDER the SVG (SVG has no background
  // fill, so trails show through; nodes/labels/hit-targets stay on top).
  return (
    <div style={{ width: '100%', background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4 }}>
      <div style={{ position: 'relative' }}>
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
              active={collider.activePairIds.includes(m.dimIndex)}
              onSelect={handleSelect}
            />
          ))}
        </svg>
      </div>
      {/* Narrative strip — fixed height, no layout shift */}
      <div style={{ height: 44, padding: '8px 14px', borderTop: '1px solid rgba(120,140,200,0.12)', fontFamily: MONO, fontSize: 11, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {collider.lastCollision ? (
          <span style={{ color: collider.lastCollision.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {collider.lastCollision.line}
          </span>
        ) : (
          <span style={{ color: 'rgba(120,140,200,0.4)', letterSpacing: '0.2em' }}>◉ COUNCIL COLLIDER · AWAITING FIRST EVENT</span>
        )}
      </div>
      {selected && <SixteenPanel mind={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

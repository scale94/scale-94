// InterceptOverlay.jsx — the SVG layer of the intercept lattice (spec §3, §5,
// §9). Everything clickable, focusable or textual lives here; the WebGL field
// underneath only glows. Coordinates are WorldMap viewBox units.

import { useEffect, useRef, useState } from 'react';
import { NODES, TRUNKS, TAPS } from '../../lib/interceptLattice';
import {
  nodeXY, nodeAt, EU_MEMBRANE_PATH, HIT_CELL_PATHS, CROWDED, loupeLayout, needsLoupe,
} from './interceptGeometry';

const FAMILY_COLOR = {
  scan: '#f87171', backdoor: '#f87171',
  retain: '#fb923c', traffic: '#fb923c',
  digitalId: '#facc15', age: '#facc15', biometric: '#facc15', worker: '#facc15',
};
const BEND_RADIUS = 36;
const NO_TAPS = new Set();
const NODE_NAME = Object.fromEntries(NODES.map((n) => [n.id, n.name]));
// jsdom has no getScreenCTM; fall back to a 345px-wide phone map.
const PHONE_UNITS_PER_PX = 800 / 345;
// Taps on the loupe are ignored this long after it opens: the fanned-out
// buttons land on top of other nodes' true positions, so a re-tap would misfire.
const LOUPE_SETTLE_MS = 300;
const isTouchish = (type) => type === 'touch' || type === 'pen';

function toMapPoint(svg, clientX, clientY) {
  if (!svg?.createSVGPoint || !svg.getScreenCTM) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const { x, y } = pt.matrixTransform(ctm.inverse());
  return [x, y];
}

function nearestNode([x, y], exclude) {
  let best = null;
  let bestD = BEND_RADIUS;
  for (const n of NODES) {
    if (exclude.includes(n.id)) continue;
    const [nx, ny] = nodeXY(n.id);
    const d = Math.hypot(nx - x, ny - y);
    if (d < bestD) { bestD = d; best = n.id; }
  }
  return best;
}

export default function InterceptOverlay({
  path, src, dst, waypoints, ticks, words, hop, showBead, showFallbackGlow,
  loads, kept, keptCap, marks, traced, highlight, highlightTaps = NO_TAPS, euHighlight, reducedMotion, onActivate,
}) {
  const svgRef = useRef(null);
  const pointerTypeRef = useRef('mouse');
  const [dragging, setDragging] = useState(false);
  const [bendPreview, setBendPreview] = useState(null);
  // The touch loupe's layout, fixed at the rendered scale when it opened.
  const [loupe, setLoupe] = useState(null);
  const loupeFirstRef = useRef(null);
  const loupeOpenerRef = useRef(null);
  const loupeOpenedAtRef = useRef(0);

  useEffect(() => {
    if (loupe) loupeFirstRef.current?.focus?.({ preventScroll: true });
  }, [loupe]);

  const unitsPerPx = () => {
    const a = svgRef.current?.getScreenCTM?.()?.a;
    return a ? 1 / a : PHONE_UNITS_PER_PX;
  };
  // A touch or pen landing on the crowded cluster opens the loupe instead of choosing.
  // `opener` is the node that opened it (null for the membrane), for focus return.
  const openLoupe = (opener) => {
    if (loupe || !isTouchish(pointerTypeRef.current)) return false;
    const upp = unitsPerPx();
    if (!needsLoupe(upp)) return false;
    loupeOpenerRef.current = opener;
    loupeOpenedAtRef.current = performance.now();
    setLoupe({ upp, ...loupeLayout(upp) });
    return true;
  };
  const loupeSettled = () => performance.now() - loupeOpenedAtRef.current >= LOUPE_SETTLE_MS;
  const closeLoupe = (focusId) => {
    setLoupe(null);
    if (focusId) svgRef.current?.querySelector(`[data-node="${focusId}"]`)?.focus?.({ preventScroll: true });
  };
  const pick = (id) => {
    if (!loupeSettled()) return;
    closeLoupe(id);
    onActivate(id, { bend: true });
  };
  const notePointer = (e) => { pointerTypeRef.current = e.pointerType || 'mouse'; };
  // Every pointer route to a node (its core, its cell, a tap on the filament) lands here.
  const nodeClick = (id, shiftKey) => {
    if (CROWDED.includes(id) && openLoupe(id)) return;
    onActivate(id, { bend: shiftKey || isTouchish(pointerTypeRef.current) });
  };
  const pts = path ? path.map(nodeXY) : [];
  const polyPoints = pts.map((p) => p.join(',')).join(' ');

  const onMove = (e) => {
    if (!dragging) return;
    const p = toMapPoint(svgRef.current, e.clientX, e.clientY);
    setBendPreview(p ? nearestNode(p, [src, dst, ...waypoints]) : null);
  };
  const endDrag = () => {
    if (dragging && bendPreview) onActivate(bendPreview, { bend: true });
    setDragging(false);
    setBendPreview(null);
  };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 800 400"
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: dragging ? 'none' : 'auto' }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      data-testid="intercept-overlay"
    >
      <path
        d={EU_MEMBRANE_PATH}
        fill="#fb923c" fillOpacity={euHighlight ? 0.14 : 0.04}
        stroke="#fb923c" strokeOpacity={euHighlight ? 0.45 : 0.12}
        strokeWidth="0.6" strokeDasharray="2 3"
        data-testid="eu-membrane" data-highlight={euHighlight ? 'true' : 'false'}
        onPointerUp={notePointer}
        onClick={() => openLoupe(null)}
      />

      {traced.map((i) => {
        const [a, b] = TRUNKS[i];
        const [x1, y1] = nodeXY(a);
        const [x2, y2] = nodeXY(b);
        return <line key={`traced-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fb923c" strokeOpacity="0.5" strokeWidth="0.7" strokeDasharray="1 2.5" />;
      })}

      {/* Hit cells sit under the filament's grab band, so mouse drag-to-bend
          works right up to a node's core; the core (in the node group) sits above it. */}
      {NODES.map((n) => (
        <path
          key={`cell-${n.id}`} d={HIT_CELL_PATHS[n.id]} fill="transparent" aria-hidden="true"
          data-hit-cell={n.id} style={{ cursor: 'pointer' }}
          onPointerUp={notePointer}
          onClick={(e) => nodeClick(n.id, e.shiftKey)}
        />
      ))}

      {pts.length > 1 && (
        <g>
          <polyline points={polyPoints} fill="none" stroke="#fde68a" strokeOpacity="0.75" strokeWidth="0.8" strokeLinejoin="round" data-testid="route-filament" />
          <polyline
            points={polyPoints} fill="none" stroke="transparent" strokeWidth="12"
            style={{ cursor: 'grab', pointerEvents: 'stroke' }}
            data-testid="route-grab"
            onPointerDown={(e) => {
              // Touch and pen bend by tapping (spec §9), never by dragging.
              if (isTouchish(e.pointerType)) return;
              e.preventDefault();
              setDragging(true);
            }}
            onPointerUp={notePointer}
            onClick={(e) => {
              if (!isTouchish(pointerTypeRef.current)) return;
              const p = toMapPoint(svgRef.current, e.clientX, e.clientY);
              const id = p && nodeAt(p);
              if (id) nodeClick(id, e.shiftKey);
            }}
          />
        </g>
      )}

      {bendPreview && (() => {
        const [x, y] = nodeXY(bendPreview);
        return <circle cx={x} cy={y} r="10" fill="none" stroke="#fde68a" strokeOpacity="0.6" strokeDasharray="2 2" />;
      })()}

      {NODES.map((n) => {
        const [x, y] = nodeXY(n.id);
        const role = n.id === src ? 'source' : n.id === dst ? 'destination' : waypoints.includes(n.id) ? 'waypoint' : null;
        const tickList = ticks[n.id] ?? [];
        const onCount = tickList.filter((state) => state === 'on').length;
        const contestedCount = tickList.filter((state) => state === 'flicker').length;
        const lit = highlight.has(n.id);
        const load = loads[n.id] ?? 0;
        const k = kept[n.id] ?? 0;
        return (
          <g
            key={n.id}
            role="button"
            tabIndex={loupe ? -1 : 0}
            aria-label={`${n.name} · ${onCount} ${onCount === 1 ? 'tap' : 'taps'} in force${contestedCount ? ` · ${contestedCount} contested` : ''}${role ? ` · ${role}` : ''}`}
            data-node={n.id}
            data-highlight={lit ? 'true' : 'false'}
            style={{ cursor: 'pointer', outline: 'none' }}
            onPointerUp={notePointer}
            onClick={(e) => nodeClick(n.id, e.shiftKey)}
            onKeyDown={(e) => {
              if (e.repeat) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate(n.id, { bend: e.shiftKey });
              }
            }}
          >
            <title>{n.name}</title>
            <circle cx={x} cy={y} r="8" fill="transparent" data-hit-core="true" />
            {showFallbackGlow && <circle cx={x} cy={y} r={3 + 8 * load} fill="#fb923c" fillOpacity={0.12 + 0.3 * load} />}
            {showFallbackGlow && k > 0 && (
              <circle cx={x} cy={y} r="7" fill="none" stroke="#fb923c" strokeOpacity={0.15 + 0.5 * (k / keptCap)} strokeWidth="0.8" />
            )}
            {tickList.map((state, i) => {
              if (!state) return null;
              const tap = TAPS[i];
              const tickLit = lit && highlightTaps.has(tap.key);
              const ang = ((i * 45 - 90) * Math.PI) / 180;
              const c = Math.cos(ang);
              const s = Math.sin(ang);
              return (
                <line
                  key={tap.key}
                  x1={x + c * 4} y1={y + s * 4} x2={x + c * 7} y2={y + s * 7}
                  stroke={FAMILY_COLOR[tap.key]} strokeOpacity={tickLit ? 1 : state === 'on' ? 0.85 : 0.5}
                  strokeWidth={tickLit ? 1.6 : 0.9} strokeLinecap="round"
                  className={state === 'flicker' ? 'iv-flicker' : undefined}
                  data-tick={tap.key} data-state={state} data-highlight={tickLit ? 'true' : 'false'}
                />
              );
            })}
            <circle cx={x} cy={y} r={role ? 2.8 : 2} fill={role ? '#fde68a' : '#fdba74'} />
            <circle className="iv-focus-ring" cx={x} cy={y} r="5.5" fill="none" stroke="#fde68a" strokeWidth="1.2" style={{ pointerEvents: 'none' }} />
            {lit && <circle className="iv-pulse" cx={x} cy={y} r="10" fill="none" stroke="#fdba74" strokeWidth="0.8" />}
            {marks.watch === n.id && (
              <circle cx={x} cy={y} r="9.5" fill="none" stroke="#f87171" strokeOpacity="0.55" strokeWidth="0.7" data-mark="watched" />
            )}
            {marks.read.includes(n.id) && (
              <circle cx={x + 6.5} cy={y} r="1.1" fill="#fca5a5" data-mark="read">
                {!reducedMotion && (
                  <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="5s" repeatCount="indefinite" />
                )}
              </circle>
            )}
            <text x={x} y={y + 15} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#fed7aa" fillOpacity="0.5" style={{ pointerEvents: 'none' }}>
              {n.id}
            </text>
          </g>
        );
      })}

      {showBead && path && path.length > 1 && hop != null && (() => {
        const [x, y] = nodeXY(path[Math.min(hop, path.length - 1)]);
        return <circle cx={x} cy={y} r="2.6" fill="#fff7ed" data-testid="fallback-bead" />;
      })()}

      {words.map((w) => {
        const [x, y] = nodeXY(w.node);
        return (
          <text
            key={w.id} className="iv-word"
            x={x} y={y - 11 - w.slot * 8}
            textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#fff7ed"
            style={{ pointerEvents: 'none' }}
            data-word={w.key}
          >
            {w.word}
          </text>
        );
      })}

      {loupe && (
        <g
          role="dialog"
          aria-label="european cluster"
          data-testid="eu-loupe"
          onKeyDown={(e) => { if (e.key === 'Escape') closeLoupe(loupeOpenerRef.current); }}
        >
          <rect
            x="0" y="0" width="800" height="400" fill="#000" fillOpacity="0.45"
            data-testid="loupe-backdrop"
            onClick={() => { if (loupeSettled()) closeLoupe(loupeOpenerRef.current); }}
          />
          {loupe.items.map((it) => (
            <g key={`line-${it.id}`} style={{ pointerEvents: 'none' }}>
              <line x1={it.x} y1={it.y} x2={it.fromX} y2={it.fromY} stroke="#fdba74" strokeOpacity="0.35" strokeWidth={0.6 * loupe.upp} />
              <circle cx={it.fromX} cy={it.fromY} r={1.5 * loupe.upp} fill="#fdba74" />
            </g>
          ))}
          {loupe.items.map((it, i) => {
            const hasRole = it.id === src || it.id === dst || waypoints.includes(it.id);
            return (
              <g
                key={it.id}
                ref={i === 0 ? loupeFirstRef : undefined}
                role="button"
                tabIndex={0}
                aria-label={NODE_NAME[it.id]}
                data-loupe-node={it.id}
                className={reducedMotion ? undefined : 'iv-loupe-in'}
                style={{ cursor: 'pointer', '--dx': it.fromX - it.x, '--dy': it.fromY - it.y }}
                onClick={() => pick(it.id)}
                onKeyDown={(e) => {
                  if (e.repeat) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick(it.id);
                  }
                }}
              >
                <circle
                  cx={it.x} cy={it.y} r={loupe.btnR}
                  fill="#1c0f06" fillOpacity="0.9"
                  stroke={hasRole ? '#fde68a' : '#fb923c'} strokeOpacity="0.6" strokeWidth={loupe.upp}
                />
                <text
                  x={it.x} y={it.y} textAnchor="middle" dominantBaseline="central"
                  fontSize={12 * loupe.upp} fontFamily="monospace" fill="#fed7aa"
                >
                  {it.id}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

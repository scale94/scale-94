import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  MANDALA_SECTOR_ORDER,
  sectorAngle,
  polarToCartesian,
  wedgePath,
  nodePosition,
} from './MandalaGeometry';
import { MANIFESTO_CHAPTERS, CHAPTER_BY_ID } from '../../data/manifestoChapters';
import { NODES, NODE_IDX, FEATURES } from '../../data/nodeFeatures';
import { nodeColor } from '../../data/kernelColorMap';
import { MANIFESTO_BEACONS } from '../../data/manifestoBeacons';
import CenterHUD from './CenterHUD';
import BeaconCard from './BeaconCard';
import ChapterPanel from './ChapterPanel';

// Tailwind color tokens used throughout (match existing terminal palette).
const RING_STROKE = '#164e63';
const SPOKE_STROKE = '#164e63';

function useContainerSize(ref) {
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setSize({ width: el.clientWidth || 800, height: el.clientHeight || 600 });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

const Mandala = ({ setArchitectThesis, systemArticles }) => {
  const containerRef = useRef(null);
  const { width, height } = useContainerSize(containerRef);

  const [hover, setHover] = useState(null);
  // hover shape: { type: 'beacon', data: beaconObject } | { type: 'chapter', data: chapterObject } | null

  const [selected, setSelected] = useState(null);
  // selected shape: a beacon object, or null.

  const [readBeacons, setReadBeacons] = useState(() => new Set());
  const [selectedChapter, setSelectedChapter] = useState(null);
  // shape: { chapter: chapterObject, index: number } | null

  // Responsive outer radius (spec §6.3).
  const minDim = Math.min(width, height);
  let radiusScale = 0.38;
  if (minDim < 960 && minDim >= 720) radiusScale = 0.42;
  else if (minDim < 720 && minDim >= 480) radiusScale = 0.46;
  else if (minDim < 480) radiusScale = 0.48;
  const R = minDim * radiusScale;

  const isMobile = minDim < 720;

  const handleBeaconEnter = (beacon) => setHover({ type: 'beacon', data: beacon });
  const handleBeaconLeave = () => setHover(null);

  const handleBeaconClick = (beacon, e) => {
    e?.stopPropagation?.();
    if (isMobile) {
      // Two-tap: first tap = hover preview, second tap on same beacon = open.
      if (hover?.type === 'beacon' && hover.data.nodeId === beacon.nodeId) {
        setSelected(beacon);
        setReadBeacons(prev => {
          const next = new Set(prev);
          next.add(beacon.nodeId);
          return next;
        });
      } else {
        setHover({ type: 'beacon', data: beacon });
      }
    } else {
      setSelected(beacon);
      setReadBeacons(prev => {
        const next = new Set(prev);
        next.add(beacon.nodeId);
        return next;
      });
    }
  };

  const handleContainerClick = (e) => {
    if (isMobile && !selected && e.target === e.currentTarget) {
      setHover(null);
    }
  };

  const closeSelected = () => setSelected(null);

  // Esc key closes beacon card.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => { if (e.key === 'Escape') closeSelected(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Esc also closes chapter panel.
  useEffect(() => {
    if (!selectedChapter) return;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedChapter(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedChapter]);

  const cx = width / 2;
  const cy = height / 2;

  const viewBox = `${-cx} ${-cy} ${width} ${height}`;

  // 6 chapter territories as wedge paths.
  const chapterWedges = (() => {
    let cursor = 0;
    return MANIFESTO_CHAPTERS.map((ch, i) => {
      const startIdx = cursor;
      const endIdx = cursor + ch.sectors.length;
      cursor = endIdx;
      // Start arc at the left edge of the first sector, end at the right edge of the last.
      // Each sector occupies 2π/16 rad; place spokes at sector centers so the wedge
      // spans from (startIdx - 0.5) to (endIdx - 0.5) in sector units.
      const sliceRad = (2 * Math.PI) / 16;
      const startAngle = (startIdx - 0.5) * sliceRad;
      const endAngle = (endIdx - 0.5) * sliceRad;
      return {
        id: ch.id,
        startAngle,
        endAngle,
        midAngle: (startAngle + endAngle) / 2,
        fill: `hsla(${(i * 60) % 360}, 70%, 50%, 0.10)`,
      };
    });
  })();

  // Pre-compute speck positions once per radius change.
  const specks = useMemo(() => {
    return NODES.map((n, idx) => ({
      id: n.id,
      ...nodePosition(n, FEATURES[idx], R),
    }));
  }, [R]);

  // Pre-compute beacon positions + colors.
  const beacons = useMemo(() => {
    return MANIFESTO_BEACONS.map(b => {
      const idx = NODE_IDX[b.nodeId];
      const node = NODES[idx];
      const { x, y } = nodePosition(node, FEATURES[idx], R);
      const color = nodeColor(b.nodeId, node.cluster);
      return {
        nodeId: b.nodeId,
        chapter: b.chapter,
        quote: b.quote,
        cluster: node.cluster,
        x, y,
        color: color.hsl,
      };
    });
  }, [R]);

  const showLabels = minDim >= 720;
  const hudRadius = minDim < 480 ? 44 : minDim < 720 ? 48 : minDim < 960 ? 54 : 60;

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black relative"
      style={{ minHeight: '80vh' }}
      onClick={handleContainerClick}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        style={{ display: 'block' }}
      >
        <defs>
          <style>{`
            g[role="button"]:focus-visible circle {
              stroke: #ffffff !important;
              stroke-opacity: 0.9 !important;
            }
          `}</style>
        </defs>
        <g
          style={{
            filter: (selected || selectedChapter) ? 'blur(3px) brightness(0.4)' : 'none',
            transition: 'filter 250ms ease',
          }}
        >
          {/* ── Chapter territory wedges ─────────────────────────── */}
          <g>
            {chapterWedges.map((w, i) => {
              const isHovered = hover?.type === 'chapter' && hover.data.id === w.id;
              return (
                <path
                  key={w.id}
                  d={wedgePath(w.startAngle, w.endAngle, R)}
                  fill={w.fill}
                  stroke="none"
                  opacity={isHovered ? 2.2 : 1}
                  onMouseEnter={() => setHover({ type: 'chapter', data: CHAPTER_BY_ID[w.id] })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelectedChapter({ chapter: CHAPTER_BY_ID[w.id], index: i })}
                  style={{ cursor: 'pointer', pointerEvents: 'all' }}
                />
              );
            })}
          </g>

          {/* ── Concentric rings ─────────────────────────────────── */}
          <g>
            <circle r={R} fill="none" stroke={RING_STROKE} strokeWidth="0.8" />
            <circle r={R * 0.75} fill="none" stroke={RING_STROKE} strokeWidth="0.4" strokeDasharray="2 4" opacity="0.7" />
            <circle r={R * 0.5} fill="none" stroke={RING_STROKE} strokeWidth="0.4" strokeDasharray="2 4" opacity="0.7" />
            <circle r={R * 0.25} fill="none" stroke={RING_STROKE} strokeWidth="0.4" strokeDasharray="2 4" opacity="0.7" />
          </g>

          {/* ── 16 sector spokes ─────────────────────────────────── */}
          <g>
            {MANDALA_SECTOR_ORDER.map((_, i) => {
              const { x, y } = polarToCartesian(sectorAngle(i), R);
              return (
                <line
                  key={i}
                  x1="0" y1="0"
                  x2={x.toFixed(2)} y2={y.toFixed(2)}
                  stroke={SPOKE_STROKE}
                  strokeWidth="0.3"
                  opacity="0.8"
                />
              );
            })}
          </g>

          {/* ── 256 ambient specks ────────────────────────────────── */}
          <g>
            {specks.map(s => (
              <circle
                key={s.id}
                cx={s.x.toFixed(2)}
                cy={s.y.toFixed(2)}
                r={minDim < 480 ? 0.5 : minDim < 720 ? 0.6 : minDim < 960 ? 0.8 : 1}
                fill="#06b6d4"
                opacity={minDim < 480 ? 0.20 : minDim < 720 ? 0.25 : 0.35}
              />
            ))}
          </g>

          {/* ── ~36 curated beacons ───────────────────────────────── */}
          <g>
            {beacons.map(b => {
              const isHovered = hover?.type === 'beacon' && hover.data.nodeId === b.nodeId;
              const dist = Math.hypot(b.x, b.y) || 1;
              const labelX = b.x + (b.x / dist) * 10;
              const labelY = b.y + (b.y / dist) * 10;
              return (
                <g
                  key={b.nodeId}
                  tabIndex={0}
                  role="button"
                  aria-label={`beacon ${b.nodeId}`}
                  onMouseEnter={() => handleBeaconEnter(b)}
                  onMouseLeave={handleBeaconLeave}
                  onFocus={() => handleBeaconEnter(b)}
                  onBlur={handleBeaconLeave}
                  onClick={(e) => handleBeaconClick(b, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(b);
                    }
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {/* Invisible hit box for touch / small beacons (36x36). */}
                  <rect
                    x={(b.x - 18).toFixed(2)}
                    y={(b.y - 18).toFixed(2)}
                    width="36"
                    height="36"
                    fill="transparent"
                  />
                  <circle
                    cx={b.x.toFixed(2)}
                    cy={b.y.toFixed(2)}
                    r={isHovered ? 4 : 3}
                    fill={b.color}
                    stroke={b.color}
                    strokeOpacity={isHovered ? 0.7 : 0.3}
                    strokeWidth="4"
                  />
                  {showLabels && (
                    <text
                      x={labelX.toFixed(2)}
                      y={labelY.toFixed(2)}
                      fill={b.color}
                      fontFamily="monospace"
                      fontSize="7"
                      fontWeight={isHovered ? 'bold' : 'normal'}
                      textAnchor={b.x >= 0 ? 'start' : 'end'}
                      dominantBaseline="middle"
                    >
                      {b.nodeId}
                    </text>
                  )}
                  {showLabels && readBeacons.has(b.nodeId) && (
                    <text
                      x={(labelX + (b.x >= 0 ? 52 : -52)).toFixed(2)}
                      y={labelY.toFixed(2)}
                      fill="#39ff14"
                      fontFamily="monospace"
                      fontSize="7"
                      textAnchor={b.x >= 0 ? 'start' : 'end'}
                      dominantBaseline="middle"
                    >
                      ✓
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* ── Chapter perimeter labels ─────────────────────────── */}
          {minDim >= 720 && (
            <g pointerEvents="none">
              {chapterWedges.map((w, i) => {
                const labelR = R * 1.05;
                const { x, y } = polarToCartesian(w.midAngle, labelR);
                const chapter = MANIFESTO_CHAPTERS[i];
                return (
                  <text
                    key={`label-${w.id}`}
                    x={x.toFixed(2)}
                    y={y.toFixed(2)}
                    fill={`hsl(${(i * 60) % 360}, 70%, 60%)`}
                    fontFamily="monospace"
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    opacity="0.7"
                  >
                    {chapter.number} {chapter.title}
                  </text>
                );
              })}
            </g>
          )}
        </g>

        {/* Center HUD is NOT blurred — it absorbs the close affordance. */}
        <CenterHUD
          radius={hudRadius}
          hover={hover}
          selected={!!selected}
          onOpenThesis={() => setArchitectThesis?.(true)}
          onClose={closeSelected}
        />
      </svg>

      {selected && (
        <>
          {/* Click-outside overlay. */}
          <div
            className="absolute inset-0"
            style={{ zIndex: 30 }}
            onClick={closeSelected}
          />
          <BeaconCard
            beacon={selected}
            onClose={closeSelected}
            isMobile={isMobile}
          />
        </>
      )}

      {selectedChapter && (
        <ChapterPanel
          chapter={selectedChapter.chapter}
          chapterIndex={selectedChapter.index}
          onClose={() => setSelectedChapter(null)}
        />
      )}
    </div>
  );
};

export default Mandala;

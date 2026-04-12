import React, { useRef, useState, useEffect } from 'react';
import {
  MANDALA_SECTOR_ORDER,
  sectorAngle,
  polarToCartesian,
  wedgePath,
} from './MandalaGeometry';
import { MANIFESTO_CHAPTERS } from '../../data/manifestoChapters';

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

  // Responsive outer radius (spec §6.3).
  const minDim = Math.min(width, height);
  let radiusScale = 0.38;
  if (minDim < 960 && minDim >= 720) radiusScale = 0.42;
  else if (minDim < 720 && minDim >= 480) radiusScale = 0.46;
  else if (minDim < 480) radiusScale = 0.48;
  const R = minDim * radiusScale;

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

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black relative"
      style={{ minHeight: '80vh' }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        style={{ display: 'block' }}
      >
        {/* ── Chapter territory wedges ─────────────────────────── */}
        <g>
          {chapterWedges.map(w => (
            <path
              key={w.id}
              d={wedgePath(w.startAngle, w.endAngle, R)}
              fill={w.fill}
              stroke="none"
            />
          ))}
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
      </svg>
    </div>
  );
};

export default Mandala;

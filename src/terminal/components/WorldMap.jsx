// WorldMap.jsx — Shared Natural Earth 1 map SVG component
// Uses geoNaturalEarth1 projection via worldMapPolys.js (pre-computed paths)
// ViewBox: 0 0 800 400 · sphere clip · 30° graticule · radar scan animation

import { useId } from 'react';
import { LAND_PATH, BORDERS_PATH, SPHERE_PATH, GRATICULE_PATH, EQUATOR_PATH } from '../data/worldMapPolys';

// ── Colour palettes ──────────────────────────────────────────────────────────
const PALETTES = {
  orange: {
    ocean:    'rgba(249,115,22,0.015)',
    sphereFill: 'rgba(249,115,22,0.02)',
    border:   'rgba(249,115,22,0.25)',
    grat:     'rgba(249,115,22,0.08)',
    equator:  'rgba(249,115,22,0.22)',
    land:     'rgba(249,115,22,0.07)',
    landEdge: 'rgba(249,115,22,0.30)',
    scan:     [249, 115, 22],
  },
  green: {
    ocean:    'rgba(57,255,20,0.012)',
    sphereFill: 'rgba(57,255,20,0.015)',
    border:   'rgba(57,255,20,0.18)',
    grat:     'rgba(57,255,20,0.07)',
    equator:  'rgba(57,255,20,0.18)',
    land:     'rgba(57,255,20,0.05)',
    landEdge: 'rgba(57,255,20,0.22)',
    scan:     [57, 255, 20],
  },
};

// ── Component ────────────────────────────────────────────────────────────────
// Props:
//   palette   — 'orange' | 'green'  (default: 'orange')
//   height    — rendered height in px (default: 200)
//   scanDur   — scan sweep duration in seconds (default: 6)
//   children  — dots / markers rendered inside the sphere clip
const WorldMap = ({ palette = 'orange', height = 200, scanDur = 6, children }) => {
  const uid   = useId();
  const clipId = `wm-clip${uid}`;
  const scanId = `wm-scan${uid}`;

  const c = PALETTES[palette] ?? PALETTES.orange;
  const [sr, sg, sb] = c.scan;

  return (
    <svg
      viewBox="0 0 800 400"
      className="w-full"
      style={{ height }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Sphere boundary — used as clip path so nothing bleeds past the projection edge */}
        <clipPath id={clipId}>
          <path d={SPHERE_PATH} />
        </clipPath>

        {/* Scan bar gradient — scoped ID prevents collision when both tabs are mounted */}
        <linearGradient id={scanId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor={`rgb(${sr},${sg},${sb})`} stopOpacity="0" />
          <stop offset="50%"  stopColor={`rgb(${sr},${sg},${sb})`} stopOpacity="0.4" />
          <stop offset="100%" stopColor={`rgb(${sr},${sg},${sb})`} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ocean fill (outside clip — sphere shape) */}
      <path d={SPHERE_PATH} fill={c.sphereFill} />

      {/* Clipped layer: graticule + land + scan bar + dot children */}
      <g clipPath={`url(#${clipId})`}>
        {/* Curved Natural Earth graticule */}
        <path d={GRATICULE_PATH} fill="none" stroke={c.grat} strokeWidth="0.45">
          <animate attributeName="opacity" values="0.65;1;0.65" dur="5s" repeatCount="indefinite" />
        </path>

        {/* Equator — distinct weight */}
        <path d={EQUATOR_PATH} fill="none" stroke={c.equator} strokeWidth="0.75" />

        {/* Land silhouette — Natural Earth 110m (single merged path) */}
        <path d={LAND_PATH} fill={c.land} stroke={c.landEdge} strokeWidth="0.5" strokeLinejoin="round" />

        {/* Internal country borders — faint, excluded from coastline stroke */}
        <path d={BORDERS_PATH} fill="none" stroke={c.landEdge} strokeWidth="0.25" strokeOpacity="0.5" />

        {/* Radar scan bar */}
        <rect x="0" y="0" width="10" height="400" fill={`url(#${scanId})`} opacity="0.5">
          <animateTransform
            attributeName="transform"
            type="translate"
            from="-10 0"
            to="810 0"
            dur={`${scanDur}s`}
            repeatCount="indefinite"
          />
        </rect>

        {/* Dots / markers passed by consumers */}
        {children}
      </g>

      {/* Sphere border — rendered on top so it frames the clipped content */}
      <path d={SPHERE_PATH} fill="none" stroke={c.border} strokeWidth="0.9" />
    </svg>
  );
};

export default WorldMap;

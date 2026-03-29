// worldMapPolys.js — World map paths for Natural Earth 1 projection
// Projection: geoNaturalEarth1  ViewBox: 0 0 800 400
// Scale 127 · translate [400, 205]
//   Poles at y≈24 (N) / y≈386 (S) · antimeridian at x≈53 / x≈747
//
// Land data: Natural Earth 110m via world-atlas@2 (topojson-client)

import { geoNaturalEarth1, geoPath, geoGraticule, geoCentroid } from 'd3-geo';
import * as topojson from 'topojson-client';
import topology from 'world-atlas/countries-110m.json';

// ── Projection ────────────────────────────────────────────────────────────────
export const projection = geoNaturalEarth1()
  .scale(127)
  .translate([400, 205]);

const pathGen = geoPath(projection);

// ── Project lon/lat → SVG pixel coords ───────────────────────────────────────
export const toMapXY = (lon, lat) => {
  const r = projection([lon, lat]);
  return r ? [r[0], r[1]] : [400, 205];
};

// ── Sphere outline ────────────────────────────────────────────────────────────
export const SPHERE_PATH = pathGen({ type: 'Sphere' }) || '';

// ── Graticule — 30° curved grid lines ────────────────────────────────────────
export const GRATICULE_PATH = pathGen(geoGraticule().step([30, 30])()) || '';

// ── Equator ───────────────────────────────────────────────────────────────────
export const EQUATOR_PATH = pathGen({
  type: 'LineString',
  coordinates: Array.from({ length: 37 }, (_, i) => [-180 + i * 10, 0]),
}) || '';

// ── Land silhouette (merged, for WorldMap component) ──────────────────────────
const landFeature = topojson.feature(topology, topology.objects.land);
export const LAND_PATH = pathGen(landFeature) || '';

// ── Country border mesh (interior edges only) ─────────────────────────────────
const bordersMesh = topojson.mesh(topology, topology.objects.countries, (a, b) => a !== b);
export const BORDERS_PATH = pathGen(bordersMesh) || '';

// ── Per-country data for the collapsing map hero ──────────────────────────────
// Pre-computed at module load — stable references, zero runtime cost.
//
// Each entry:
//   d       SVG path string
//   cx, cy  projected centroid (SVG coords)
//   dx, dy  normalised outward drift direction from map centre
//   vuln    biosphere vulnerability [0,1]: tropics/poles most fragile
//   seed    deterministic per-country random [0,1) for stagger
//   seed2   second independent random for wobble y-axis

const MAP_CX = 400, MAP_CY = 205; // SVG centre matches projection translate

const _countries = topojson.feature(topology, topology.objects.countries).features;

export const COUNTRIES = _countries.map((feature, i) => {
  const d = pathGen(feature) || '';
  if (d.length < 10) return null; // skip clipped/empty geometries

  // Geographic centroid → SVG coords
  const lonlat = geoCentroid(feature);
  const proj   = projection(lonlat) || [MAP_CX, MAP_CY];
  const cx = proj[0];
  const cy = proj[1];

  // Outward drift direction from map centre (normalised)
  const ddx = cx - MAP_CX;
  const ddy = cy - MAP_CY;
  const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;

  // Biosphere vulnerability based on latitude band
  const lat    = lonlat[1] || 0;
  const absLat = Math.abs(lat);
  const vuln   = absLat < 15 ? 0.92   // equatorial / tropical
               : absLat > 65 ? 0.80   // polar
               : absLat < 35 ? 0.72   // subtropical
               : 0.50;                // temperate

  // Two independent deterministic randoms (LCG seeded by index)
  const s1 = ((i * 2654435761 + 1013904223) >>> 0) / 0xFFFFFFFF;
  const s2 = ((i * 1664525    + 1013904223) >>> 0) / 0xFFFFFFFF;

  return {
    d,
    cx, cy,
    dx: ddx / len,
    dy: ddy / len,
    vuln,
    seed:  s1,
    seed2: s2,
  };
}).filter(Boolean);

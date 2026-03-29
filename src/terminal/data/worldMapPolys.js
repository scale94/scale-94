// worldMapPolys.js — World map paths for Natural Earth 1 projection
// Projection: geoNaturalEarth1  ViewBox: 0 0 800 400
// Scale 127 · translate [400, 205]
//   Poles at y≈24 (N) / y≈386 (S) · antimeridian at x≈53 / x≈747
//
// Land data: Natural Earth 110m via world-atlas@2 (topojson-client)
// Replaces hand-crafted polygon arrays with accurate country geometry.

import { geoNaturalEarth1, geoPath, geoGraticule } from 'd3-geo';
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
// Used as clip-path source and outer border stroke.
export const SPHERE_PATH = pathGen({ type: 'Sphere' }) || '';

// ── Graticule — 30° curved grid lines ────────────────────────────────────────
export const GRATICULE_PATH = pathGen(geoGraticule().step([30, 30])()) || '';

// ── Equator — rendered at distinct weight ─────────────────────────────────────
export const EQUATOR_PATH = pathGen({
  type: 'LineString',
  coordinates: Array.from({ length: 37 }, (_, i) => [-180 + i * 10, 0]),
}) || '';

// ── Land silhouette (Natural Earth 110m) ──────────────────────────────────────
// Single merged path — fill only, no per-country coloring.
const landFeature = topojson.feature(topology, topology.objects.land);
export const LAND_PATH = pathGen(landFeature) || '';

// ── Internal country borders ──────────────────────────────────────────────────
// mesh() with (a,b) => a !== b excludes coastlines (already in LAND_PATH stroke).
const bordersMesh = topojson.mesh(topology, topology.objects.countries, (a, b) => a !== b);
export const BORDERS_PATH = pathGen(bordersMesh) || '';

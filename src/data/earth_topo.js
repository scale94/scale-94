// ─────────────────────────────────────────────────────────────────────────────
// earth_topo.js  —  Geographic Point Dataset for Spherical Render Pipeline
//
// Generates DOT_COUNT points on a structured lat/lon grid (not a Fibonacci
// uniform sphere) so the rendered globe is geographically recognisable.
//
// Land classification uses a simplified polygon-in-polygon test against
// the eight major landmasses encoded as concave polygon vertex lists.
// Accuracy is ~4–6° — sufficient for 2048-dot resolution.
//
// Depth values:
//   Ocean: +0.5 to +5.5 km below sea level  (positive = deeper)
//   Land:  -0.05 to -2.5 km above sea level (negative = higher elevation)
// These feed the topo WASM depth_scale modifier for subtle relief.
// ─────────────────────────────────────────────────────────────────────────────

// ── Continent polygons ────────────────────────────────────────────────────────
// Each polygon is an array of [lat, lon] vertices (closed; last implicitly
// connects back to first). Ray-cast point-in-polygon test is used.
// Outlines are simplified to ~20 vertices — enough for 5° resolution.

const CONTINENT_POLYGONS = {
  // North America (excluding Central America and Caribbean)
  north_america: [
    [72, -141], [84, -120], [83, -70], [73, -62], [63, -64],
    [60, -64],  [47, -53],  [44, -66], [35, -76], [25, -81],
    [22, -88],  [22, -106], [30, -110],[32, -117],[38, -123],
    [49, -124], [59, -138], [60, -148],[70, -163],[72, -168],
    [72, -141],
  ],
  // Central America (thin isthmus)
  central_america: [
    [22, -88], [22, -81], [8, -77], [8, -83], [15, -92], [22, -88],
  ],
  // South America
  south_america: [
    [12, -72], [12, -62], [8, -60],  [3, -51],  [-5, -35],
    [-15, -39],[-24, -43],[-34, -53],[-55, -65],[-55, -68],
    [-50, -74],[-46, -75],[-40, -72],[-30, -70],[-18, -70],
    [-5, -81], [0, -80],  [8, -77],  [8, -83],  [10, -85],
    [11, -85], [12, -72],
  ],
  // Europe (including Scandinavia + British Isles approximated)
  europe: [
    [71, 28],  [70, 18],  [63, 5],   [58, 5],   [51, 2],
    [51, -2],  [50, -5],  [43, -9],  [36, -9],  [36, 0],
    [38, 5],   [37, 15],  [38, 26],  [41, 29],  [42, 28],
    [47, 22],  [48, 18],  [50, 14],  [54, 18],  [57, 21],
    [60, 25],  [65, 26],  [70, 28],  [71, 28],
  ],
  // Africa
  africa: [
    [37, -6],  [37, 12],  [33, 12],  [30, 32],  [22, 38],
    [12, 44],  [11, 51],  [2, 41],   [-5, 40],  [-10, 40],
    [-18, 35], [-26, 33], [-34, 26], [-35, 18], [-28, 17],
    [-18, 12], [-5, 8],   [4, 7],    [5, -5],   [10, -16],
    [14, -17], [20, -17], [28, -13], [32, -1],  [37, -6],
  ],
  // Asia (main Eurasian body east of Europe, excluding SE Asia peninsula)
  asia: [
    [77, 68],  [77, 104], [72, 140], [68, 141], [60, 140],
    [51, 143], [46, 135], [42, 131], [38, 122], [32, 121],
    [25, 122], [22, 114], [20, 110], [20, 100], [16, 99],
    [10, 100], [5, 100],  [5, 103],  [2, 103],  [1, 104],
    [4, 116],  [2, 109],  [6, 117],  [8, 117],  [10, 124],
    [14, 121], [18, 120], [22, 121], [25, 122], [28, 84],
    [35, 73],  [30, 61],  [22, 59],  [12, 44],  [30, 32],
    [33, 36],  [38, 27],  [41, 36],  [45, 41],  [47, 54],
    [55, 60],  [68, 68],  [77, 68],
  ],
  // Greenland
  greenland: [
    [83, -22], [83, -35], [76, -68], [70, -53], [62, -43],
    [60, -44], [65, -54], [68, -26], [76, -18], [83, -22],
  ],
  // Australia
  australia: [
    [-10, 142],[-14, 136],[-12, 130],[-14, 127],[-20, 114],
    [-26, 113],[-34, 115],[-38, 146],[-39, 148],[-38, 150],
    [-34, 151],[-28, 153],[-24, 152],[-18, 146],[-15, 145],
    [-10, 142],
  ],
  // Antarctica (simplified as a cap below -60°)
  // Handled separately via latitude threshold.
};

// ── Point-in-polygon (ray-cast) ───────────────────────────────────────────────

function pointInPolygon(lat, lon, poly) {
  let inside = false;
  const n = poly.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = poly[i][1], yi = poly[i][0];
    const xj = poly[j][1], yj = poly[j][0];
    const intersect =
      ((yi > lat) !== (yj > lat)) &&
      (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}

// ── Land/ocean classifier ─────────────────────────────────────────────────────

/**
 * Returns true if (lat, lon) falls on land.
 * Uses simplified continental polygons — accurate to ~4–6°.
 */
export function isLandPoint(lat, lon) {
  // Normalise longitude to [-180, 180]
  lon = ((lon + 180) % 360 + 360) % 360 - 180;

  // Antarctica: everything below -60°
  if (lat < -60) return true;

  // Greenland
  if (pointInPolygon(lat, lon, CONTINENT_POLYGONS.greenland)) return true;

  // Iceland
  if (lat > 63 && lat < 67 && lon > -25 && lon < -12) return true;

  // British Isles (not in Europe polygon)
  if (lat > 50 && lat < 59 && lon > -11 && lon < 2) return true;

  // Japan (main islands)
  if (lat > 31 && lat < 46 && lon > 129 && lon < 146) return true;

  // New Zealand
  if (lat > -47 && lat < -34 && lon > 166 && lon < 178) return true;

  // New Guinea
  if (lat > -9 && lat < 0 && lon > 131 && lon < 151) return true;

  // Borneo
  if (lat > -4 && lat < 7 && lon > 108 && lon < 119) return true;

  // Sumatra
  if (lat > -6 && lat < 6 && lon > 95 && lon < 108) return true;

  // Java
  if (lat > -9 && lat < -5 && lon > 105 && lon < 115) return true;

  // Philippines
  if (lat > 5 && lat < 20 && lon > 118 && lon < 128) return true;

  // Sri Lanka
  if (lat > 6 && lat < 10 && lon > 79 && lon < 82) return true;

  // Madagascar
  if (lat > -26 && lat < -12 && lon > 43 && lon < 51) return true;

  // Arabian Peninsula
  if (lat > 12 && lat < 30 && lon > 44 && lon < 60) return true;

  // Indian Subcontinent (extends below Asia polygon)
  if (lat > 8 && lat < 28 && lon > 68 && lon < 80) return true;

  // Cuba / Caribbean (rough)
  if (lat > 20 && lat < 24 && lon > -85 && lon < -74) return true;

  // Russia's far east (Kamchatka, Chukotka) wrapping past 140°E
  if (lat > 51 && lat < 67 && lon > 155 && lon < 180) return true;

  // Check main continent polygons
  const polys = [
    CONTINENT_POLYGONS.north_america,
    CONTINENT_POLYGONS.central_america,
    CONTINENT_POLYGONS.south_america,
    CONTINENT_POLYGONS.europe,
    CONTINENT_POLYGONS.africa,
    CONTINENT_POLYGONS.asia,
    CONTINENT_POLYGONS.australia,
  ];
  for (const poly of polys) {
    if (pointInPolygon(lat, lon, poly)) return true;
  }

  return false;
}

// ── Depth profile ─────────────────────────────────────────────────────────────
// Deterministic seeded LCG for reproducible depth values (no Math.random()
// so the globe looks the same on every reload).

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223 >>> 0;
    return s / 0xffffffff;
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate `n` geographically distributed (lat, lon, depth) points.
 *
 * Uses a 64×32 lat/lon grid (= 2048 cells) by default.  Points are
 * offset by half a cell so poles/IDL are not sampled exactly.
 *
 * Returns:
 *   { lats, lons, depths }  — each a Float32Array of length n
 *   { isLand }              — Uint8Array of length n (1 = land, 0 = ocean)
 *
 * The caller feeds (lats, lons, depths) into the topo WASM pipeline via
 * `topo_get_input()` and uses `isLand` to override the IS_LAND render buffer.
 */
export function buildGeographicPoints(n = 2048) {
  // Determine grid dimensions (prefer 64×32 = 2048 or nearest rectangle).
  const cols = Math.round(Math.sqrt(n * 2)); // longitude cells
  const rows = Math.round(n / cols);         // latitude cells
  const total = cols * rows;

  const lats   = new Float32Array(total);
  const lons   = new Float32Array(total);
  const depths = new Float32Array(total);
  const isLand = new Uint8Array(total);

  const dLat = 180 / rows;
  const dLon = 360 / cols;

  const rand = seededRand(0xdeadbeef);

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    // Centre of each latitude band, -90° → +90°
    const lat = -90 + dLat * (r + 0.5);

    for (let c = 0; c < cols; c++) {
      // Centre of each longitude band, -180° → +180°
      const lon = -180 + dLon * (c + 0.5);

      const land = isLandPoint(lat, lon);

      // Depth: ocean 0.5–5.5 km below sea level; land 0.05–2.5 km above.
      // Small seeded jitter to break grid regularity on the relief layer.
      const depth = land
        ? -(0.05 + rand() * 2.45)    // negative = above sea level
        :  (0.5  + rand() * 5.0);    // positive = below sea level

      lats[idx]   = lat;
      lons[idx]   = lon;
      depths[idx] = depth;
      isLand[idx] = land ? 1 : 0;
      idx++;
    }
  }

  return { lats, lons, depths, isLand, count: total };
}

// Module-level singleton — computed once at import time so there is zero
// per-frame overhead.  The topo WASM pipeline re-uses the same coordinates
// every tick; only the dot states (alive/dead/capital) change at runtime.
export const EARTH_POINTS = buildGeographicPoints(2048);

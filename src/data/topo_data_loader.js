// ─────────────────────────────────────────────────────────────────────────────
// topo_data_loader.js  —  4K Heightmap → WASM Topo Pipeline
//
// Replaces earth_topo.js (64×32 polygon grid) with a 3840×1920 PNG heightmap
// as the single source of geographic truth.  No CONTINENT_POLYGONS, no
// isLandPoint — every classification decision comes from raw pixel values.
//
// Sea-level convention (specific to this heightmap):
//   #8f8f8f  ≡  143/255  =  sea level
//   value < 143  →  bathymetry   (positive depth_km, shrinks sphere radius)
//   value > 143  →  elevation    (negative depth_km, expands sphere radius)
//
// Zero-copy bridge (WASM topo kernel):
//   topo_alloc(n) → topo_get_input() live view → write [lat,lon,depth] →
//   topo_transform(n, 1.0, 0.15) → topo_get_output() live view
//
// Equirectangular coordinate mapping (pixel centres):
//   lat  =  90 − (row + 0.5) / H × 180   (+90° at top row, −90° at bottom)
//   lon  = −180 + (col + 0.5) / W × 360  (−180° at left col, +180° at right)
//
// Two usage modes:
//   loadTopoData(mod)      — full 3840×1920 pipeline (7.37 M points)
//   useTopoData(mod, opts) — React hook; pass sampleCount for a structured
//                            lat/lon grid sample (e.g. 2048 for EcocideTab)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useRef } from 'react';

// Vite resolves this to a cache-busted asset URL at build time.
import HEIGHTMAP_URL from './3840px-World_elevation_map.png';

// ── Depth constants ───────────────────────────────────────────────────────────

const SEA_LEVEL_VALUE = 143;   // pixel R value for #8f8f8f
const MAX_BATH_KM     = 11.0;  // Mariana Trench ≈ 11 km below sea level
const MAX_ELEV_KM     = 8.8;   // Everest ≈ 8.8 km above sea level

/**
 * Convert a greyscale pixel value (0–255) to depth_km.
 *
 *   depth_km > 0  →  below sea level (ocean);  radius shrinks in topo.rs
 *   depth_km < 0  →  above sea level (land);   radius expands in topo.rs
 *   depth_km = 0  →  exactly sea level
 */
function pixelToDepthKm(value) {
  if (value < SEA_LEVEL_VALUE) {
    // Bathymetry: pixel 0 → MAX_BATH_KM,  pixel 142 → ~0
    return ((SEA_LEVEL_VALUE - value) / SEA_LEVEL_VALUE) * MAX_BATH_KM;
  }
  if (value > SEA_LEVEL_VALUE) {
    // Elevation: pixel 144 → ~0,  pixel 255 → MAX_ELEV_KM (stored negative)
    return -((value - SEA_LEVEL_VALUE) / (255 - SEA_LEVEL_VALUE)) * MAX_ELEV_KM;
  }
  return 0.0;
}

// ── Image ingestion ───────────────────────────────────────────────────────────

/**
 * Fetch the heightmap PNG and extract its raw RGBA pixel data.
 *
 * Uses OffscreenCanvas when available (avoids main-thread layout reflow and
 * works inside Web Workers).  Falls back to HTMLCanvasElement on the main
 * thread when OffscreenCanvas is not supported.
 *
 * @param   {string} url
 * @returns {Promise<{ pixels: Uint8ClampedArray, width: number, height: number }>}
 */
async function loadHeightmapPixels(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`[topo_data_loader] fetch failed: ${response.status} ${url}`);
  }

  const blob   = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  let ctx;
  if (typeof OffscreenCanvas !== 'undefined') {
    const oc = new OffscreenCanvas(width, height);
    ctx = oc.getContext('2d');
  } else {
    const canvas  = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
  }

  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  bitmap.close();

  return { pixels: imageData.data, width, height };
}

// ── WASM zero-copy pipelines ──────────────────────────────────────────────────

/**
 * Full pipeline — processes every pixel in the 3840×1920 image (7,372,800
 * points).  This is the spec-compliant path for high-resolution rendering.
 *
 * @param   {object}           mod    — loaded wasm-bindgen module
 * @param   {Uint8ClampedArray} pixels — raw RGBA data from getImageData
 * @param   {number}           width
 * @param   {number}           height
 * @returns {{ topoXyz: Float32Array, isLand: Uint8Array, count: number }}
 */
function buildFullTopo(mod, pixels, width, height) {
  const count = width * height;

  // Step 1 — allocate input + output WASM buffers for `count` triplets.
  mod.topo_alloc(count);

  // Step 2 — live Float32Array view into WASM linear memory (zero-copy write).
  const inputView = mod.topo_get_input();

  // Step 3 — write [lat, lon, depth] triplets + build IS_LAND mask.
  //           R channel = greyscale value (R = G = B in a greyscale PNG).
  const isLand = new Uint8Array(count);

  for (let row = 0; row < height; row++) {
    const lat = 90 - ((row + 0.5) / height) * 180;

    for (let col = 0; col < width; col++) {
      const value = pixels[(row * width + col) * 4]; // R channel
      const lon   = -180 + ((col + 0.5) / width) * 360;
      const depth = pixelToDepthKm(value);

      const i       = (row * width + col) * 3;
      inputView[i]     = lat;
      inputView[i + 1] = lon;
      inputView[i + 2] = depth;

      isLand[row * width + col] = value > SEA_LEVEL_VALUE ? 1 : 0;
    }
  }

  // Step 4 — WASM spherical→Cartesian transform.
  //   radius = 1.0  (unit sphere)
  //   depth_scale = 0.15  (subtle but readable topographic relief)
  mod.topo_transform(count, 1.0, 0.15);

  // Step 5 — live output view; copy into a detached Float32Array so the
  //           caller owns the buffer independently of the WASM module.
  const topoXyz = new Float32Array(mod.topo_get_output());

  return { topoXyz, isLand, count };
}

/**
 * Sampled pipeline — picks `sampleCount` pixel positions from the heightmap
 * using the same structured lat/lon grid as the old buildGeographicPoints().
 *
 * This keeps the EcocideTab simulation compatible (DOT_COUNT = 2048) while
 * replacing polygon-based land classification with pixel truth.
 *
 * @param   {object}           mod
 * @param   {Uint8ClampedArray} pixels
 * @param   {number}           imgWidth
 * @param   {number}           imgHeight
 * @param   {number}           sampleCount   — target point count (e.g. 2048)
 * @returns {{ topoXyz: Float32Array, isLand: Uint8Array, count: number }}
 */
function buildSampledTopo(mod, pixels, imgWidth, imgHeight, sampleCount) {
  // Mirror buildGeographicPoints() grid layout: cols ≈ 2×rows, nearest rect.
  const cols  = Math.round(Math.sqrt(sampleCount * 2));
  const rows  = Math.round(sampleCount / cols);
  const count = cols * rows;
  const dLat  = 180 / rows;
  const dLon  = 360 / cols;

  mod.topo_alloc(count);
  const inputView = mod.topo_get_input();
  const isLand    = new Uint8Array(count);

  for (let r = 0; r < rows; r++) {
    // Grid latitude: −90° (bottom row) → +90° (top row), cell-centred.
    const lat = -90 + dLat * (r + 0.5);

    // Map lat → pixel row.  Heightmap row 0 = +90°, row H−1 = −90°.
    const pixRow = Math.min(
      Math.max(Math.round(((90 - lat) / 180) * imgHeight), 0),
      imgHeight - 1
    );

    for (let c = 0; c < cols; c++) {
      const lon = -180 + dLon * (c + 0.5);

      // Map lon → pixel col.  Heightmap col 0 = −180°, col W−1 = +180°.
      const pixCol = Math.min(
        Math.max(Math.round(((lon + 180) / 360) * imgWidth), 0),
        imgWidth - 1
      );

      const value = pixels[(pixRow * imgWidth + pixCol) * 4]; // R channel
      const depth = pixelToDepthKm(value);
      const idx   = r * cols + c;
      const i     = idx * 3;

      inputView[i]     = lat;
      inputView[i + 1] = lon;
      inputView[i + 2] = depth;

      isLand[idx] = value > SEA_LEVEL_VALUE ? 1 : 0;
    }
  }

  mod.topo_transform(count, 1.0, 0.15);
  const topoXyz = new Float32Array(mod.topo_get_output());

  return { topoXyz, isLand, count };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Promise-based loader — full 3840×1920 pipeline.
 * Use outside React (plain async init, Web Workers, etc.).
 *
 * @param   {object} wasmMod
 * @param   {string} [url]     — override heightmap URL (default: bundled PNG)
 * @returns {Promise<{ topoXyz: Float32Array, isLand: Uint8Array, count: number }>}
 */
export async function loadTopoData(wasmMod, url = HEIGHTMAP_URL) {
  const { pixels, width, height } = await loadHeightmapPixels(url);
  return buildFullTopo(wasmMod, pixels, width, height);
}

/**
 * React hook — async heightmap → WASM → XYZ positions.
 *
 * Replaces the synchronous `initTopoPositions` in EcocideTab.jsx.
 * Returns a stable object that updates once when loading completes.
 *
 * @param   {object|null} wasmMod      — wasm-bindgen module (null while loading)
 * @param   {object}      [opts]
 * @param   {string}      [opts.url]         — heightmap URL override
 * @param   {number|null} [opts.sampleCount] — null = full 3840×1920;
 *                                             number = structured grid sample
 *                                             (pass 2048 for EcocideTab compat)
 * @returns {{
 *   ready:   boolean,
 *   count:   number,
 *   topoXyz: Float32Array | null,   // count×3 — (x,y,z) unit-sphere coords
 *   isLand:  Uint8Array  | null,    // count   — 1 = land, 0 = ocean
 *   error:   Error | null,
 * }}
 */
export function useTopoData(wasmMod, { url = HEIGHTMAP_URL, sampleCount = null } = {}) {
  const [state, setState] = useState({
    ready:   false,
    count:   0,
    topoXyz: null,
    isLand:  null,
    error:   null,
  });

  // Cancellation flag — discards stale async results if deps change mid-flight.
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!wasmMod) return;
    cancelRef.current = false;

    (async () => {
      try {
        const { pixels, width, height } = await loadHeightmapPixels(url);
        if (cancelRef.current) return;

        const result = sampleCount != null
          ? buildSampledTopo(wasmMod, pixels, width, height, sampleCount)
          : buildFullTopo(wasmMod, pixels, width, height);

        if (cancelRef.current) return;
        setState({ ready: true, ...result, error: null });
      } catch (err) {
        if (!cancelRef.current) {
          console.error('[useTopoData]', err);
          setState(s => ({ ...s, ready: false, error: err }));
        }
      }
    })();

    return () => { cancelRef.current = true; };
  }, [wasmMod, url, sampleCount]);

  return state;
}

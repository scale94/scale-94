// landMask.js — the ocean's coastline, from the same Natural Earth 110m land
// that worldMapPolys draws (world-atlas/land-110m.json), rasterised in lon/lat
// with an even–odd scanline so it runs in jsdom.

import * as topojson from 'topojson-client';
import landTopology from 'world-atlas/land-110m.json';
import { LAT_LIMIT } from './grid';

export function landRings(topology = landTopology) {
  const f = topojson.feature(topology, topology.objects.land);
  const geoms = f.type === 'FeatureCollection' ? f.features.map((x) => x.geometry) : [f.geometry];
  const rings = [];
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) for (const r of p) rings.push(r);
  }
  return rings;
}

export function rasterizeLand(grid, rings = landRings()) {
  const { nx, ny } = grid;
  const land = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const lat = grid.latOf(j);
    if (Math.abs(lat) > LAT_LIMIT) {
      land.fill(1, j * nx, (j + 1) * nx);
      continue;
    }
    const xs = [];
    for (const r of rings) {
      for (let k = 0, m = r.length - 1; k < r.length; m = k++) {
        const [x1, y1] = r[m];
        const [x2, y2] = r[k];
        if ((y1 > lat) !== (y2 > lat)) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    // Even–odd: a cell centre is land when an odd number of crossings lie east of it.
    let p = 0;
    for (let i = 0; i < nx; i++) {
      const lon = grid.lonOf(i);
      while (p < xs.length && xs[p] <= lon) p++;
      if ((xs.length - p) % 2 === 1) land[j * nx + i] = 1;
    }
  }
  return land;
}

export function labelComponents(grid, isMember, diagonal) {
  const { nx, ny, n } = grid;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let count = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || !isMember(s)) continue;
    let top = 0;
    stack[top++] = s;
    label[s] = count;
    while (top > 0) {
      const k = stack[--top];
      const i = k % nx;
      const j = (k - i) / nx;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= ny) continue;
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          if (!diagonal && di !== 0 && dj !== 0) continue;
          const kk = jj * nx + grid.wrapI(i + di);
          if (label[kk] === -1 && isMember(kk)) {
            label[kk] = count;
            stack[top++] = kk;
          }
        }
      }
    }
    count++;
  }
  return { label, count };
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function analyzeLand(grid, land) {
  const { nx, ny, n } = grid;
  // Land is 8-connected so that every land cell sharing a corner belongs to
  // one component — streamFunction relies on this for zero coastal flux.
  const { label: comp, count: compCount } = labelComponents(grid, (k) => land[k] === 1, true);
  const { label: basin, count: basinCount } = labelComponents(grid, (k) => land[k] === 0, false);
  const dist = new Int32Array(n).fill(-1);
  const nearest = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let k = 0; k < n; k++) {
    if (land[k]) {
      dist[k] = 0;
      nearest[k] = comp[k];
      queue[tail++] = k;
    }
  }
  while (head < tail) {
    const k = queue[head++];
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj] of N4) {
      const jj = j + dj;
      if (jj < 0 || jj >= ny) continue;
      const kk = jj * nx + grid.wrapI(i + di);
      if (dist[kk] !== -1) continue;
      dist[kk] = dist[k] + 1;
      nearest[kk] = nearest[k];
      queue[tail++] = kk;
    }
  }
  return { land, comp, compCount, basin, basinCount, dist, nearest };
}

export function buildLandMask(grid) {
  return analyzeLand(grid, rasterizeLand(grid));
}

// Nearest ocean cell (Euclidean, in cells) within maxR; ties resolve to the
// first found scanning south→north, west→east, so results are deterministic.
export function snapToOcean(grid, land, lon, lat, maxR = 64) {
  const { i: ci, j: cj } = grid.lonLatToCell(lon, lat);
  let best = null;
  for (let dj = -maxR; dj <= maxR; dj++) {
    const j = cj + dj;
    if (j < 0 || j >= grid.ny) continue;
    for (let di = -maxR; di <= maxR; di++) {
      const k = grid.idx(ci + di, j);
      if (land[k]) continue;
      const d = Math.hypot(di, dj);
      if (d <= maxR && (!best || d < best.distCells)) best = { i: grid.wrapI(ci + di), j, k, distCells: d };
    }
  }
  if (!best) return null;
  return { ...best, lon: grid.lonOf(best.i), lat: grid.latOf(best.j) };
}

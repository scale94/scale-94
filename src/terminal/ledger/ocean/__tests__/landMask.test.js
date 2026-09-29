import { describe, it, expect } from 'vitest';
import * as topojson from 'topojson-client';
import { geoContains } from 'd3-geo';
import landTopology from 'world-atlas/land-110m.json';
import { OCEAN_GRID, makeGrid, LAT_LIMIT } from '../grid';
import { buildLandMask, labelComponents, analyzeLand, snapToOcean } from '../landMask';

const grid = OCEAN_GRID;
const mask = buildLandMask(grid);
const cellOf = (lon, lat) => {
  const { i, j } = grid.lonLatToCell(lon, lat);
  return grid.idx(i, j);
};
const isLand = (lon, lat) => mask.land[cellOf(lon, lat)] === 1;

// Mouths the spec names (lon, lat). All must reach ocean within 3 cells.
const MOUTHS = {
  mercury: [20.0, 39.87],       // Bistrica → Ionian Sea
  germany: [4.12, 51.98],       // Rhine, Hook of Holland
  usa: [-89.25, 29.15],         // Mississippi, Head of Passes
  brazil: [-39.82, -19.63],     // Rio Doce mouth
  north_korea: [127.65, 39.8],  // Hamhung coast
  yangtze: [121.9, 31.4],
  ganges: [89.18, 21.95],       // Sundarbans
  citarum: [107.0, -5.93],
  danube: [29.75, 45.15],       // Sulina
};

describe('rasterizeLand (real world, 512×256)', () => {
  it('classifies reference points', () => {
    expect(isLand(14.29, 48.31)).toBe(true);    // Linz
    expect(isLand(34, 43.5)).toBe(false);       // Black Sea
    expect(isLand(-150, 0)).toBe(false);        // mid-Pacific
    expect(isLand(3, 55)).toBe(false);          // North Sea
    expect(isLand(134, 40)).toBe(false);        // Sea of Japan
    expect(isLand(110, -5)).toBe(false);        // Java Sea
    expect(isLand(-90, 27)).toBe(false);        // Gulf of Mexico
  });

  it('treats everything poleward of 78° as land', () => {
    for (let j = 0; j < grid.ny; j++) {
      if (Math.abs(grid.latOf(j)) <= LAT_LIMIT) continue;
      for (let i = 0; i < grid.nx; i++) expect(mask.land[grid.idx(i, j)]).toBe(1);
    }
  });

  it('has a plausible land fraction', () => {
    let n = 0;
    for (const v of mask.land) n += v;
    const frac = n / grid.n;
    expect(frac).toBeGreaterThan(0.33);
    expect(frac).toBeLessThan(0.45);
  });
});

// Natural Earth rings that cross ±180° (Fiji, Chukotka inside Afro-Eurasia,
// Wrangel, Antarctica) are continuous on the sphere but jump ~360° in lon/lat.
// A planar scanline must not fill the world between the jump's two ends.
describe('rasterizeLand across the antimeridian', () => {
  it('keeps the open ocean open along 16.5°S (Fiji row)', () => {
    expect(isLand(-150, -16.5)).toBe(false);   // central Pacific
    expect(isLand(75, -16.5)).toBe(false);     // Indian Ocean
    expect(isLand(-10, -16.5)).toBe(false);    // South Atlantic
  });

  it('still rasterises Fiji (Vanua Levu) as land at the date line', () => {
    expect(isLand(179.0, -16.6)).toBe(true);
  });

  it('keeps the Bering Sea ocean and does not invert 65–69°N', () => {
    expect(isLand(-175, 60)).toBe(false);      // Bering Sea
    expect(isLand(100, 66.5)).toBe(true);      // central Siberia
    expect(isLand(-155, 66.5)).toBe(true);     // interior Alaska
    expect(isLand(0, 67)).toBe(false);         // Norwegian Sea
    expect(isLand(-168, 68)).toBe(false);      // Chukchi Sea
    expect(isLand(-174, 66.5)).toBe(true);     // east Chukotka, west of 180°W wrap
  });

  it('keeps the Beaufort Sea ocean on the Wrangel Island row', () => {
    expect(isLand(-140, 71.4)).toBe(false);
  });

  it('keeps Antarctica land', () => {
    expect(isLand(0, -75)).toBe(true);
    expect(isLand(160, -75)).toBe(true);
    expect(isLand(90, -75)).toBe(true);
    expect(isLand(-100, -77)).toBe(true);
  });

  // Genuine peak within ±60° is 315/512 (~0.62) at 53°N (Eurasia + N. America).
  it('has no row within ±60° that is more than 65% land', () => {
    for (let j = 0; j < grid.ny; j++) {
      if (Math.abs(grid.latOf(j)) > 60) continue;
      let c = 0;
      for (let i = 0; i < grid.nx; i++) c += mask.land[grid.idx(i, j)];
      expect(c / grid.nx, `row ${j} (lat ${grid.latOf(j).toFixed(2)})`).toBeLessThan(0.65);
    }
  });

  // Independent spherical oracle: d3-geo's geoContains on the same topology.
  // Planar vs spherical edges differ by at most one cell per row on this data,
  // so a sampled row may disagree at most once.
  it('agrees with d3-geo geoContains on every sampled row below 78°', () => {
    const land = topojson.feature(landTopology, landTopology.objects.land);
    const bad = [];
    for (let j = 0; j < grid.ny; j++) {
      const lat = grid.latOf(j);
      if (Math.abs(lat) > LAT_LIMIT) continue;
      let m = 0;
      for (let i = 3; i < grid.nx; i += 8) {
        if ((geoContains(land, [grid.lonOf(i), lat]) ? 1 : 0) !== mask.land[grid.idx(i, j)]) m++;
      }
      if (m > 1) bad.push({ j, lat: +lat.toFixed(2), mismatches: m });
    }
    expect(bad).toEqual([]);
  }, 60000);
});

describe('snapToOcean (real world)', () => {
  it.each(Object.entries(MOUTHS))('%s mouth snaps within 3 cells', (_key, [lon, lat]) => {
    const s = snapToOcean(grid, mask.land, lon, lat, 8);
    expect(s).not.toBeNull();
    expect(s.distCells).toBeLessThanOrEqual(3);
    expect(mask.land[s.k]).toBe(0);
  });

  const basinAt = (lon, lat) => mask.basin[cellOf(lon, lat)];
  const snapBasin = (key) => {
    const [lon, lat] = MOUTHS[key];
    return mask.basin[snapToOcean(grid, mask.land, lon, lat, 8).k];
  };

  it('drains each river into the right water body', () => {
    expect(snapBasin('danube')).toBe(basinAt(34, 43.5));        // Black Sea
    expect(snapBasin('north_korea')).toBe(basinAt(134, 40));    // Sea of Japan
    expect(snapBasin('brazil')).toBe(basinAt(-30, -20));        // South Atlantic
    expect(snapBasin('usa')).toBe(basinAt(-90, 27));            // Gulf of Mexico
  });

  // The spec says the Bosporus is sub-grid, so Danube dye stays in the Black Sea.
  // If this fails, STOP and report: the spec's claim is wrong, not the test.
  it('keeps the Black Sea closed at this resolution', () => {
    expect(basinAt(34, 43.5)).not.toBe(basinAt(-150, 0));
  });

  it('returns null when no ocean is within reach', () => {
    expect(snapToOcean(grid, mask.land, 14.29, 48.31, 2)).toBeNull();
  });
});

describe('labelComponents and analyzeLand (synthetic)', () => {
  const g = makeGrid(8, 4);

  it('merges diagonal land only with diagonal connectivity', () => {
    const land = new Uint8Array(g.n);
    land[g.idx(1, 1)] = 1;
    land[g.idx(2, 2)] = 1;
    expect(labelComponents(g, (k) => land[k] === 1, true).count).toBe(1);
    expect(labelComponents(g, (k) => land[k] === 1, false).count).toBe(2);
  });

  it('connects components across the date line', () => {
    const land = new Uint8Array(g.n);
    land[g.idx(0, 1)] = 1;
    land[g.idx(7, 1)] = 1;
    expect(labelComponents(g, (k) => land[k] === 1, false).count).toBe(1);
  });

  it('measures coast distance with east–west wrap', () => {
    const land = new Uint8Array(g.n);
    for (let j = 0; j < g.ny; j++) land[g.idx(0, j)] = 1;
    const m = analyzeLand(g, land);
    expect(m.dist[g.idx(0, 1)]).toBe(0);
    expect(m.dist[g.idx(3, 1)]).toBe(3);
    expect(m.dist[g.idx(5, 1)]).toBe(3);
    expect(m.dist[g.idx(7, 1)]).toBe(1);
    expect(m.nearest[g.idx(4, 2)]).toBe(m.comp[g.idx(0, 2)]);
    expect(m.comp[g.idx(3, 1)]).toBe(-1);
    expect(m.basin[g.idx(0, 1)]).toBe(-1);
  });
});

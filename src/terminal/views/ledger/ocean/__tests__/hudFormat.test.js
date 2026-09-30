import { describe, it, expect } from 'vitest';
import { getOceanWorld } from '../../../../ledger/ocean/oceanWorld';
import { verdictSources, haversineKm, ghostSourceSpec, buildSource } from '../../../../ledger/ocean/sources';
import { RIVERS } from '../../../../ledger/ocean/riverCourses';
import { cumulativeKm, courseTick } from '../../../../ledger/ocean/riverStage';
import {
  COMPRESSIONS, GHOST_COLOR, GHOST_LABEL, LEGEND_NOTES, PRESET_COLOR, nextCompression, summaryLine, formatClock, formatFrame,
  fmtValue, formatProbe, pointerToLonLat, lonLatToPct, describeSites, tooltipLines, fmtQ,
  PROBE_NOISE_FLOOR, RING_TAP_RADIUS_PX, pickSite, keyStep,
} from '../hudFormat';

// Inland near Suzhou: a land cell, so the straight-line snap has a length.
const V = {
  hash: 'h1', status: 'REJECTED', coordinates: { lat: 31.3, lon: 120.6 },
  input: { temp: 20, do: 6, bod: 10, dt: 2, epi: 3, nitrate: 5, flow: 42, siteName: 'Test site' },
};

describe('clock, compression, frame monitor', () => {
  it('cycles 1 → 3 → 9 → 30 → 1', () => {
    expect(COMPRESSIONS).toEqual([1, 3, 9, 30]);
    expect([1, 3, 9, 30].map(nextCompression)).toEqual([3, 9, 30, 1]);
  });
  it('formats the sim clock and the frame monitor', () => {
    expect(formatClock(184.25)).toBe('T+ 184.25 d');
    expect(formatClock(0)).toBe('T+ 0.00 d');
    expect(formatFrame(2.8)).toBe('Δt 2.8 ms · 357 Hz');
    expect(formatFrame(16)).toBe('Δt 16.0 ms · 63 Hz');
    expect(formatFrame(0)).toBe('Δt — ms');
  });
});

describe('summary line', () => {
  it('counts verdicts by status like the old map did', () => {
    expect(summaryLine([])).toBe('0 VERDICTS RECORDED');
    expect(summaryLine([{ status: 'APPROVED' }])).toBe('1 VERDICT RECORDED  ·  1 APPROVED');
    expect(summaryLine([{ status: 'APPROVED' }, { status: 'APPROVED' }, { status: 'EMERGENCY_VETO' }, {}]))
      .toBe('4 VERDICTS RECORDED  ·  2 APPROVED  ·  1 EMERGENCY VETO  ·  1 UNKNOWN');
  });
});

describe('probe', () => {
  it('formats values with magnitude-dependent precision', () => {
    expect(fmtValue(0)).toBe('0');
    expect(fmtValue(-1)).toBe('0');
    expect(fmtValue(NaN)).toBe('0');
    expect(fmtValue(3.2e-4)).toBe('3.2e-4');
    expect(fmtValue(0.02)).toBe('0.02');
    expect(fmtValue(0.005)).toBe('5.0e-3');   // below 0.01 the readout switches to exponent form
    expect(fmtValue(0.01)).toBe('0.01');
    expect(fmtValue(1.234)).toBe('1.2');
    expect(fmtValue(150.4)).toBe('150');
  });
  it('formats a probe line, land and no-data cases', () => {
    expect(formatProbe(122.8, 31.2, [0.02, 0.14, 0.8, 0.3], false))
      .toBe('31.2°N 122.8°E · ΔT 0.02 °C · BOD 0.14 · NO₃ 0.80 · DO↓ 0.30 mg/L');
    expect(formatProbe(-89.2, 29.1, null, true)).toBe('29.1°N 89.2°W · LAND');
    expect(formatProbe(10, -45.5, null, false)).toBe('45.5°S 10.0°E · NO DATA');
  });
  it('maps canvas pixels to lon/lat (north up, full equirectangular world)', () => {
    expect(pointerToLonLat(0, 0, 512, 256)).toEqual({ lon: -180, lat: 90 });
    expect(pointerToLonLat(256, 128, 512, 256)).toEqual({ lon: 0, lat: 0 });
    expect(pointerToLonLat(384, 192, 512, 256)).toEqual({ lon: 90, lat: -45 });
    expect(pointerToLonLat(512, 10, 512, 256)).toBeNull();
    expect(pointerToLonLat(-1, 10, 512, 256)).toBeNull();
    expect(pointerToLonLat(10, 256, 512, 256)).toBeNull();
    expect(pointerToLonLat(10, 10, 0, 0)).toBeNull();
  });
  it('maps lon/lat to percent positions', () => {
    expect(lonLatToPct(0, 0)).toEqual({ left: 50, top: 50 });
    expect(lonLatToPct(-180, 90)).toEqual({ left: 0, top: 0 });
    expect(lonLatToPct(90, -45)).toEqual({ left: 75, top: 75 });
  });
});

describe('legend', () => {
  it('carries every honesty note', () => {
    expect(LEGEND_NOTES).toEqual([
      'MODEL KINETICS · LITERATURE RANGES',
      'PRESET LOADS NARRATIVE-TUNED · NOT MEASURED',
      'CLIMATOLOGICAL CURRENTS · NOT FORECAST',
      'POINT SOURCE · PLUG FLOW · NO TRIBUTARIES',
      'USER SITES · STRAIGHT-LINE APPROX',
      'DO_SAT FRESHWATER FIT · ~20% HIGH AT SEA',
      'RIVER PARCELS ≥ 6 S PER COURSE · SLOWED · COLOUR EXACT',
    ]);
  });
});

describe('sites', () => {
  const world = getOceanWorld();
  const userSrc = verdictSources([V], world.grid, world.mask);
  const sites = describeSites([...world.sources, ...userSrc], [V]);

  it('test setup: the verdict site is on land', () => {
    const { i, j } = world.grid.lonLatToCell(120.6, 31.3);
    expect(world.mask.land[world.grid.idx(i, j)]).toBeTruthy();
  });

  it('places each DO_MIN tick at the critical point along the drawn course', () => {
    for (const s of [...world.sources, ...userSrc]) {
      const d = sites.find((x) => x.id === s.id);
      expect(d.course).toBe(s.course);
      expect(d.tick).toEqual(courseTick(s.course, cumulativeKm(s.course), s.critical.courseKm));
      expect(d.tick).not.toBeNull();
    }
  });

  it('measures each course on screen (site → mouth, css px at the hero size); null without a hero size', () => {
    const all = [...world.sources, ...userSrc];
    const sized = describeSites(all, [V], null, { width: 1024, height: 512 });
    for (const s of all) {
      let px = 0;
      for (let p = 1; p < s.course.length; p++) {
        px += Math.hypot(
          ((s.course[p][0] - s.course[p - 1][0]) / 360) * 1024,
          ((s.course[p][1] - s.course[p - 1][1]) / 180) * 512,
        );
      }
      expect(sized.find((x) => x.id === s.id).courseCssPx).toBeCloseTo(px, 9);
    }
    // Yangtze: 0.4681° of longitude → 1.33 px at 1024 wide; Danube is far longer than a ring.
    expect(sized.find((x) => x.id === 'preset:yangtze').courseCssPx).toBeCloseTo((0.4681 / 360) * 1024, 2);
    expect(sized.find((x) => x.id === 'preset:danube').courseCssPx).toBeGreaterThan(50);
    // Scales with the hero.
    const half = describeSites(all, [V], null, { width: 512, height: 256 });
    expect(half.find((x) => x.id === 'preset:danube').courseCssPx)
      .toBeCloseTo(sized.find((x) => x.id === 'preset:danube').courseCssPx / 2, 9);
    for (const d of sites) expect(d.courseCssPx).toBeNull();
  });

  it('prints a dash, not NaN, when the DO minimum is unknown', () => {
    const lines = tooltipLines({
      id: 'x', kind: 'verdict', name: 'Z', status: 'APPROVED', color: '#22c55e',
      site: [0, 0], snap: [0, 0], snapKm: 1, dischargeM3s: 1, doMin: NaN, rkm: NaN,
    });
    expect(lines[3]).toBe('DO_MIN — mg/L @ rkm —');
  });

  it('describes presets as neutral ambient sources, measured from their mouth', () => {
    const usa = sites.find((s) => s.id === 'preset:usa');
    expect(usa).toMatchObject({
      kind: 'preset', status: null, color: PRESET_COLOR,
      name: 'Lower Mississippi at New Orleans, USA', dischargeM3s: 16570,
    });
    expect(usa.site).toEqual(RIVERS.usa.course[0]);
    expect(usa.snapKm).toBeCloseTo(haversineKm(RIVERS.usa.course.at(-1), usa.snap), 9);
    expect(sites.filter((s) => s.kind === 'preset')).toHaveLength(world.sources.length);
  });

  it('describes a verdict by its status colour, measured from its audit site', () => {
    const v = sites.find((s) => s.id === 'h1');
    expect(v).toMatchObject({ kind: 'verdict', status: 'REJECTED', color: '#ef4444', name: 'Test site', dischargeM3s: 42 });
    expect(v.site).toEqual([120.6, 31.3]);
    expect(v.snapKm).toBeGreaterThan(0);
    expect(v.snapKm).toBeCloseTo(haversineKm([120.6, 31.3], v.snap), 9);
  });

  it('writes the tooltip lines', () => {
    expect(tooltipLines({
      id: 'h1', kind: 'verdict', name: 'Test site', status: 'EMERGENCY_VETO', color: '#ef4444',
      site: [121, 31.2], snap: [122, 31], snapKm: 97.4, dischargeM3s: 42, doMin: 3.14, rkm: 1840.4,
    })).toEqual([
      'Test site', 'EMERGENCY VETO', 'Q 42 m³/s · 0.25% OF MISSISSIPPI',
      'DO_MIN 3.1 mg/L @ rkm 1840', 'SNAP 97 km TO OCEAN',
    ]);
    expect(tooltipLines({
      id: 'preset:usa', kind: 'preset', name: 'X', status: null, color: PRESET_COLOR,
      site: [0, 0], snap: [0, 0], snapKm: 0, dischargeM3s: 16570, doMin: 5, rkm: 0,
    })).toEqual(['X', 'AMBIENT PRESET', 'Q 16,570 m³/s', 'DO_MIN 5.0 mg/L @ rkm 0', 'SNAP 0 km TO OCEAN']);
    expect(tooltipLines({
      id: 'x', kind: 'verdict', name: 'Y', status: 'APPROVED', color: '#22c55e',
      site: [0, 0], snap: [0, 0], snapKm: 1, dischargeM3s: 4.25, doMin: 8, rkm: 2,
    })[2]).toBe('Q 4.3 m³/s · 0.026% OF MISSISSIPPI');
  });

  it('formats Q at the range ends (0, very small, and with locale)', () => {
    expect(fmtQ(0)).toBe('0');
    expect(fmtQ(0.04)).toBe('0.040');
    expect(fmtQ(3.2)).toBe('3.2');
    expect(fmtQ(9.5)).toBe('9.5');
    expect(fmtQ(10)).toBe('10');
    expect(fmtQ(16570)).toBe('16,570');
  });

  it('never prints a nonzero source as zero or in exponent form', () => {
    expect(fmtQ(0.0001)).toBe('< 0.001');
    expect(fmtQ(1e-5)).toBe('< 0.001');
    expect(fmtQ(0.001)).toBe('0.001');
    expect(fmtQ(0)).toBe('0');
    const site = (q) => ({
      id: 'x', kind: 'verdict', name: 'Y', status: 'APPROVED', color: '#22c55e',
      site: [0, 0], snap: [0, 0], snapKm: 1, dischargeM3s: q, doMin: 8, rkm: 2,
    });
    for (const q of [0.0001, 1e-5]) {
      const line = tooltipLines(site(q))[2];
      expect(line).toBe('Q < 0.001 m³/s · < 0.01% OF MISSISSIPPI');
      expect(line).not.toMatch(/e-/);
      expect(line).not.toContain('0.000');
    }
    // pct boundary: exactly 0.01% keeps normal formatting
    const atBoundary = tooltipLines(site(RIVERS.usa.dischargeM3s * 0.0001))[2];
    expect(atBoundary).toMatch(/· 0\.010% OF MISSISSIPPI$/);
  });

  it('formats Mississippi percentage at 100% and above with no exponent', () => {
    // 100% of Mississippi
    expect(tooltipLines({
      id: 'usa100', kind: 'verdict', name: 'Test 100%', status: 'APPROVED', color: '#22c55e',
      site: [0, 0], snap: [0, 0], snapKm: 0, dischargeM3s: 16570, doMin: 8, rkm: 0,
    })[2]).toBe('Q 16,570 m³/s · 100% OF MISSISSIPPI');
    // ~121% of Mississippi (no e+2 exponent)
    expect(tooltipLines({
      id: 'usa121', kind: 'verdict', name: 'Test 121%', status: 'APPROVED', color: '#22c55e',
      site: [0, 0], snap: [0, 0], snapKm: 0, dischargeM3s: 20000, doMin: 8, rkm: 0,
    })[2]).toBe('Q 20,000 m³/s · 121% OF MISSISSIPPI');
  });

  it('describes the ghost as a provisional user site', () => {
    const G = { ...V.input, lat: 30.59, lon: 114.3, siteName: 'Ghost site' };
    const g = buildSource(ghostSourceSpec(G), world.grid, world.mask);
    const [d] = describeSites([g], [], G);
    expect(d).toMatchObject({ id: 'ghost', kind: 'ghost', name: 'Ghost site', status: null, color: GHOST_COLOR, dischargeM3s: 42 });
    expect(d.snapKm).toBeCloseTo(haversineKm([114.3, 30.59], d.snap), 9);
    expect(describeSites([g], [], { ...G, siteName: '' })[0].name).toBe('PROVISIONAL SITE');
    const lines = tooltipLines(d);
    expect(lines[1]).toBe(GHOST_LABEL);
    expect(lines[2]).toBe('Q 42 m³/s · 0.25% OF MISSISSIPPI');
  });
});

describe('probe noise floor and ring picking', () => {
  it('floors float noise below 1e-6 to 0 per channel, and leaves 1e-6 and up alone', () => {
    expect(PROBE_NOISE_FLOOR).toBe(1e-6);
    expect(fmtValue(9.9e-7)).toBe('0');
    expect(fmtValue(5.3e-26)).toBe('0');
    expect(fmtValue(1e-6)).toBe('1.0e-6');
    expect(fmtValue(1.8e-5)).toBe('1.8e-5');
    expect(formatProbe(-70, 27, [5.3e-26, 2.1e-22, 7.4e-14, 3.3e-20], false))
      .toBe('27.0°N 70.0°W · ΔT 0 °C · BOD 0 · NO₃ 0 · DO↓ 0 mg/L');
    expect(formatProbe(-70, 27, [2e-6, 9e-7, 1e-6, 5e-7], false))
      .toBe('27.0°N 70.0°W · ΔT 2.0e-6 °C · BOD 0 · NO₃ 1.0e-6 · DO↓ 0 mg/L');
  });

  it('picks the nearest ring within 6 css px of a tap, else none', () => {
    expect(RING_TAP_RADIUS_PX).toBe(6);
    // 360×180 canvas: 1 px per degree. a at (180, 90), b at (190, 90).
    const sites = [{ id: 'a', site: [0, 0] }, { id: 'b', site: [10, 0] }];
    expect(pickSite(sites, 180, 90, 360, 180)).toBe('a');
    expect(pickSite(sites, 180, 96, 360, 180)).toBe('a');   // exactly 6 px: inside
    expect(pickSite(sites, 180, 96.5, 360, 180)).toBeNull(); // 6.5 px: outside
    expect(pickSite(sites, 180, 98, 360, 180)).toBeNull();   // 8 px
    expect(pickSite(sites, 185.5, 90, 360, 180)).toBe('b');  // 5.5 from a, 4.5 from b: nearest wins
    expect(pickSite(sites, 184.5, 90, 360, 180)).toBe('a');
    expect(pickSite([], 180, 90, 360, 180)).toBeNull();
  });
});

describe('keyStep', () => {
  it('roves with arrows (wrapping), Home and End; other keys do nothing', () => {
    expect(keyStep('ArrowRight', 0, 3)).toBe(1);
    expect(keyStep('ArrowDown', 2, 3)).toBe(0);
    expect(keyStep('ArrowLeft', 0, 3)).toBe(2);
    expect(keyStep('ArrowUp', 1, 3)).toBe(0);
    expect(keyStep('Home', 2, 3)).toBe(0);
    expect(keyStep('End', 0, 3)).toBe(2);
    expect(keyStep('Enter', 0, 3)).toBeNull();
    expect(keyStep('ArrowRight', 0, 0)).toBeNull();
  });
});

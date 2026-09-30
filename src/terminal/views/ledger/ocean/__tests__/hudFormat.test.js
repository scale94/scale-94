import { describe, it, expect } from 'vitest';
import { getOceanWorld } from '../../../../ledger/ocean/oceanWorld';
import { verdictSources, haversineKm, ghostSourceSpec, buildSource } from '../../../../ledger/ocean/sources';
import { RIVERS } from '../../../../ledger/ocean/riverCourses';
import { cumulativeKm, courseTick } from '../../../../ledger/ocean/riverStage';
import {
  COMPRESSIONS, GHOST_COLOR, GHOST_LABEL, LEGEND_NOTES, PRESET_COLOR, nextCompression, summaryLine, formatClock, formatFrame,
  fmtValue, formatProbe, pointerToLonLat, lonLatToPct, describeSites, tooltipLines, fmtQ,
  PROBE_NOISE_FLOOR, RING_TAP_RADIUS_PX, pickSite, keyStep, ghostLabelPlacement, hudTextWidthPx, HUD_FONT_PX,
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
    expect(sites.filter((s) => s.kind === 'preset')).toHaveLength(
      world.sources.filter((s) => s.kind === 'preset').length,
    );
    // nine presets; the world also carries thirteen catalog sources (22 total)
    expect(world.sources.filter((s) => s.kind === 'preset')).toHaveLength(9);
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

describe('ghost label placement', () => {
  // Desktop HUD: 9 px monospace, 0.12 em letter spacing → 0.72 em per char;
  // 16 px ring box; the label sits 3 px beyond the ring box on either side.
  const DESK = { ringPx: 16, fontPx: 9, heroWidth: 1024 };
  const W = 11 * 9 * 0.72;    // 'PROVISIONAL' = 71.28 px
  const H = 9 * 1.5;          // one HUD line
  const clears = (box, others, r) => others.every(([ox, oy]) =>
    ox < box.left - r || ox > box.right + r || oy < box.top - r || oy > box.bottom + r);

  it('measures HUD text from its length and the monospace advance (DOM width is 0 in jsdom)', () => {
    expect(HUD_FONT_PX).toEqual({ compact: 8, desktop: 9 });
    expect(hudTextWidthPx('PROVISIONAL', 9)).toBeCloseTo(W, 9);
    expect(hudTextWidthPx('PROVISIONAL', 8)).toBeCloseTo(11 * 8 * 0.72, 9);
  });

  it('keeps the default placement (right of the ring, centred on it) in open water', () => {
    const p = ghostLabelPlacement({ ...DESK, x: 400, y: 200, others: [[100, 100], [700, 300]] });
    expect(p).toMatchObject({ side: 'right', gap: 11, dy: 0 });
    expect(p.box.left).toBeCloseTo(411, 9);
    expect(p.box.right).toBeCloseTo(411 + W, 9);
    expect(p.box.top).toBeCloseTo(200 - H / 2, 9);
  });

  it('flips to the left of the ring when the label would end beyond heroWidth − 16', () => {
    // Right end at x + 11 + 71.28: x = 926 ends at 1008.28 > 1008 → flips; x = 925 does not.
    expect(ghostLabelPlacement({ ...DESK, x: 925, y: 200 }).side).toBe('right');
    const p = ghostLabelPlacement({ ...DESK, x: 926, y: 200 });
    expect(p.side).toBe('left');
    expect(p.box.right).toBeCloseTo(926 - 11, 9);  // same gap as the normal side
    expect(p.box.left).toBeCloseTo(926 - 11 - W, 9);
    // The phone (390 px hero, 8 px font, 10 px rings): Wuhan's ghost flips.
    const phone = ghostLabelPlacement({ ringPx: 10, fontPx: 8, heroWidth: 390, x: (294.3 / 360) * 390, y: 64 });
    expect(phone.side).toBe('left');
    expect(phone.gap).toBe(8);
    expect(phone.box.right).toBeLessThanOrEqual(390 - 16);
  });

  it('nudges up one ring diameter when the label box covers another ring, and the result clears it', () => {
    const others = [[440, 200]];                  // a ring on the label's line
    const p = ghostLabelPlacement({ ...DESK, x: 400, y: 200, others });
    expect(p.dy).toBe(-16);
    expect(p.box.top).toBeCloseTo(184 - H / 2, 9);
    expect(clears(p.box, others, 8)).toBe(true);
    expect(clears(ghostLabelPlacement({ ...DESK, x: 400, y: 200 }).box, others, 8)).toBe(false);
  });

  it('clamps a left-flipped label to the 16 px gutter on a very narrow hero', () => {
    // 100 px hero, 8 px font, 10 px rings: right side would end at 50 + 8 + 63.36 > 84 → left;
    // flipped it would start at 50 − 8 − 63.36 = −21.36 → clamped to 16.
    const w = hudTextWidthPx('PROVISIONAL', 8);
    const p = ghostLabelPlacement({ ringPx: 10, fontPx: 8, heroWidth: 100, heroHeight: 50, x: 50, y: 25 });
    expect(p.side).toBe('left');
    expect(p.box.left).toBeCloseTo(16, 9);
    expect(p.box.right).toBeCloseTo(16 + w, 9);
    expect(p.dx).toBeCloseTo(16 - (50 - 8 - w), 9);
    // A flip with room to spare is not shifted.
    expect(ghostLabelPlacement({ ...DESK, x: 926, y: 200 }).dx).toBe(0);
    expect(ghostLabelPlacement({ ...DESK, x: 400, y: 200 }).dx).toBe(0);
  });

  it('keeps a polar ghost label inside the hero: nudges down, not off the top', () => {
    const inside = (b, hh) => b.top >= 0 && b.bottom <= hh;
    // Ghost 10 px below the top edge, another ring on the label's line: up (−16) would
    // start at 10 − 16 − 6.75 < 0, so down is tried first and clears.
    const others = [[440, 10]];
    const p = ghostLabelPlacement({ ...DESK, heroHeight: 512, x: 400, y: 10, others });
    expect(p.dy).toBe(16);
    expect(inside(p.box, 512)).toBe(true);
    expect(clears(p.box, others, 8)).toBe(true);
    // The same at the bottom edge: up is kept.
    const q = ghostLabelPlacement({ ...DESK, heroHeight: 512, x: 400, y: 502, others: [[440, 502]] });
    expect(q.dy).toBe(-16);
    expect(inside(q.box, 512)).toBe(true);
    // No nudge room either way (rings above and below): the box is clamped inside.
    const boxed = ghostLabelPlacement({ ...DESK, heroHeight: 512, x: 400, y: 10, others: [[440, 10], [440, 26]] });
    expect(inside(boxed.box, 512)).toBe(true);
    // Open water within half a line of either edge: clamped, not clipped.
    const top = ghostLabelPlacement({ ...DESK, heroHeight: 512, x: 400, y: 3 });
    expect(top.box.top).toBeCloseTo(0, 9);
    expect(top.dy).toBeCloseTo(H / 2 - 3, 9);
    const bottom = ghostLabelPlacement({ ...DESK, heroHeight: 512, x: 400, y: 510 });
    expect(bottom.box.bottom).toBeCloseTo(512, 9);
  });

  it('nudges down when up does not clear (desktop Wuhan ghost beside the Yangtze ring)', () => {
    const x = (294.3 / 360) * 1024;
    const y = ((90 - 30.59) / 180) * 512;
    const yangtze = [((121.515 + 180) / 360) * 1024, ((90 - 31.3925) / 180) * 512];
    const p = ghostLabelPlacement({ ...DESK, x, y, others: [yangtze] });
    expect(p.side).toBe('right');
    expect(p.dy).toBe(16);
    expect(clears(p.box, [yangtze], 8)).toBe(true);
  });

  it('keeps the up nudge when neither up nor down clears', () => {
    const others = [[440, 184], [440, 200], [440, 216]];
    expect(ghostLabelPlacement({ ...DESK, x: 400, y: 200, others }).dy).toBe(-16);
  });

  it('checks the flipped box, not the default one, for rings', () => {
    // x = 930 flips; the left box spans 847.72…919 (±8 for the ring radius).
    const p = ghostLabelPlacement({ ...DESK, x: 930, y: 200, others: [[850, 200]] });
    expect(p).toMatchObject({ side: 'left', dy: -16 });  // a ring under the left box: nudged
    // A ring under the default (right) box only (941…1012): the flipped box is clear.
    const q = ghostLabelPlacement({ ...DESK, x: 930, y: 200, others: [[970, 200]] });
    expect(q).toMatchObject({ side: 'left', dy: 0 });
  });
});

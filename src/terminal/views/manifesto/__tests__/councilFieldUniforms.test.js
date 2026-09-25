import { describe, it, expect } from 'vitest';
import {
  readFieldUniforms, hexToLinear, UI_MODE, ANIM_PHASE, AMBIENT_INTENSITY,
} from '../councilFieldUniforms';
import { polarToXY } from '../councilRingMath';

const SEATED = [
  { dimIndex: 3, angle: 270, hue: '#FF0088' }, // seat 0: west, (100, 320)
  { dimIndex: 9, angle: 90, hue: '#00FFAA' },  // seat 1: east, (540, 320)
  { dimIndex: 4, angle: 250, hue: '#FFD700' }, // seat 2
];
const WEST_X = 270 / 980; // (100 + 170) / 980
const EAST_X = 710 / 980; // (540 + 170) / 980
const sim = (over = {}) => ({ phase: 'IDLE', t0: 1000, pair: null, product: null, isUser: false, ...over });
const ui = (over = {}) => ({ mode: 'AMBIENT', armedDim: null, pair: null, record: null, ...over });
const RAINBOW = ['#FF0088', '#FF3300', '#FF8C00', '#FFD700', '#AAFF00', '#00FFAA', '#00AAFF', '#0044FF', '#7700FF'];

describe('readFieldUniforms — seat resolution (spec §6 + plan amendment 5)', () => {
  it('AMBIENT with no pair: filament off, disk only', () => {
    const u = readFieldUniforms(sim(), ui(), SEATED, null, 5000);
    expect(u.uiMode).toBe(UI_MODE.AMBIENT);
    expect(u.animPhase).toBe(ANIM_PHASE.IDLE);
    expect(u.intensity).toBe(0);
  });

  it('AMBIENT in flight: sim pair (seat indexes) at ambient intensity', () => {
    const u = readFieldUniforms(sim({ phase: 'INFALL', pair: [0, 1] }), ui(), SEATED, null, 2300);
    expect(u.seatA[0]).toBeCloseTo(WEST_X, 12);
    expect(u.seatA[1]).toBeCloseTo(0.5, 12);
    expect(u.seatB[0]).toBeCloseTo(EAST_X, 12);
    expect(u.intensity).toBe(AMBIENT_INTENSITY);
    expect(u.animPhase).toBe(ANIM_PHASE.INFALL);
    expect(u.phaseT).toBeCloseTo(0.5, 12);
    expect(u.phaseMs).toBe(1300);
  });

  it('AMBIENT cooldown keeps intensity so the disk boost relaxes instead of snapping', () => {
    const u = readFieldUniforms(sim({ phase: 'COOLDOWN', pair: [0, 1] }), ui(), SEATED, null, 2600);
    expect(u.animPhase).toBe(ANIM_PHASE.COOLDOWN);
    expect(u.intensity).toBe(AMBIENT_INTENSITY);
  });

  it('AMBIENT idle between cycles: filament off even with a stale pair', () => {
    const u = readFieldUniforms(sim({ phase: 'IDLE', pair: [0, 1] }), ui(), SEATED, null, 9000);
    expect(u.intensity).toBe(0);
  });

  it('ARMED with a live pointer: tether from the armed seat to the pointer, anim forced idle', () => {
    const u = readFieldUniforms(
      sim({ phase: 'INFALL', pair: [0, 1] }), ui({ mode: 'ARMED', armedDim: 4 }),
      SEATED, { x: 320, y: 0 }, 2000,
    );
    expect(u.uiMode).toBe(UI_MODE.ARMED);
    expect(u.animPhase).toBe(ANIM_PHASE.IDLE);
    expect(u.seatB).toEqual([0.5, 1]);
    expect(u.pointerLive).toBe(1);
    expect(u.colorB).toEqual(u.colorA);
    expect(u.intensity).toBe(1);
  });

  it('ARMED with no fine pointer: the filament collapses onto seat A', () => {
    const u = readFieldUniforms(sim(), ui({ mode: 'ARMED', armedDim: 3 }), SEATED, null, 2000);
    expect(u.seatB).toEqual(u.seatA);
    expect(u.pointerLive).toBe(0);
  });

  it('FIRING while the sim finishes an ambient cycle: static bridge from ui.pair', () => {
    const u = readFieldUniforms(
      sim({ phase: 'INFALL', pair: [2, 1], isUser: false }), ui({ mode: 'FIRING', pair: [3, 9] }),
      SEATED, null, 2000,
    );
    expect(u.seatA[0]).toBeCloseTo(WEST_X, 12); // dim 3 → seat 0, not sim seat 2
    expect(u.animPhase).toBe(ANIM_PHASE.IDLE);
    expect(u.intensity).toBe(1);
  });

  it('FIRING again after SYNTHESIZED: a stale user sim pair never bridges the previous minds', () => {
    // The collider never clears isUser; until the loop starts the new cycle
    // the sim still holds the previous user pair at IDLE.
    const u = readFieldUniforms(
      sim({ phase: 'IDLE', pair: [0, 1], isUser: true }), ui({ mode: 'FIRING', pair: [4, 9] }),
      SEATED, null, 2000,
    );
    const seat2X = (polarToXY(250, 220, 320, 320).x + 170) / 980; // dim 4 → SEATED[2]
    expect(u.seatA[0]).toBeCloseTo(seat2X, 12);
    expect(u.seatB[0]).toBeCloseTo(EAST_X, 12);
    expect(u.animPhase).toBe(ANIM_PHASE.IDLE);
    expect(u.intensity).toBe(1);
  });

  it('SYNTHESIZED cooldown of a stale user pair does not drive the field', () => {
    const u = readFieldUniforms(
      sim({ phase: 'COOLDOWN', pair: [0, 1], isUser: true }), ui({ mode: 'SYNTHESIZED', pair: [4, 9] }),
      SEATED, null, 2000,
    );
    expect(u.intensity).toBe(0);
    expect(u.animPhase).toBe(ANIM_PHASE.IDLE);
  });

  it('FIRING user flight: the sim pair and product drive the dynamics', () => {
    const product = { angle: 90, targetR: 318, boundaryR: 290, color: '#00FFAA' };
    const u = readFieldUniforms(
      sim({ phase: 'FLASH', pair: [0, 1], isUser: true, product }), ui({ mode: 'FIRING', pair: [3, 9] }),
      SEATED, null, 1190,
    );
    expect(u.animPhase).toBe(ANIM_PHASE.FLASH);
    expect(u.phaseT).toBeCloseTo(0.5, 12);
    expect(u.eject).toEqual([0, 318, 1]);
    expect(u.ejectColor).toEqual(hexToLinear('#00FFAA'));
    expect(u.intensity).toBe(1);
  });

  it('SYNTHESIZED at rest draws no bridge; its cooldown still relaxes the boost', () => {
    const rest = readFieldUniforms(sim({ phase: 'IDLE', pair: [0, 1], isUser: true }), ui({ mode: 'SYNTHESIZED', pair: [3, 9] }), SEATED, null, 9000);
    expect(rest.intensity).toBe(0);
    const cool = readFieldUniforms(sim({ phase: 'COOLDOWN', pair: [0, 1], isUser: true }), ui({ mode: 'SYNTHESIZED', pair: [3, 9] }), SEATED, null, 2000);
    expect(cool.animPhase).toBe(ANIM_PHASE.COOLDOWN);
    expect(cool.intensity).toBe(1);
  });

  it('clamps phase_t to [0, 1] and leaves phase_ms raw', () => {
    const early = readFieldUniforms(sim({ phase: 'INFALL', pair: [0, 1] }), ui(), SEATED, null, 900);
    expect(early.phaseT).toBe(0);
    expect(early.phaseMs).toBe(-100);
    const late = readFieldUniforms(sim({ phase: 'INFALL', pair: [0, 1] }), ui(), SEATED, null, 9000);
    expect(late.phaseT).toBe(1);
    expect(late.phaseMs).toBe(8000);
  });

  it('marks a foundation ejection with sign −1', () => {
    const product = { angle: 270, targetR: 150, boundaryR: 150, color: '#FF0088' };
    const u = readFieldUniforms(sim({ phase: 'EJECT', pair: [0, 1], product }), ui(), SEATED, null, 1500);
    expect(u.eject[2]).toBe(-1);
    expect(u.eject[0]).toBeCloseTo(Math.PI, 12);
  });

  it('computes the flow layers from the same clock', () => {
    const u = readFieldUniforms(sim(), ui(), SEATED, null, 7000);
    expect(u.time).toBe(7);
    expect(u.flow[0]).toBeCloseTo(7, 9);
    expect(u.flowW).toBeCloseTo(1, 9);
  });
});

describe('hexToLinear', () => {
  it('decodes sRGB to linear light', () => {
    const [r, g, b] = hexToLinear('#FFD700');
    expect(r).toBe(1);
    expect(g).toBeCloseTo(0.6795, 3);
    expect(b).toBe(0);
  });

  it('keeps every rainbow hue in [0, 1] with a saturated channel', () => {
    for (const hex of RAINBOW) {
      const c = hexToLinear(hex);
      for (const v of c) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      expect(Math.max(...c)).toBe(1);
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  ELEMENTS, FADE_OUT_MS, NEUTRAL_MS, SPIN_UP_MS,
  createMachine, request, advance, holdLiquid, activeElement, isSteady, targetElement,
} from '../transitionMachine';

const nonZero = (m) => ELEMENTS.filter((e) => m.fade[e] > 0);
const steadyOn = (m, e) => {
  expect(m.beat).toBe('idle');
  expect(m.state).toBe(e);
  for (const x of ELEMENTS) expect(m.fade[x]).toBe(x === e ? 1 : 0);
};
const steadyNeutral = (m) => {
  expect(m.beat).toBe('idle');
  expect(m.state).toBe('neutral');
  for (const x of ELEMENTS) expect(m.fade[x]).toBe(0);
};
// steps dt until `ms` has passed, checking invariants at every step
function run(m, ms, dt = 1) {
  for (let t = 0; t < ms - 1e-9; t += dt) {
    advance(m, Math.min(dt, ms - t));
    expect(nonZero(m).length).toBeLessThanOrEqual(2);
    if (m.state === 'neutral' || m.beat === 'neutral') expect(nonZero(m)).toEqual([]);
    if (m.beat === 'idle' && m.state !== 'neutral') steadyOn(m, m.state);
  }
}
const on = (e) => { const m = createMachine(); request(m, e); advance(m, SPIN_UP_MS); return m; };

describe('transitionMachine — boot and constants', () => {
  it('boots into neutral, all fades 0, no active element', () => {
    const m = createMachine();
    expect(m).toMatchObject({ state: 'neutral', target: 'neutral', beat: 'idle' });
    steadyNeutral(m);
    expect(activeElement(m)).toBe(null);
    expect(isSteady(m)).toBe(true);
  });
  it('durations are the ruled values', () => {
    expect([FADE_OUT_MS, NEUTRAL_MS, SPIN_UP_MS]).toEqual([400, 300, 600]);
    expect(ELEMENTS).toEqual(['fluid', 'thermal', 'earth', 'air']);
  });
});

describe('transitionMachine — beats table', () => {
  it('neutral → e: spinUp over exactly 600 ms, easeOut', () => {
    const m = createMachine();
    request(m, 'earth');
    expect(m.beat).toBe('spinUp');
    expect(activeElement(m)).toBe('earth');
    advance(m, SPIN_UP_MS / 2);
    expect(m.fade.earth).toBeCloseTo(0.75, 9); // 1 − (1 − .5)²
    advance(m, SPIN_UP_MS / 2 - 0.001);
    expect(m.beat).toBe('spinUp');
    advance(m, 0.001);
    steadyOn(m, 'earth');
  });
  it('e → neutral (tap lit node): fadeOut over exactly 400 ms, easeIn, then rest', () => {
    const m = on('air');
    request(m, 'air');
    expect(m.target).toBe('neutral');
    expect(m.beat).toBe('fadeOut');
    expect(activeElement(m)).toBe(null);
    advance(m, FADE_OUT_MS / 2);
    expect(m.fade.air).toBeCloseTo(0.75, 9); // 1 − .5²
    advance(m, FADE_OUT_MS / 2 - 0.001);
    expect(m.beat).toBe('fadeOut');
    advance(m, 0.001);
    steadyNeutral(m);
  });
  it('e → e′: fadeOut 400, neutral 300, spinUp 600', () => {
    const m = on('fluid');
    request(m, 'thermal');
    expect(m.target).toBe('thermal');
    advance(m, FADE_OUT_MS - 0.001);
    expect(m.beat).toBe('fadeOut');
    advance(m, 0.001);
    expect(m.beat).toBe('neutral');
    expect(m.state).toBe('neutral');
    advance(m, NEUTRAL_MS - 0.001);
    expect(m.beat).toBe('neutral');
    advance(m, 0.001);
    expect(m.beat).toBe('spinUp');
    expect(m.state).toBe('thermal');
    advance(m, SPIN_UP_MS);
    steadyOn(m, 'thermal');
  });
  it('invariants hold on a 1 ms grid through every row', () => {
    const m = createMachine();
    request(m, 'fluid'); run(m, 700);
    request(m, 'earth'); run(m, 1400);
    request(m, 'earth'); run(m, 500);
    steadyNeutral(m);
  });
  it('tapping the element spinning up toggles to neutral without moving its fade', () => {
    const m = createMachine();
    request(m, 'fluid'); advance(m, 100);
    const f = m.fade.fluid;
    request(m, 'fluid'); // fluid is lit while it spins up
    expect(m.target).toBe('neutral');
    expect(m.fade.fluid).toBe(f);
  });
});

describe('transitionMachine — retarget', () => {
  it('reversal: tapping the element fading out goes straight into spinUp, no jump, spinUp rate', () => {
    const m = on('fluid');
    request(m, 'fluid');        // → neutral
    advance(m, 200);            // f = .75
    request(m, 'fluid');        // reverse
    expect(m.beat).toBe('spinUp');
    expect(m.fade.fluid).toBeCloseTo(0.75, 9);
    // spinUp from .75 is p = .5 → 300 ms remain
    advance(m, 299);
    expect(m.beat).toBe('spinUp');
    advance(m, 1);
    steadyOn(m, 'fluid');
  });
  it('reversal during spinUp → neutral fades out from the current value at the fadeOut rate', () => {
    const m = createMachine();
    request(m, 'air'); advance(m, 300); // f = .75
    request(m, 'air');                  // lit → neutral
    expect(m.beat).toBe('fadeOut');
    expect(m.fade.air).toBeCloseTo(0.75, 9);
    // fadeOut from .75 is p = .5 → 200 ms remain
    advance(m, 199); expect(m.beat).toBe('fadeOut');
    advance(m, 1); steadyNeutral(m);
  });
  it('another element during spinUp: current fades out from its value, then neutral beat, then spinUp', () => {
    const m = createMachine();
    request(m, 'air'); advance(m, 300);
    request(m, 'earth');
    expect(m.beat).toBe('fadeOut');
    expect(m.state).toBe('air');
    advance(m, 200); expect(m.beat).toBe('neutral');
    advance(m, NEUTRAL_MS); expect(m.beat).toBe('spinUp'); expect(m.state).toBe('earth');
    advance(m, SPIN_UP_MS); steadyOn(m, 'earth');
  });
  it('another element during fadeOut keeps the fadeOut and retargets the spinUp', () => {
    const m = on('fluid');
    request(m, 'thermal'); advance(m, 100);
    const f = m.fade.fluid;
    request(m, 'air');
    expect(m.beat).toBe('fadeOut');
    expect(m.fade.fluid).toBe(f);
    advance(m, 300 + NEUTRAL_MS + SPIN_UP_MS);
    steadyOn(m, 'air');
  });
  it('during the neutral beat: a new element retargets without restarting the beat', () => {
    const m = on('fluid');
    request(m, 'thermal'); advance(m, FADE_OUT_MS + 100);
    request(m, 'earth');
    expect(m.beat).toBe('neutral');
    advance(m, 199); expect(m.beat).toBe('neutral');
    advance(m, 1); expect(m.state).toBe('earth'); expect(m.beat).toBe('spinUp');
  });
  it('during the neutral beat: tapping the element that just left returns it (spinUp from 0 after the beat)', () => {
    const m = on('fluid');
    request(m, 'thermal'); advance(m, FADE_OUT_MS + 100);
    request(m, 'fluid');
    expect(m.target).toBe('fluid');
    advance(m, 200 + SPIN_UP_MS);
    steadyOn(m, 'fluid');
  });
});

describe('transitionMachine — large dt', () => {
  const starts = {
    'idle neutral → e': () => { const m = createMachine(); request(m, 'air'); return [m, 'air']; },
    'mid fadeOut → e′': () => { const m = on('fluid'); request(m, 'earth'); advance(m, 100); return [m, 'earth']; },
    'mid neutral beat → e′': () => { const m = on('fluid'); request(m, 'earth'); advance(m, 500); return [m, 'earth']; },
    'mid spinUp → e′': () => { const m = on('fluid'); request(m, 'earth'); advance(m, 900); return [m, 'earth']; },
    'mid fadeOut → neutral': () => { const m = on('fluid'); request(m, 'fluid'); advance(m, 100); return [m, 'neutral']; },
  };
  for (const [name, mk] of Object.entries(starts)) {
    it(`${name}: one advance(1e6) lands on the steady target`, () => {
      const [m, target] = mk();
      advance(m, 1e6);
      if (target === 'neutral') steadyNeutral(m); else steadyOn(m, target);
      expect(isSteady(m)).toBe(true);
    });
  }
});

describe('transitionMachine — holdLiquid', () => {
  it('true in neutral and the neutral beat, false during fadeOut, spinUp and steady element', () => {
    const m = createMachine();
    expect(holdLiquid(m)).toBe(true);                  // idle neutral
    request(m, 'fluid');
    expect(holdLiquid(m)).toBe(false);                 // spinUp
    advance(m, SPIN_UP_MS);
    expect(holdLiquid(m)).toBe(false);                 // steady fluid
    request(m, 'air');
    expect(holdLiquid(m)).toBe(false);                 // fadeOut
    advance(m, FADE_OUT_MS);
    expect(holdLiquid(m)).toBe(true);                  // neutral beat
    advance(m, NEUTRAL_MS);
    expect(holdLiquid(m)).toBe(false);                 // spinUp air
  });
});

describe('transitionMachine — targetElement', () => {
  it('is null at boot', () => { expect(targetElement(createMachine())).toBe(null); });
  it('is B from the tap through fadeOut, neutral beat and spinUp of A -> B', () => {
    const m = on('fluid');
    request(m, 'air');
    expect(targetElement(m)).toBe('air');
    advance(m, FADE_OUT_MS / 2); expect(m.beat).toBe('fadeOut'); expect(targetElement(m)).toBe('air');
    advance(m, FADE_OUT_MS); expect(m.beat).toBe('neutral'); expect(targetElement(m)).toBe('air');
    advance(m, NEUTRAL_MS); expect(m.beat).toBe('spinUp'); expect(targetElement(m)).toBe('air');
    advance(m, SPIN_UP_MS); expect(targetElement(m)).toBe('air');
  });
  it('is null at once after tapping the lit node', () => {
    const m = on('earth');
    request(m, 'earth');
    expect(targetElement(m)).toBe(null);
  });
  it('is null again after a retarget back to neutral during the neutral beat', () => {
    const k = on('earth');
    request(k, 'air'); advance(k, FADE_OUT_MS + 10);
    expect(k.beat).toBe('neutral');
    request(k, 'neutral');
    expect(targetElement(k)).toBe(null);
  });
});

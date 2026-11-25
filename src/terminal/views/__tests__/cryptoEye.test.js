// cryptoEye.test.js — the entropy drag charges the masthead eye live; a pause holds the charge.
import { describe, it, expect, afterEach } from 'vitest';
import { createCryptoEyeFeed, feedCryptoEye, pokeCryptoEye } from '../cryptoEye';
import { eyeDrive, live, release } from '../../components/eyeDrive';
import { SHAPE } from '../../components/observerEyeShader';

afterEach(() => release());

function run(mem, progress, ms, { pokeEvery = 0, t0 = 0 } = {}) {   // pokeEvery: frames between hits
  let t = t0;
  for (let i = 0; i < ms / 16; i++) {
    if (pokeEvery && i % pokeEvery === 0) pokeCryptoEye(mem);
    feedCryptoEye(progress, t, mem);
    t += 16;
  }
  return t;
}

describe('cryptoEye', () => {
  it('nothing_before_the_first_bit', () => {
    const mem = createCryptoEyeFeed();
    expect(feedCryptoEye(0, 0, mem)).toBe(false);
    expect(live(eyeDrive.palette, performance.now())).toBe(false);
  });

  it('palette_and_lattice_grow_with_the_pool', () => {
    const mem = createCryptoEyeFeed();
    run(mem, 0.1, 100);
    const early = { w: eyeDrive.palette.w, c: eyeDrive.shape.c };
    run(mem, 0.9, 100);
    expect(eyeDrive.shape.id).toBe(SHAPE.cipher);
    expect(eyeDrive.palette.w).toBeGreaterThan(early.w);
    expect(eyeDrive.shape.c).toBeGreaterThan(early.c);
    expect(eyeDrive.palette.quiet).toBe(true);                     // lapses without a back-spin
  });

  it('a_pause_holds_the_charge_and_calms_the_chaos', () => {
    const mem = createCryptoEyeFeed();
    const t = run(mem, 0.5, 400, { pokeEvery: 2 });                 // dragging: a cell every ~2 frames
    const dragging = { a: eyeDrive.shape.a, w: eyeDrive.palette.w, c: eyeDrive.shape.c };
    expect(dragging.a).toBeGreaterThan(0.3);
    run(mem, 0.5, 1500, { t0: t });                                 // paused
    expect(eyeDrive.shape.a).toBeLessThan(0.02);
    expect(eyeDrive.palette.w).toBeCloseTo(dragging.w, 6);
    expect(eyeDrive.shape.c).toBeCloseTo(dragging.c, 6);
  });
});

// The sphere's private random stream (src/terminal/art/artRandom.js).
//
// This exists because the draw loop takes stochastic DECISIONS from it — which
// edges live, which particles are emitted — so "it produces plausible numbers"
// is not the property that matters. The property that matters is that the same
// seed produces the same sequence no matter what else on the page is drawing
// random numbers, which is exactly what the shared global stream could not
// promise.

import { describe, it, expect } from 'vitest';
import { artRandom, seedArtRandom, ART_SEED } from '../src/terminal/art/artRandom.js';

const draw = (n, seed) => {
  seedArtRandom(seed);
  return Array.from({ length: n }, () => artRandom());
};

describe('artRandom', () => {
  it('replays exactly from the same seed', () => {
    expect(draw(64, ART_SEED)).toEqual(draw(64, ART_SEED));
  });

  it('gives different seeds different sequences', () => {
    const a = draw(64, 1), b = draw(64, 2);
    expect(a).not.toEqual(b);
    // and not merely offset from one another
    expect(a.slice(1)).not.toEqual(b.slice(0, 63));
  });

  it('stays in [0, 1)', () => {
    for (const v of draw(4096, ART_SEED)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is not perturbed by Math.random — the whole point', () => {
    // The global stream was shared with three.js, which draws a UUID per object
    // at a rate set by when render targets are reallocated. Drawing from
    // Math.random between our draws must not move our sequence by one value.
    seedArtRandom(ART_SEED);
    const clean = Array.from({ length: 32 }, () => artRandom());
    seedArtRandom(ART_SEED);
    const interleaved = Array.from({ length: 32 }, () => {
      for (let i = 0; i < 5; i++) Math.random();
      return artRandom();
    });
    expect(interleaved).toEqual(clean);
  });

  it('survives a reseed mid-stream and resumes deterministically', () => {
    seedArtRandom(ART_SEED);
    artRandom(); artRandom(); artRandom();
    seedArtRandom(ART_SEED);
    const after = Array.from({ length: 8 }, () => artRandom());
    expect(after).toEqual(draw(8, ART_SEED));
  });

  it('falls back to a fixed seed rather than degenerating on 0', () => {
    // A zero seed would otherwise be a plausible-looking way to get a stream
    // that is not the one anybody intended.
    expect(draw(4, 0)).toEqual(draw(4, 0));
    expect(draw(4, 0)).not.toEqual([0, 0, 0, 0]);
  });

  it('is roughly uniform, so swapping it in does not change how the piece looks', () => {
    const bins = new Array(10).fill(0);
    for (const v of draw(100000, ART_SEED)) bins[Math.floor(v * 10)]++;
    for (const b of bins) {
      expect(b).toBeGreaterThan(9000);
      expect(b).toBeLessThan(11000);
    }
  });
});

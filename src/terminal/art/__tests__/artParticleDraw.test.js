// The particle layer's draw laws (src/terminal/art/artParticleDraw.js).
//
// These exist to be pinned. Step 6 moves the layer to the GPU, and every number
// below has to come out of the GL writer identical to the way the canvas
// produced it — including the two quantisations the canvas performs by accident,
// which a float port would silently improve on.

import { describe, it, expect } from 'vitest';
import {
  particleAlpha, particleVisible, particleSize, particleGlowRadius,
  particleInFront, quantHue, quantAlpha,
  GLOW_STOPS, CORE_LIGHTNESS, CORE_ALPHA_SCALE, ALPHA_SCALE,
  discInkCorrection, SIZE_FLOOR,
} from '../artParticleDraw.js';

describe('particleAlpha', () => {
  it('eases in quadratically over the first 15% of life', () => {
    expect(particleAlpha(0)).toBeCloseTo(0, 10);
    expect(particleAlpha(0.075)).toBeCloseTo(0.25 * ALPHA_SCALE, 10);
    expect(particleAlpha(0.1499)).toBeCloseTo(Math.pow(0.1499 / 0.15, 2) * ALPHA_SCALE, 10);
  });

  it('holds flat between 15% and 70%', () => {
    for (const t of [0.15, 0.3, 0.5, 0.70]) {
      expect(particleAlpha(t)).toBeCloseTo(ALPHA_SCALE, 10);
    }
  });

  it('eases out with a 2.2 power over the last 30%', () => {
    expect(particleAlpha(0.85)).toBeCloseTo(Math.pow(0.5, 2.2) * ALPHA_SCALE, 10);
    expect(particleAlpha(1.0)).toBeCloseTo(0, 10);
  });

  it('is continuous at both knees', () => {
    // A discontinuity here would show as particles popping, which is the sort
    // of thing a mean-luminance gate cannot see at all.
    const eps = 1e-9;
    expect(particleAlpha(FADE_IN(-eps))).toBeCloseTo(particleAlpha(FADE_IN(eps)), 6);
    expect(particleAlpha(FADE_OUT(-eps))).toBeCloseTo(particleAlpha(FADE_OUT(eps)), 6);
    function FADE_IN(d) { return 0.15 + d; }
    function FADE_OUT(d) { return 0.70 + d; }
  });

  it('never exceeds the 0.55 ceiling anywhere in life', () => {
    for (let t = 0; t <= 1; t += 0.001) {
      expect(particleAlpha(t)).toBeLessThanOrEqual(ALPHA_SCALE + 1e-12);
    }
  });
});

describe('particleVisible', () => {
  it('culls at the threshold the 2D loop used', () => {
    // This decides the layer's INSTANCE COUNT, and one particle more or less is
    // invisible to every pixel gate in this repo.
    expect(particleVisible(0.0039)).toBe(false);
    expect(particleVisible(0.004)).toBe(true);
  });
});

describe('particleSize', () => {
  it('scales with projected depth', () => {
    expect(particleSize(2, 1.5)).toBeCloseTo(3, 10);
  });

  it('never collapses below the 0.4px floor', () => {
    // A sub-pixel disc still deposits ink, so the floor is load-bearing for
    // parity and not a cosmetic guard.
    expect(particleSize(0.1, 0.5)).toBeCloseTo(0.4, 10);
    expect(particleSize(0, 10)).toBeCloseTo(0.4, 10);
  });
});

describe('particleGlowRadius', () => {
  it('is 3.5x the core radius', () => {
    expect(particleGlowRadius(2)).toBeCloseTo(7, 10);
    expect(particleGlowRadius(0.4)).toBeCloseTo(1.4, 10);
  });
});

describe('particleInFront', () => {
  it('culls the deep back face at -0.6', () => {
    expect(particleInFront(-0.61)).toBe(false);
    expect(particleInFront(-0.6)).toBe(true);
    expect(particleInFront(1)).toBe(true);
  });
});

describe('the quantisations the canvas performs by accident', () => {
  it('truncates hue toward zero, as `hue|0` does inside the template string', () => {
    expect(quantHue(214.99)).toBe(214);
    expect(quantHue(0.9)).toBe(0);
    expect(quantHue(359.999)).toBe(359);
  });

  it('rounds alpha to three decimals, as toFixed(3) does', () => {
    expect(quantAlpha(0.5499999)).toBeCloseTo(0.55, 10);
    expect(quantAlpha(0.0004)).toBeCloseTo(0, 10);
    expect(quantAlpha(0.0005)).toBeCloseTo(0.001, 10);
  });

  it('makes a float port MORE precise than the thing it copies', () => {
    // Stated as a test because it is the parity failure that looks like an
    // improvement: the GL layer must reproduce the coarseness, not beat it.
    const raw = 0.123456789;
    expect(quantAlpha(raw)).not.toBe(raw);
    expect(quantAlpha(raw)).toBeCloseTo(0.123, 10);
  });
});

describe('the glow ramp', () => {
  it('is the three stops the canvas gradient declares', () => {
    expect(GLOW_STOPS.map((s) => [s.at, s.lightness, s.alphaScale])).toEqual([
      [0, 82, 1],
      [0.4, 65, 0.5],
      [1, 50, 0],
    ]);
  });

  it('puts its knee at 0.4, not the midpoint', () => {
    // The shader's existing three-stop gradient hard-codes a 0.5 split. Feeding
    // this ramp through it unchanged would move the knee and every pixel
    // between it and the rim.
    expect(GLOW_STOPS[1].at).not.toBe(0.5);
    expect(GLOW_STOPS[1].at).toBeCloseTo(0.4, 10);
  });

  it('darkens as it fades, which is why coverage alone cannot express it', () => {
    const l = GLOW_STOPS.map((s) => s.lightness);
    expect(l[0]).toBeGreaterThan(l[1]);
    expect(l[1]).toBeGreaterThan(l[2]);
  });

  it('ends fully transparent', () => {
    expect(GLOW_STOPS[2].alphaScale).toBe(0);
  });

  it('draws the core brighter than any point of the glow', () => {
    expect(CORE_LIGHTNESS).toBe(92);
    expect(CORE_LIGHTNESS).toBeGreaterThan(GLOW_STOPS[0].lightness);
    expect(CORE_ALPHA_SCALE).toBe(0.8);
  });
});

describe('discInkCorrection', () => {
  it('is derived from the box filter, not tuned', () => {
    // The shader deposits pi*(R^2 + 1/12) where the true area is pi*R^2, so the
    // correction is R^2 / (R^2 + 1/12) exactly. Asserted against the integral
    // rather than against remembered numbers.
    const boxInk = (R) => {
      let s = 0; const N = 600, W = R + 3, h = 2 * W / N;
      for (let y = -W; y < W; y += h) for (let x = -W; x < W; x += h) {
        const d = Math.hypot(x, y);
        s += Math.max(0, Math.min(1, (R - d) + 0.5)) * h * h;
      }
      return s;
    };
    for (const R of [1, 2, 3, 5]) {
      expect(discInkCorrection(R)).toBeCloseTo(Math.PI * R * R / boxInk(R), 2);
    }
  });

  it('barely touches a node-sized disc and heavily corrects a sub-pixel one', () => {
    // Why no earlier step needed this: node cores and halos are 8-25px.
    expect(discInkCorrection(20)).toBeGreaterThan(0.9997);
    expect(discInkCorrection(8)).toBeGreaterThan(0.998);
    expect(discInkCorrection(1)).toBeCloseTo(0.9231, 4);
    expect(discInkCorrection(SIZE_FLOOR)).toBeCloseTo(0.6575, 4);
  });

  it('never brightens — a correction for over-coverage only dims', () => {
    for (let R = 0.1; R < 30; R += 0.1) {
      expect(discInkCorrection(R)).toBeGreaterThan(0);
      expect(discInkCorrection(R)).toBeLessThan(1);
    }
  });

  it('approaches 1 as the disc grows, so it cannot distort a large layer', () => {
    expect(discInkCorrection(1000)).toBeCloseTo(1, 6);
  });
});

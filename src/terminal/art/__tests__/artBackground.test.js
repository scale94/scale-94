// artBackground.test.js — the numbers behind the GL background layers.
//
// These were inline in a 3144-line draw loop. They are extracted so the GPU
// version and the (temporarily still-2D) version cannot drift apart silently,
// and so the decay curves can be tested without a canvas.
//
// Three of these assertions correct the plan that asked for them. The plan
// took two of its claims from comments in the draw loop, and the comments are
// wrong — see the decay tests below. Copying a comment is not reading the code.

import { describe, it, expect } from 'vitest';
import {
  FLASH_DECAY, FLASH_ALPHA, FLASH_CUTOFF, FLASH_GRID_STEP,
  BEAT_DECAY, BEAT_CUTOFF,
  GHOST_CULL_Z, GHOST_COUNT,
  stepFlash, riftTint, beatPulseAlpha, beatPulseRadius, ghostTrailAlpha,
  exergyAlpha, genesisGlowState,
} from '../artBackground';

describe('stepFlash', () => {
  it('decays geometrically at the rate the draw loop used', () => {
    expect(FLASH_DECAY).toBe(0.92);
    expect(stepFlash(1)).toBeCloseTo(FLASH_DECAY, 10);
    expect(stepFlash(0.5)).toBeCloseTo(0.5 * FLASH_DECAY, 10);
  });

  it('snaps to exactly zero below the cutoff so the layer can be skipped', () => {
    expect(stepFlash(FLASH_CUTOFF * 0.9)).toBe(0);
    expect(stepFlash(0)).toBe(0);
  });

  it('takes ~1.07s to reach the cutoff, NOT the ~200ms the source comment claims', () => {
    // The draw loop says "exponential decay ~200ms" next to `*= 0.92`. It is
    // wrong by 5x: 0.92^n <= 0.005 needs n = 64 frames = 1067ms at 60fps.
    // The comment is the plan's source for a 120..320ms assertion, so that
    // assertion was wrong too. Locking the MEASURED value — if the shader
    // makes the flash feel too long, that is an art decision to take
    // deliberately, not a number to quietly "restore" to a fictional 200ms.
    let v = 1, frames = 0;
    while (v > 0 && frames < 1000) { v = stepFlash(v); frames++; }
    expect(frames).toBe(64);
    expect(frames * (1000 / 60)).toBeCloseTo(1066.7, 0);
  });

  it('exposes the grid geometry the flash layer draws', () => {
    expect(FLASH_ALPHA).toBe(0.08);
    expect(FLASH_GRID_STEP).toBe(28);
  });
});

describe('riftTint', () => {
  it('is more transparent in immersive so the GL background reads through', () => {
    expect(riftTint(0, true).a).toBeLessThan(riftTint(0, false).a);
    expect(riftTint(0, true).a).toBeCloseTo(0.32, 5);
    expect(riftTint(0, false).a).toBeCloseTo(0.72, 5);
  });

  it('bleeds red in proportion to the metabolic rift, capped at +28', () => {
    expect(riftTint(0, false).r).toBe(0);
    expect(riftTint(1, false).r).toBe(28);
    expect(riftTint(0.5, false).r).toBe(14);
  });

  it('rounds the red channel exactly as the 2D fillStyle did', () => {
    // The draw loop built `rgba(${Math.round(rift*28)},0,0,a)`. Rounding, not
    // truncation — a shader fed the unrounded value differs by up to half a
    // level, which is under the comparator's noise floor and so would never
    // be caught by the pixel gate.
    // Boundary values must sit ABOVE the 0.05 rift threshold, or the black
    // branch answers instead and the test proves nothing about rounding.
    expect(riftTint(0.3, false).r).toBe(Math.round(0.3 * 28));
    expect(riftTint(0.053, false).r).toBe(1);  // 1.484 → 1
    expect(riftTint(0.054, false).r).toBe(2);  // 1.512 → 2
  });

  it('is black below the 0.05 rift threshold, where the tint branch is off', () => {
    // Below 0.05 the loop took the plain-black branch. At rift 0.04 the
    // rounded red would have been 1, so the two branches are NOT continuous:
    // there is a real 1-level step at the threshold. Preserved deliberately.
    expect(riftTint(0.04, false).r).toBe(0);
    expect(riftTint(0.06, false).r).toBe(2);
  });
});

describe('beatPulseAlpha', () => {
  it('decays at 0.88 and scales the amber core by 0.14', () => {
    expect(BEAT_DECAY).toBe(0.88);
    expect(beatPulseAlpha(1)).toBeCloseTo(0.14, 10);
    expect(beatPulseAlpha(0.5)).toBeCloseTo(0.07, 10);
    expect(beatPulseAlpha(0)).toBe(0);
  });

  it('takes ~700ms to silence, NOT the ~300ms the source comment claims', () => {
    // Same class of error as the flash: `*= 0.88` with a "~300ms" comment
    // actually needs 42 frames = 700ms.
    let v = 1, frames = 0;
    while (v > BEAT_CUTOFF && frames < 1000) { v *= BEAT_DECAY; frames++; }
    expect(frames).toBe(42);
  });

  it('swells the radius from 1.05x to 1.23x the sphere radius', () => {
    expect(beatPulseRadius(100, 0)).toBeCloseTo(105, 6);
    expect(beatPulseRadius(100, 1)).toBeCloseTo(123, 6);
  });
});

describe('exergyAlpha', () => {
  it('is off at or below the 0.1 threshold, and scales by 0.06 above it', () => {
    expect(exergyAlpha(0)).toBe(0);
    expect(exergyAlpha(0.1)).toBe(0);          // strictly greater-than in the loop
    expect(exergyAlpha(0.5)).toBeCloseTo(0.03, 10);
    expect(exergyAlpha(1)).toBeCloseTo(0.06, 10);
  });
});

describe('genesisGlowState', () => {
  it('draws nothing outside awakening phase 0', () => {
    expect(genesisGlowState(1, 0, 100, 0)).toBeNull();
    expect(genesisGlowState(2, 0, 100, 0)).toBeNull();
  });

  it('starts at 0.035 alpha and 0.6x radius, then grows as it fades', () => {
    const a = genesisGlowState(0, 0, 100, 0);
    expect(a.alpha).toBeCloseTo(0.035, 10);
    expect(a.radius).toBeCloseTo(60, 10);
    const b = genesisGlowState(0, 0, 100, 2000);   // halfway
    expect(b.alpha).toBeCloseTo(0.0175, 10);
    expect(b.radius).toBeCloseTo(100, 10);         // 0.6 + 0.5*0.8 = 1.0
  });

  it('stops drawing before the fade reaches zero, at the 0.002 cutoff', () => {
    // 0.035*(1-t) < 0.002  =>  t > 0.94286  =>  after ~3771ms, not 4000ms.
    expect(genesisGlowState(0, 0, 100, 3700)).not.toBeNull();
    expect(genesisGlowState(0, 0, 100, 3800)).toBeNull();
    expect(genesisGlowState(0, 0, 100, 99999)).toBeNull();
  });
});

describe('ghostTrailAlpha', () => {
  it('fades with DEPTH, not with age', () => {
    // The plan specified `ghostTrailAlpha(ageMs)`. There is no age term in
    // the draw loop at all: the ghosts are last session's node positions and
    // their alpha is `max(0, rz) * 0.07`, i.e. front-of-sphere ghosts are
    // brighter. Building an age fade would have invented a layer that never
    // existed and it would have passed the pixel gate on the idle state,
    // where every ghost happens to sit at the same age.
    expect(ghostTrailAlpha(1)).toBeCloseTo(0.07, 10);
    expect(ghostTrailAlpha(0.5)).toBeCloseTo(0.035, 10);
    expect(ghostTrailAlpha(0)).toBe(0);
  });

  it('clamps negative depth to zero rather than going negative', () => {
    expect(ghostTrailAlpha(-0.2)).toBe(0);
    expect(ghostTrailAlpha(-1)).toBe(0);
  });

  it('culls behind -0.3 depth, which is BEHIND the alpha reaching zero', () => {
    // Between rz -0.3 and 0 the ghost is drawn at alpha 0. The cull is
    // therefore invisible in 2D — but in a shader that skips the max(0,...)
    // it would smear a band of negative-alpha ghosts across the back face.
    expect(GHOST_CULL_Z).toBe(-0.3);
    expect(ghostTrailAlpha(GHOST_CULL_Z)).toBe(0);
    expect(GHOST_COUNT).toBe(31);
  });
});

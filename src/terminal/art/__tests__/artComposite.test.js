// artComposite.test.js — the parts of the GL composite that do not need a GPU.
//
// The pointer-events contract is the one that matters. The GL overlay covers
// the 2D canvas completely; if it ever accepts pointer events, every hover,
// click, shift-click resonance, long-press fusion and drag on the sphere stops
// working while the render still looks perfect. That failure mode is invisible
// in a screenshot, so it gets a unit test instead.

import { describe, it, expect } from 'vitest';
import {
  compositeDpr, LAYER_Z, COMPOSITE_STYLE, BLOOM, VIGNETTE,
} from '../artComposite';

describe('compositeDpr', () => {
  it('matches the 2D canvas cap of 1.5 so the composite is texel-for-texel', () => {
    // ArtTab's ResizeObserver uses Math.min(devicePixelRatio, 1.5). If the GL
    // canvas picked a different DPR the quad would resample the 2D output.
    expect(compositeDpr(1)).toBe(1);
    expect(compositeDpr(1.5)).toBe(1.5);
    expect(compositeDpr(2)).toBe(1.5);
    expect(compositeDpr(3)).toBe(1.5);
  });

  it('never returns 0 or a negative for a missing or absurd devicePixelRatio', () => {
    expect(compositeDpr(0)).toBe(1);
    expect(compositeDpr(-2)).toBe(1);
    expect(compositeDpr(undefined)).toBe(1);
    expect(compositeDpr(NaN)).toBe(1);
  });
});

describe('layer contract', () => {
  it('stacks 2D canvas under composite under labels under tooltip', () => {
    expect(LAYER_Z.canvas2d).toBeLessThan(LAYER_Z.composite);
    expect(LAYER_Z.composite).toBeLessThan(LAYER_Z.labels);
    expect(LAYER_Z.labels).toBeLessThan(LAYER_Z.tooltip);
  });

  it('makes the GL overlay transparent to pointer events', () => {
    expect(COMPOSITE_STYLE.pointerEvents).toBe('none');
  });

  it('anchors to the top-left of the container, not to all four edges', () => {
    // Not `inset: 0`: the container is taller than the 2D canvas because it also
    // holds the label overlay, and r3f sizes its renderer by measuring this
    // element. Covering the container would make the GL buffer taller than the
    // texture it presents.
    expect(COMPOSITE_STYLE.position).toBe('absolute');
    expect(COMPOSITE_STYLE.top).toBe(0);
    expect(COMPOSITE_STYLE.left).toBe(0);
    expect(COMPOSITE_STYLE.inset).toBeUndefined();
  });

  it('sits at the composite layer', () => {
    expect(COMPOSITE_STYLE.zIndex).toBe(LAYER_Z.composite);
  });
});

describe('effect parameters', () => {
  it('extracts only bright pixels rather than blooming the whole frame', () => {
    // The old fake bloom blurred everything at 0.15 alpha, which is why it read
    // as a smear. Real bright-extract needs a threshold above the background.
    expect(BLOOM.luminanceThreshold).toBeGreaterThan(0);
    expect(BLOOM.luminanceThreshold).toBeLessThan(1);
    expect(BLOOM.intensity).toBeGreaterThan(0);
    expect(BLOOM.mipmapBlur).toBe(true);
  });

  it('keeps the vignette darkness below fully opaque', () => {
    expect(VIGNETTE.darkness).toBeGreaterThan(0);
    expect(VIGNETTE.darkness).toBeLessThan(1);
  });
});

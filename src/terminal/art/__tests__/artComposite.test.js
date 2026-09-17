// artComposite.test.js — the parts of the GL composite that do not need a GPU.
//
// The pointer-events contract is the one that matters. The GL overlay covers
// the 2D canvas completely; if it ever accepts pointer events, every hover,
// click, shift-click resonance, long-press fusion and drag on the sphere stops
// working while the render still looks perfect. That failure mode is invisible
// in a screenshot, so it gets a unit test instead.

import { describe, it, expect } from 'vitest';
import {
  compositeDpr, glBufferSettled, LAYER_Z, COMPOSITE_STYLE, BLOOM, VIGNETTE,
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

describe('glBufferSettled — when SizeSync is allowed to stop asking', () => {
  // SizeSync drives r3f's own resize path and retries until the renderer
  // agrees. The predicate it retries against has to be the number three.js can
  // actually produce: WebGLRenderer.setSize writes
  //   canvas.width = Math.floor( width * pixelRatio )
  // and this asked for Math.round(clientWidth * ratio). Wherever that product
  // lands on a half pixel the two differ by one for ever and the component
  // dispatches a page-wide resize every ten frames for as long as the tab is
  // open — MEASURED at window 1521 @1.5 and 1522 @1.25, ~20 events a second.
  //
  // The match is EXACT on purpose; see the note in artComposite.js. A one-pixel
  // tolerance was tried and measurably changed the artwork.

  it('settles when the buffer is exactly what setSize would write', () => {
    expect(glBufferSettled(2169, 870, 1446, 580, 1.5)).toBe(true);
    expect(glBufferSettled(1446, 580, 1446, 580, 1)).toBe(true);
  });

  it('settles on the half-pixel products that made it spin for ever', () => {
    // 1447 x 1.5 = 2170.5: three floors to 2170, the old check rounded to 2171.
    expect(glBufferSettled(2170, 870, 1447, 580, 1.5)).toBe(true);
    // 1447 x 1.25 = 1808.75: floor 1808, round 1809.
    expect(glBufferSettled(1808, 725, 1447, 580, 1.25)).toBe(true);
    // And the immersive size at the same ratio, which is a different number
    // from the normal one — which is why the toggle can change the answer.
    expect(glBufferSettled(2281, 1350, 1521, 900, 1.5)).toBe(true);
  });

  it('does NOT settle for a buffer one pixel short — that one resamples', () => {
    // The texel-for-texel contract DPR_CAP exists for. Accepting this cost
    // every prism sub-layer ~5% of its ink and put the star spoke's presence
    // check under its threshold. Keep retrying: it is reachable, and reached.
    expect(glBufferSettled(2168, 870, 1446, 580, 1.5)).toBe(false);
    expect(glBufferSettled(2169, 869, 1446, 580, 1.5)).toBe(false);
  });

  it('does NOT settle for the stuck first-layout buffer this exists to heal', () => {
    // The renderer measured its container at 14x6 during first layout and
    // stayed there while the wrapper was correctly 1446x580.
    expect(glBufferSettled(14, 6, 1446, 580, 1)).toBe(false);
  });

  it('does NOT settle when only one axis has landed', () => {
    expect(glBufferSettled(2169, 6, 1446, 580, 1.5)).toBe(false);
    expect(glBufferSettled(14, 870, 1446, 580, 1.5)).toBe(false);
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

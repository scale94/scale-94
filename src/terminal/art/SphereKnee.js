// SphereKnee.js — the soft-knee shoulder, at the composer tail.
//
// The last arithmetic before the 8-bit write. Sits AFTER <Bloom> so the
// bright-extract sees true overbright and a 30x core blooms like a 30x core;
// see the KNEE block in artComposite.js for why that placement is the design
// rather than a convenience, and for the curve's derivation.
//
// ── Why this is an Effect and not another fullscreen quad ──────────────────
//
// @react-three/postprocessing merges every <Effect> in the composer into ONE
// fragment pass, in source order, and hands each one the running `inputColor`.
// A separate quad would be a separate pass with its own full-resolution
// read/write of the frame buffer, and — worse — its ordering against the bloom
// would depend on pass insertion order rather than on anything visible here.
//
// It also matters for what comes next. The blue-noise dither (design section
// 2.4) has to be the LAST arithmetic before quantisation, after this shoulder.
// Written as two sibling effects that ordering is a JSX accident; written as
// two steps of one `mainImage` it is a fact about the source. The dither is
// deliberately NOT here yet: it is a plus-or-minus one level correction and the
// film grain that ships on top of the canvas is roughly three and a half levels
// of white noise, so until that relationship is measured a dither pass is
// provably invisible. See the design's section 2.
//
// ── Branchless, deliberately ───────────────────────────────────────────────
//
// The scalar reference in artComposite.js is written with an early return
// because that reads better in JS. Here the same expression is evaluated
// unconditionally and selected with step(), for two reasons: a branch on a
// per-pixel value diverges across a warp and costs more than the arithmetic it
// skips, and the `m` in the denominator has to be guarded anyway — a fully
// black pixel has max channel 0, and 0/0 is a NaN that propagates to the
// screen as a black or white speck depending on the driver.

import { Effect } from 'postprocessing';
import { Uniform } from 'three';

import { KNEE } from './artComposite';

const KNEE_FRAG = /* glsl */`
  uniform float uKnee;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;

    // The max channel, NOT luminance. Normalising by luminance preserves hue
    // but does not bound the channels: a saturated (6, 0, 0) has luminance
    // 1.28, so scaling by f(L)/L leaves red above 1 and clipping anyway. The
    // max channel preserves the same hue and saturation ratios AND guarantees
    // the result lands in gamut.
    float m = max(max(c.r, c.g), c.b);

    // s is floored at an epsilon. At uKnee = 1.5 and m = 2.0 the denominator
    // t + s is EXACTLY zero, and the resulting inf reaches the screen as a
    // driver-dependent speck. Flooring it degenerates the curve into a hard
    // clamp at the knee, which is a sane thing for a nonsense input to do.
    // softKnee() in artComposite.js carries the identical guard so the two
    // implementations agree at every input, not merely on the intended range.
    float s = max(1.0 - uKnee, 1e-6);
    float t = m - uKnee;
    float mapped = uKnee + s * t / (t + s);

    // Guard the divide before it happens, not after. m is 0 on every black
    // pixel in the frame, and a NaN here survives to the screen.
    float safe = max(m, 1e-6);

    // step() is 1.0 only above the knee; below it the scale is exactly 1.0 and
    // this pass is bit-identical to a no-op. Note the comparison is against the
    // UNGUARDED m, so a black pixel is selected out rather than relying on the
    // epsilon to make the arithmetic harmless.
    float scale = mix(1.0, mapped / safe, step(uKnee, m));

    // Alpha is passed through untouched. The composer's buffer carries 1.0
    // here — the screen pass writes full alpha — and compressing it would make
    // the frame translucent over whatever the canvas sits on.
    outputColor = vec4(c * scale, inputColor.a);
  }
`;

/**
 * The shoulder. `knee` is in the composer's LINEAR working space; see the KNEE
 * block in artComposite.js for why that number agrees with the sRGB-encoded
 * accumulator above 1.0 and diverges below it.
 *
 * A `knee` at or above the frame's maximum makes the curve the identity, which
 * is the null-knee configuration the verification plan uses to prove this pass
 * is a no-op outside its intended range.
 */
export class KneeEffect extends Effect {
  constructor({ knee = KNEE.knee } = {}) {
    super('KneeEffect', KNEE_FRAG, {
      uniforms: new Map([['uKnee', new Uniform(knee)]]),
    });
  }

  get knee() {
    return this.uniforms.get('uKnee').value;
  }

  set knee(v) {
    this.uniforms.get('uKnee').value = v;
  }
}

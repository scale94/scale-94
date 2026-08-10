// SphereEdges.js — the sphere's base edges, on the GPU.
//
// Step 4's first pixel-moving commit. The 2D draw loop no longer strokes an
// edge; it writes sixteen floats per edge into a preallocated Float32Array and
// this module draws them as one instanced quad into the backdrop target that
// SphereComposite already owns.
//
// ── What did NOT move, and must not ────────────────────────────────────────
//
// Projection, the depth sort and the per-edge state derivation all stay on the
// CPU. `edgeAt()` hit-tests against the same projected screen coordinates the
// draw loop computes; moving the projection into the vertex shader renders
// identically and kills every edge hover silently. The CPU therefore hands this
// module *screen-space endpoints in CSS px*, in the depth-sorted order it
// already had, and the shader does no 3D at all.
//
// ── Why the geometry lives in the backdrop scene ───────────────────────────
//
// Anything in r3f's scene graph is drawn to the screen by the EffectComposer.
// The edges have to land INSIDE the offscreen target, over the backdrop and
// under the 2D canvas, so they are added to the imperative backdrop scene in
// SphereComposite instead. That target is RGBA8 / NoColorSpace, so a plain
// SrcAlpha / OneMinusSrcAlpha blend there happens in sRGB byte space — which is
// what the canvas did. Blending these in three's linear working space is the
// bug that cost step 3 a rewrite and still scored 1.285 against a threshold
// of 4.
//
// ── The attribute layout ───────────────────────────────────────────────────
//
//   0–3    ax, ay, bx, by   projected endpoints, CSS px, canvas y-down
//   4–6    r, g, b          gradient stop 0 (at A), sRGB 0–1
//   7–9    r, g, b          gradient stop 1 (midpoint)
//   10–12  r, g, b          gradient stop 2 (at B)
//   13     packed alphas    a0 + a1*256 + a2*65536, each quantised to 1/255
//   14     width            stroke width in px
//   15     packed flags     dashPeriod + dashDuty*256 + (round(glow*8) + isOrtho*128)*65536
//
// Every packed field is an INTEGER. A float32 represents every integer below
// 2^24 exactly, and all the divisors used to unpack are powers of two, so the
// round trip is lossless — which is why the glow radius is carried in eighths
// of a pixel rather than as a fraction. The brief's `glow*65536` would have put
// a fractional field under two integer ones and leaked its low bits into the
// dash period.
//
// ── isOrtho, and why it did NOT need a 17th float ──────────────────────────
//
// A canvas shadow's colour and alpha are set once by `ctx.shadowColor` and
// never varied per-instance the way the stroke's gradient is — fused edges use
// `hslAlpha(cMid, fuseCos * 0.6)`, the orthogonal bridge uses a fully opaque
// `hue + 30`. The flat `GLOW_K` this shipped with borrowed the gradient's own
// colour and a single alpha for both, so the ortho halo came out ~2x too dim
// and up to 120deg off in hue (see task-3-report.md's fix wave).
//
// `packFlags` rounds glow to eighths and clamps it to [0, 127] — both real
// glow radii (fusedGlow, orthoGlow) top out at 14px, i.e. round(14*8) = 112 —
// so bit 7 of that byte (bit 23 of the packed field) is provably never set by
// a real glow value. It carries `isOrtho` instead, and the shader picks the
// correct shadow alpha and colour per-instance from data it already has:
//
//   - fused:  colour = the mid stop (vC1 IS cMid already — writeHslRgb writes
//             stops[1].color there); alpha = fuseCos * 0.6, and fuseCos is
//             recovered from vGlow itself, because fusedGlow() is a bijective
//             linear map of it (fuseCos = (vGlow - FUSED_GLOW_BASE) /
//             FUSED_GLOW_SCALE). No new data needed.
//   - ortho:  alpha = 1.0 (constant); colour = hsl(hue + 30, 100%, 60%). Sat
//             and lit are compile-time constants for this shadow, and the hue
//             is the ONE thing that's per-frame, not per-instance — orthoHue
//             is time-based and identical for every ortho edge in a frame, so
//             it travels as a uniform (`uOrthoHue`), not a 17th packed float.

import * as THREE from 'three';
import { FUSED_GLOW_BASE, FUSED_GLOW_SCALE, ORTHO_HUE_STEP_GLOW } from './artEdges.js';

/** Render an integer constant as a GLSL float literal, for injecting the
 *  artEdges.js constants into the shader source so they stay one source of
 *  truth instead of a second hand-copied magic number. */
const glslFloat = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/** Floats per edge instance. */
export const EDGE_STRIDE = 16;

/** Hard cap on edges uploaded in a frame. 31 core nodes give ~90 edges; the
 *  rest are spectral bridges, bone fusions and operator-forged links, all of
 *  which are handfuls. 1024 is 64KB of scratch and cannot be reached. */
export const MAX_EDGES = 1024;

/** How many glow radii the instance quad is padded by. The shoulder is
 *  exp(-2(d/g)^2), which drops below 1/255 at d = 1.66g. */
export const GLOW_REACH = 1.75;

// GLOW_K, the flat 0.5 this shipped with, is gone: it stood in for two
// different `ctx.shadowColor` alphas (and always the wrong colour — see the
// file header). The shader now derives the real alpha and colour per-instance
// from the isOrtho bit instead of averaging them into one global uniform.

/**
 * Allocate the buffer the draw loop writes into. Once, never per frame.
 *
 * `w` and `h` are the CSS dimensions the endpoints were projected in, and they
 * are published WITH the coordinates rather than measured on the GL side. r3f's
 * own `size` comes from a ResizeObserver that is documented in SphereComposite
 * as getting stuck on this page, and SizeSync only nudges it back over several
 * frames. A stale resolution barely moves the backdrop — it is uv-addressed and
 * stays centred — but it rescales absolute pixel coordinates about the origin,
 * which throws most of the edges off-screen. Measured: at the immersive toggle
 * the edge layer vanished from the capture entirely while the backdrop looked
 * fine.
 */
export function createEdgeState() {
  return {
    count: 0, w: 1, h: 1, orthoHue: 0,
    data: new Float32Array(MAX_EDGES * EDGE_STRIDE),
  };
}

/**
 * HSL → sRGB, written into `out` at `o`, with exactly CSS `hsl()` semantics.
 *
 * The node palette is HSL objects with sat/lit in PERCENT (artGraph.js,
 * kernelColorMap.js) and the 2D code handed them straight to canvas as
 * `hsla()` strings. The GPU needs floats, so the conversion happens here and
 * nowhere else. Interpolation between two node colours still happens in HSL on
 * the CPU via lerpColor — a shortest-arc hue lerp takes a different path across
 * the wheel than an RGB lerp, and re-doing it in the shader would re-art the
 * midpoint of every edge.
 */
export function writeHslRgb(out, o, c) {
  writeHsl(out, o, c.hue, c.sat, c.lit);
}

/** The same conversion from loose numbers, for the ortho bridge's synthesised
 *  hues — it never had a colour object, and building one per edge per frame
 *  would put the draw loop back on the allocation path. */
export function writeHsl(out, o, hue, sat, lit) {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(1, Math.max(0, sat / 100));
  const l = Math.min(1, Math.max(0, lit / 100));
  const a = s * Math.min(l, 1 - l);
  // The CSS Color 4 reference implementation, verbatim.
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  out[o]     = f(0);
  out[o + 1] = f(8);
  out[o + 2] = f(4);
}

/**
 * Three alphas into one float. Each is clamped to 0–1 first, which is not
 * tidiness: `baseAlpha + pulseBoost` can exceed 1 and the canvas clamped it
 * when it parsed the `hsla()` string.
 */
export function packAlphas(a0, a1, a2) {
  const q = (a) => Math.max(0, Math.min(255, Math.round(a * 255)));
  return q(a0) + q(a1) * 256 + q(a2) * 65536;
}

/** The inverse of `packAlphas`, normalised back to 0–1. Exported so the tests
 *  exercise the exact arithmetic `EDGE_VERT` runs (see `vAlpha` there)
 *  instead of a hand-copied second implementation that could drift from it
 *  unnoticed — see the note beside `unpackFlags`. */
export function unpackAlphas(packed) {
  return {
    a0: Math.floor(packed % 256) / 255,
    a1: Math.floor((packed / 256) % 256) / 255,
    a2: Math.floor(packed / 65536) / 255,
  };
}

/**
 * Dash pattern, glow radius and the isOrtho flag into one float. `dashPeriod`
 * is on+off and `dashDuty` is on, both in px; a period of 0 means solid. The
 * glow is quantised to 1/8 px, which is 64 steps across the 6–14 px range the
 * ortho bridge breathes through — finer than the falloff can show — and
 * clamped to [0, 127] rather than [0, 255]: both real glow radii top out at
 * 14px (round(14*8) = 112), so bit 7 of that byte is provably never reached by
 * a real glow value and carries `isOrtho` instead. See the file header for why
 * that avoids a 17th float.
 */
export function packFlags(dashPeriod, dashDuty, glow, isOrtho = false) {
  const p = Math.max(0, Math.min(255, Math.round(dashPeriod)));
  const d = Math.max(0, Math.min(255, Math.round(dashDuty)));
  const g = Math.max(0, Math.min(127, Math.round(glow * 8))) + (isOrtho ? 128 : 0);
  return p + d * 256 + g * 65536;
}

/** The inverse of `packFlags`, mirroring exactly what `EDGE_VERT` unpacks
 *  (dashPeriod/dashDuty via mod/floor, glow's top bit split off as isOrtho).
 *  Exported so `artEdges.test.js` cannot drift from the shader's arithmetic —
 *  see `EDGE_VERT` for the GLSL twin of this function. */
export function unpackFlags(packed) {
  const gByte = Math.floor(packed / 65536);
  return {
    dashPeriod: Math.floor(packed % 256),
    dashDuty: Math.floor((packed / 256) % 256),
    isOrtho: gByte >= 128,
    glow: (gByte % 128) / 8,
  };
}

// ── Shaders ────────────────────────────────────────────────────────────────
//
// A ShaderMaterial, so `position` and the matrices are declared for us. The
// matrices are unused on purpose: gl_Position is written in clip space
// directly from CSS px, which keeps the camera out of the parity argument.
// uv.y and clip y run opposite to canvas y, hence the flip.

const EDGE_VERT = /* glsl */`
  attribute vec4 aEnds;
  attribute vec3 aC0;
  attribute vec3 aC1;
  attribute vec3 aC2;
  attribute vec3 aPack;      // x = packed alphas, y = width px, z = packed flags

  uniform vec2  uResolution; // CSS px, matching the 2D draw loop's coordinates
  uniform float uGlowReach;

  varying vec3  vC0;
  varying vec3  vC1;
  varying vec3  vC2;
  varying vec3  vAlpha;
  varying float vAlong;      // px from A along the segment; negative before A
  varying float vD;          // signed perpendicular distance in px
  varying float vLen;
  varying float vHalfW;
  varying vec2  vDash;
  varying float vGlow;
  varying float vIsOrtho;    // 0.0 or 1.0 — same for all 4 verts of an instance

  void main() {
    vec2 a = aEnds.xy;
    vec2 b = aEnds.zw;
    vec2 delta = b - a;
    float len = length(delta);
    vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    // Unpack. Every divisor is a power of two and every field an integer, so
    // these are exact for a float32 payload below 2^24. The glow byte's top
    // bit (>=128) is isOrtho, not magnitude — see packFlags/unpackFlags in
    // SphereEdges.js, which this mirrors exactly.
    float f = aPack.z;
    float dashPeriod = floor(mod(f, 256.0));
    float dashDuty   = floor(mod(f / 256.0, 256.0));
    float gByte      = floor(f / 65536.0);
    float isOrtho    = step(127.5, gByte);
    float glow       = mod(gByte, 128.0) / 8.0;

    float p = aPack.x;
    vAlpha = vec3(floor(mod(p, 256.0)),
                  floor(mod(p / 256.0, 256.0)),
                  floor(p / 65536.0)) / 255.0;

    float halfW = max(aPack.y, 0.0) * 0.5;

    // Pad for the antialiasing shoulder and for however far the glow reaches.
    // The quad is expanded along the segment as well as across it, because a
    // blur bleeds past a butt cap; the fragment shader puts the cap back.
    float pad = halfW + 1.0 + glow * uGlowReach;

    float along = mix(-pad, len + pad, position.x);
    float off   = position.y * pad;
    vec2 pos = a + dir * along + nrm * off;

    vC0 = aC0; vC1 = aC1; vC2 = aC2;
    vAlong = along;
    vD = off;
    vLen = len;
    vHalfW = halfW;
    vDash = vec2(dashPeriod, dashDuty);
    vGlow = glow;
    vIsOrtho = isOrtho;

    gl_Position = vec4(pos.x / uResolution.x * 2.0 - 1.0,
                       1.0 - pos.y / uResolution.y * 2.0,
                       0.0, 1.0);
  }
`;

const EDGE_FRAG = /* glsl */`
  precision highp float;

  // Time-based, not per-edge: orthoHue(now) is the same for every ortho edge
  // in a frame, so it travels once as a uniform rather than 1 of 16 floats
  // per instance. Set from SphereEdges.syncEdgeLayer.
  uniform float uOrthoHue;

  varying vec3  vC0;
  varying vec3  vC1;
  varying vec3  vC2;
  varying vec3  vAlpha;
  varying float vAlong;
  varying float vD;
  varying float vLen;
  varying float vHalfW;
  varying vec2  vDash;
  varying float vGlow;
  varying float vIsOrtho;

  // The CSS Color 4 reference algorithm, verbatim — the GLSL twin of
  // writeHsl() in SphereEdges.js. Used only for the ortho shadow colour,
  // whose saturation and lightness are compile-time constants (100%, 60%);
  // only the hue is dynamic.
  vec3 hsl2rgb(float h, float s, float l) {
    float a = s * min(l, 1.0 - l);
    vec3 k = mod(vec3(0.0, 8.0, 4.0) + h / 30.0, 12.0);
    return l - a * clamp(min(k - 3.0, 9.0 - k), -1.0, 1.0);
  }

  void main() {
    // Screen-space footprint of the two varyings, taken FIRST: derivatives are
    // undefined inside non-uniform control flow and there are three branches
    // below. length(vec2(dFdx, dFdy)) rather than fwidth() — fwidth is the L1
    // norm and overestimates a diagonal edge by up to 41%, which shows up as
    // uniformly fatter, brighter lines.
    float pxD = max(length(vec2(dFdx(vD), dFdy(vD))), 1e-6);
    float pxA = max(length(vec2(dFdx(vAlong), dFdy(vAlong))), 1e-6);

    float t = vLen > 1e-6 ? clamp(vAlong / vLen, 0.0, 1.0) : 0.0;

    // Three-stop gradient, interpolated NON-premultiplied exactly as a canvas
    // linear gradient does — the colour darkens toward the rim as it fades.
    vec3 col; float a;
    if (t < 0.5) { float u = t / 0.5;         col = mix(vC0, vC1, u); a = mix(vAlpha.x, vAlpha.y, u); }
    else         { float u = (t - 0.5) / 0.5; col = mix(vC1, vC2, u); a = mix(vAlpha.y, vAlpha.z, u); }

    // Box-filter coverage, not smoothstep. Edges are routinely thinner than a
    // pixel (width starts at 0.5) and a smoothstep shoulder spreads a 1px line
    // over 1.5px of ink — a systematic brightening the parity gate reads as a
    // one-sided bias. This form integrates to the true width at any scale.
    float side = clamp((vHalfW - abs(vD)) / pxD + 0.5, 0.0, 1.0);
    // Butt caps, matching ctx's default lineCap.
    float cap  = clamp(vAlong / pxA + 0.5, 0.0, 1.0)
               * clamp((vLen - vAlong) / pxA + 0.5, 0.0, 1.0);
    float core = side * cap;

    // Dash, in the same px units the canvas used, and on the CORE only: the
    // canvas dashed the stroke and then blurred it for the shadow, and a blur
    // of sigma 5 over an 8-on/4-off pattern is continuous.
    if (vDash.x > 0.0) core *= step(mod(t * vLen, vDash.x), vDash.y);

    // The shoulder standing in for ctx.shadowBlur. A canvas shadow is a real
    // gaussian of sigma = blur/2, so this is one too: exp(-d^2 / 2sigma^2) with
    // sigma = vGlow/2 is exp(-2 (d/vGlow)^2). The brief specified exp(-d/g),
    // and measured against a forced-glow capture that reads wrong — the canvas
    // halo is gone by ~1 blur radius while the exponential is still at 15% of
    // peak two radii out, so it shows as a wide flat veil instead of a halo.
    //
    // Distance is measured to the SEGMENT, not to its infinite line, so the
    // glow rounds off past the ends the way a blurred butt cap does. step()
    // rather than a branch keeps the divide defined when there is no glow.
    float dOut = max(0.0, max(-vAlong, vAlong - vLen));
    float dSeg = length(vec2(dOut, vD));
    float g = dSeg / max(vGlow, 1e-3);
    // AMPLITUDE, not a taste knob. Blurring a line of width w with sigma
    // leaves a peak of w / (sigma*sqrt(2pi)) of the original alpha; with
    // sigma = vGlow/2 that is 1.5958 * halfW / vGlow. At the 1px widths and
    // 6-14px blurs these edges actually use, that is ~7% — which is why the
    // canvas halo is invisible in a capture and a flat 0.5 was ~19x too
    // bright. min() covers the degenerate wide-line-tiny-blur case, where a
    // blur cannot raise the peak above the line's own alpha.
    //
    // shadowAlpha replaces the old flat uGlowK: it is ctx.shadowColor's own
    // alpha, derived per-instance instead of averaged into one constant.
    // Fused: fuseCos * 0.6, with fuseCos recovered from vGlow — fusedGlow()
    // is a bijective linear map of it, so no extra data is needed. Ortho:
    // always 1.0 (fully opaque), matching the original ctx.shadowColor.
    float fuseCos = clamp((vGlow - ${glslFloat(FUSED_GLOW_BASE)}) / ${glslFloat(FUSED_GLOW_SCALE)}, 0.0, 1.0);
    float shadowAlpha = mix(fuseCos * 0.6, 1.0, vIsOrtho);
    float peak = min(shadowAlpha * 1.5958 * vHalfW / max(vGlow, 1e-3), 1.0);
    float glow = peak * exp(-2.0 * g * g) * step(0.001, vGlow);

    // The shadow's colour, separately from the stroke's — the bug this
    // replaces used the t-varying gradient colour (col) for the glow too,
    // which is wrong even for the fused case (the canvas shadow was a FLAT
    // colour, not a gradient). Fused shadows are the mid stop (vC1 IS cMid
    // already, see edgeStops()); the ortho shadow is hue+30 at fixed S/L,
    // reconstructed here because it is the one colour that has no home in
    // the 16-float layout otherwise.
    vec3 shadowCol = mix(vC1, hsl2rgb(mod(uOrthoHue + ${glslFloat(ORTHO_HUE_STEP_GLOW)}, 360.0), 1.0, 0.6), vIsOrtho);

    // Composite the core OVER the glow (two distinct colours, two distinct
    // alphas) rather than blending one flat colour by a combined coverage —
    // that is what let the glow's colour bug hide in the old single-cov formula.
    float topA = a * core;
    float botA = glow;
    float outA = topA + botA * (1.0 - topA);
    if (outA <= 0.0) discard;
    vec3 outRGB = (col * topA + shadowCol * botA * (1.0 - topA)) / outA;

    gl_FragColor = vec4(outRGB, outA);
  }
`;

/**
 * Build the edge mesh. Imperative, like the backdrop it joins: nothing here
 * may enter r3f's scene graph.
 *
 * `sharedData`, when passed, becomes the buffer's OWN backing array — the
 * caller (SphereComposite, via `createEdgeState()`'s array) writes directly
 * into what the GPU reads, so `syncEdgeLayer` never has to copy ~1400 floats
 * a frame into a second, redundant buffer. Falls back to a private array so
 * the function stays usable standalone (tests, any future non-shared caller).
 */
export function createEdgeLayer(sharedData) {
  const data = sharedData ?? new Float32Array(MAX_EDGES * EDGE_STRIDE);

  const geometry = new THREE.InstancedBufferGeometry();
  // x = position along the segment (0 at A, 1 at B), y = side (-1 / +1).
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -1, 0,
    1, -1, 0,
    1,  1, 0,
    0,  1, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);

  const buffer = new THREE.InstancedInterleavedBuffer(data, EDGE_STRIDE, 1);
  buffer.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aEnds', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
  geometry.setAttribute('aC0',   new THREE.InterleavedBufferAttribute(buffer, 3, 4));
  geometry.setAttribute('aC1',   new THREE.InterleavedBufferAttribute(buffer, 3, 7));
  geometry.setAttribute('aC2',   new THREE.InterleavedBufferAttribute(buffer, 3, 10));
  geometry.setAttribute('aPack', new THREE.InterleavedBufferAttribute(buffer, 3, 13));
  geometry.instanceCount = 0;

  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGlowReach:  { value: GLOW_REACH },
    uOrthoHue:   { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    transparent: true,
    // Source-over, in the target's raw sRGB bytes. See the header.
    //
    // The ALPHA channel gets its own factor pair, and that is not decoration.
    // Since the trail commit the target holds premultiplied ink whose alpha is
    // read by the screen pass to decide how much of the rift clear shows
    // through. Without this, three leaves the alpha channel on the RGB factors
    // and the destination alpha accumulates as `a*a + dst*(1-a)` — coverage
    // squared, i.e. an edge that paints its colour correctly and then lets the
    // backdrop bleed back through itself.
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.visible = false;

  return {
    mesh, geometry, material, uniforms, buffer, data,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Sync this frame's edge state onto the mesh. Called from the backdrop pass,
 * before it renders, so the geometry can never be a frame behind the backdrop
 * it sits on.
 *
 * There is no copy here: `layer`'s buffer is built (in `createEdgeLayer`) to
 * share its backing array with `state.data` directly, so whatever the draw
 * loop wrote is already sitting in the GPU-bound buffer the instant it wrote
 * it. This function's job is only to tell WebGL a sub-range of it changed —
 * `addUpdateRange` + `needsUpdate` upload just the `count * EDGE_STRIDE`
 * floats actually written instead of the full `MAX_EDGES * EDGE_STRIDE` — and
 * to keep the mesh's visibility/instanceCount and per-frame uniforms current.
 *
 * A zero count sets `visible = false` rather than leaving one degenerate
 * instance to be rasterised.
 */
export function syncEdgeLayer(layer, state) {
  const count = Math.min(state?.count | 0, MAX_EDGES);
  layer.mesh.visible = count > 0;
  if (count === 0) { layer.geometry.instanceCount = 0; return; }
  layer.uniforms.uResolution.value.set(Math.max(state.w, 1), Math.max(state.h, 1));
  // orthoHue(now) is one value per frame, not per edge — see EDGE_FRAG.
  layer.uniforms.uOrthoHue.value = state.orthoHue ?? 0;

  layer.geometry.instanceCount = count;
  layer.buffer.addUpdateRange(0, count * EDGE_STRIDE);
  layer.buffer.needsUpdate = true;
}

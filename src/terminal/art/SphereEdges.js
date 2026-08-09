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
//   15     packed flags     dashPeriod + dashDuty*256 + round(glow*8)*65536
//
// Every packed field is an INTEGER. A float32 represents every integer below
// 2^24 exactly, and all the divisors used to unpack are powers of two, so the
// round trip is lossless — which is why the glow radius is carried in eighths
// of a pixel rather than as a fraction. The brief's `glow*65536` would have put
// a fractional field under two integer ones and leaked its low bits into the
// dash period.

import * as THREE from 'three';

/** Floats per edge instance. */
export const EDGE_STRIDE = 16;

/** Hard cap on edges uploaded in a frame. 31 core nodes give ~90 edges; the
 *  rest are spectral bridges, bone fusions and operator-forged links, all of
 *  which are handfuls. 1024 is 64KB of scratch and cannot be reached. */
export const MAX_EDGES = 1024;

/** How many glow radii the instance quad is padded by. exp(-d/g) * 0.5 drops
 *  below 1/255 at d = 4.85g, so five radii is where the glow provably ends. */
export const GLOW_REACH = 5.0;

/** Default shoulder coefficient for the glow stand-in. Tuned against the
 *  capture PNGs — see the step-4 task-3 report. */
export const GLOW_K = 0.5;

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
  return { count: 0, w: 1, h: 1, data: new Float32Array(MAX_EDGES * EDGE_STRIDE) };
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

/**
 * Dash pattern and glow radius into one float. `dashPeriod` is on+off and
 * `dashDuty` is on, both in px; a period of 0 means solid. The glow is
 * quantised to 1/8 px, which is 64 steps across the 6–14 px range the ortho
 * bridge breathes through — finer than the falloff can show.
 */
export function packFlags(dashPeriod, dashDuty, glow) {
  const p = Math.max(0, Math.min(255, Math.round(dashPeriod)));
  const d = Math.max(0, Math.min(255, Math.round(dashDuty)));
  const g = Math.max(0, Math.min(255, Math.round(glow * 8)));
  return p + d * 256 + g * 65536;
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

  void main() {
    vec2 a = aEnds.xy;
    vec2 b = aEnds.zw;
    vec2 delta = b - a;
    float len = length(delta);
    vec2 dir = len > 1e-6 ? delta / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    // Unpack. Every divisor is a power of two and every field an integer, so
    // these are exact for a float32 payload below 2^24.
    float f = aPack.z;
    float dashPeriod = floor(mod(f, 256.0));
    float dashDuty   = floor(mod(f / 256.0, 256.0));
    float glow       = floor(f / 65536.0) / 8.0;

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

    gl_Position = vec4(pos.x / uResolution.x * 2.0 - 1.0,
                       1.0 - pos.y / uResolution.y * 2.0,
                       0.0, 1.0);
  }
`;

const EDGE_FRAG = /* glsl */`
  precision highp float;

  uniform float uGlowK;

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

    // A soft shoulder standing in for ctx.shadowBlur. Distance is measured to
    // the SEGMENT, not to its infinite line, so the glow rounds off past the
    // ends the way a blurred butt cap does. step() rather than a branch keeps
    // the divide defined when there is no glow.
    float dOut = max(0.0, max(-vAlong, vAlong - vLen));
    float dSeg = length(vec2(dOut, vD));
    float glow = exp(-dSeg / max(vGlow, 1e-3)) * uGlowK * step(0.001, vGlow);

    float cov = clamp(core + glow * (1.0 - core), 0.0, 1.0);
    if (cov <= 0.0) discard;

    gl_FragColor = vec4(col, a * cov);
  }
`;

/**
 * Build the edge mesh. Imperative, like the backdrop it joins: nothing here
 * may enter r3f's scene graph.
 */
export function createEdgeLayer() {
  const data = new Float32Array(MAX_EDGES * EDGE_STRIDE);

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
    uGlowK:      { value: GLOW_K },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    transparent: true,
    // Source-over, in the target's raw sRGB bytes. See the header.
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
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
 * Copy this frame's edge state onto the mesh. Called from the backdrop pass,
 * before it renders, so the geometry can never be a frame behind the backdrop
 * it sits on.
 *
 * A zero count sets `visible = false` rather than leaving one degenerate
 * instance to be rasterised.
 */
export function syncEdgeLayer(layer, state) {
  const count = Math.min(state?.count | 0, MAX_EDGES);
  layer.mesh.visible = count > 0;
  if (count === 0) { layer.geometry.instanceCount = 0; return; }
  layer.uniforms.uResolution.value.set(Math.max(state.w, 1), Math.max(state.h, 1));

  // A plain loop, not set(subarray(...)): a subarray is a fresh view object
  // every frame, and this pass must not allocate. ~1400 floats at the real
  // edge count.
  const src = state.data, dst = layer.data;
  if (src !== dst) {
    const n = count * EDGE_STRIDE;
    for (let i = 0; i < n; i++) dst[i] = src[i];
  }
  layer.geometry.instanceCount = count;
  layer.buffer.needsUpdate = true;
}

// SphereBackground.jsx — the sphere's backdrop, on the GPU.
//
// Not a mesh. This module supplies the GLSL and the uniforms that
// SphereComposite's single composite pass uses to paint everything *beneath*
// the 2D canvas. Step 3 moves the bottom six layers of the sphere here one at
// a time; it starts as the clear colour alone, so the pipeline change and the
// layer migrations are never in the same commit.
//
// ── Why the backdrop had to move before any layer ──────────────────────────
//
// The 2D canvas was OPAQUE. Measured, not assumed: alpha 255 at every one of
// 126,440 sampled pixels, min = max = 255. Anything drawn under it is
// invisible, so migrating a layer while the canvas still cleared with an opaque
// fill would have produced a commit that deletes a layer and adds an
// unverifiable replacement — six of those, all lighting up at once when the
// clear finally changed. The plan ordered it the other way round; that was
// wrong.
//
// ── Why this is one pass and not two quads ─────────────────────────────────
//
// The obvious build — a backdrop mesh under a `transparent` 2D quad — is
// WRONG, and wrong in a way that passes a tolerance gate. The 2D canvas
// composites its trail fade in sRGB byte space. A GL alpha blend of a texture
// tagged SRGBColorSpace happens in three.js's LINEAR working space, because
// the sampler decodes first. Fading in linear space is systematically
// brighter: measured +1.0 mean over the whole frame with individual grid cells
// nearly doubling (25.5 -> 49.3), confined to the sphere disc. It still scored
// mean 1.285 against a threshold of 4.
//
// So the composite is done HERE, in sRGB, exactly as the canvas did it, and
// only the finished pixel is converted to linear for the bloom pipeline. When
// the canvas is opaque this reduces to `linear(C)`, which is precisely what
// the step-2 meshBasicMaterial wrote — so step 2 is a special case of this
// shader rather than a thing it has to imitate.
//
// A welcome side effect: with the composite done in-shader there is no
// blending state at all, so the premultipliedAlpha trap the spec warns about
// cannot arise here.

import * as THREE from 'three';

// sRGB <-> linear. `pow` of a negative base is undefined in GLSL, so the
// argument is kept strictly positive — c is in [0,1] and (c+0.055)/1.055 > 0.
export const COLOR_GLSL = /* glsl */`
  vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  }
`;

// ── Layer migration order ──────────────────────────────────────────────────
//
// Layers must move BOTTOM-UP in draw-loop order, not in the plan's "cheapest
// first" order. A layer migrated here renders beneath everything still in the
// 2D canvas, so moving a layer out of turn silently reorders it against the
// ones left behind. Draw-loop order is:
//
//   clear · exergy pulse · genesis glow · flash grid · spectral ambient ·
//   WIREFRAME GHOST · beat pulse · ghost trails
//
// The wireframe is migrated first anyway, out of that order, for one reason:
// it is the only background layer drawn unconditionally on every frame, so it
// is the only one the capture set can actually see. The four beneath it are
// either event-gated (flash grid), bus-gated (exergy pulse, at rate 0 in
// capture), immersive-only (spectral ambient) or settled (genesis glow) — a
// commit migrating those proves nothing except "no regression". Reordering the
// wireframe against four faint-or-inactive layers is a measurable risk, and
// the gate measures it. The rest go bottom-up.

import {
  WIRE_ALPHA, WIRE_WIDTH,
  BEAT_CORE_RGB, BEAT_MID_RGB, BEAT_MID_STOP,
  BEAT_CORE_ALPHA, BEAT_MID_ALPHA, BEAT_INNER_R, BEAT_BASE_R, BEAT_SWELL_R,
  EXERGY_RGB, EXERGY_R,
  GENESIS_CORE_RGB, GENESIS_MID_RGB, GENESIS_MID_STOP, GENESIS_MID_SCALE,
  FLASH_RGB, FLASH_WIDTH, FLASH_GRID_STEP, FLASH_ROW_K,
} from './artBackground';

const v3 = ([r, g, b]) => `vec3(${(r / 255).toFixed(6)}, ${(g / 255).toFixed(6)}, ${(b / 255).toFixed(6)})`;

// The backdrop, in sRGB. Layers are added here one commit at a time.
export const BACKGROUND_GLSL = /* glsl */`
  uniform vec3 uRift;      // clear colour, already /255
  uniform float uSphereR;  // CSS px
  uniform vec2 uRot;       // rotation rx, ry
  uniform float uBeat;     // beat phase, 1 = just fired
  uniform float uExergy;   // exergy pulse centre alpha, 0 = off
  uniform vec2 uGenesis;   // genesis glow: x = centre alpha (0 = off), y = radius px
  uniform float uFlash;    // flash grid stroke alpha, 0 = off

  // A two-stop canvas gradient: colour C at the centre fading to transparent
  // BLACK at the rim. The colour darkens on the way out as well as fading,
  // because canvas interpolates non-premultiplied rgba.
  vec4 radialTwoStop(float t, vec3 c, float a0) {
    return vec4(mix(c, vec3(0.0), t), mix(a0, 0.0, t));
  }

  // Signed distance to a regular hexagon with FLAT top and bottom at y = +/-r
  // (iq). The flash grid's hexagons are pointy-top — vertices at +/-30, +/-90,
  // +/-150 degrees — so the call site swaps the axes rather than rotating.
  float sdHexagon(vec2 p, float r) {
    const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
    p = abs(p);
    p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
    p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
    return length(p) * sign(p.y);
  }

  // Coverage of the flash hex grid at a point in CANVAS coordinates (origin
  // top-left), which is where the 2D loop laid it out. This is the one layer
  // that is not centre-symmetric, so the GL/canvas y flip has to be undone
  // explicitly — laying it out from the centre would mirror the row parity
  // and shift every odd row by half a cell.
  float flashGrid(vec2 cpos, vec2 res) {
    float gstep = float(${FLASH_GRID_STEP});
    float rowStep = gstep * float(${FLASH_ROW_K});
    float apo = gstep * 0.5 * 0.866025404;   // apothem = circumradius * cos(30)

    // Nearest 3x3 neighbourhood of cells. Derivatives are taken OUTSIDE the
    // loop: fwidth() inside non-uniform control flow is undefined.
    float best = 1e9;
    int r0 = int(floor(cpos.y / rowStep));
    for (int dr = -1; dr <= 1; dr++) {
      int row = r0 + dr;
      float gy = float(row) * rowStep;
      float offset = mod(float(row), 2.0) * gstep * 0.5;
      int c0 = int(floor((cpos.x - offset) / gstep + 0.5));
      for (int dc = -1; dc <= 1; dc++) {
        int col = c0 + dc;
        float gx = offset + float(col) * gstep;
        // The draw loop only emits centres with 0 <= gy < h and gx < w,
        // starting from gx = offset. Hexagons on the top row are half off
        // the canvas; that is faithful, not a bug.
        bool live = (row >= 0) && (gy < res.y) && (col >= 0) && (gx < res.x);
        vec2 q = cpos - vec2(gx, gy);
        float d = abs(sdHexagon(vec2(q.y, q.x), apo));
        best = min(best, live ? d : 1e9);
      }
    }

    float hw = float(${FLASH_WIDTH}) * 0.5;
    float aa = max(fwidth(best), 1e-4);
    return 1.0 - smoothstep(hw - aa, hw + aa, best);
  }

  // A canvas radial gradient interpolates NON-premultiplied rgba linearly
  // between adjacent stops, so the colour darkens toward black as it fades
  // rather than just losing alpha. Reproducing that literally, because
  // interpolating premultiplied instead is the classic way to make a gradient
  // that is subtly, unfixably wrong.
  vec4 beatGradient(float t) {
    vec3 amber = ${v3(BEAT_CORE_RGB)};
    vec3 orange = ${v3(BEAT_MID_RGB)};
    float mid = float(${BEAT_MID_STOP});
    if (t < mid) {
      float u = t / mid;
      return vec4(mix(amber, orange, u),
                  mix(float(${BEAT_CORE_ALPHA}), float(${BEAT_MID_ALPHA}), u));
    }
    float u = (t - mid) / (1.0 - mid);
    return vec4(mix(orange, vec3(0.0), u), mix(float(${BEAT_MID_ALPHA}), 0.0, u));
  }

  // Approximate signed distance to an ellipse OUTLINE, in pixels. The exact
  // solution needs a quartic root; this is the standard gradient-normalised
  // approximation, and it is accurate to well under a pixel for the near-
  // circular ellipses here. Radii are clamped away from zero because both
  // collapse to a line when their axis faces the camera.
  float ellipseCoverage(vec2 p, vec2 r, float halfW) {
    vec2 rr = max(r, vec2(0.5));
    vec2 q = p / rr;
    float k = length(q);
    vec2 g = vec2(q.x / rr.x, q.y / rr.y) / max(k, 1e-6);
    float d = (k - 1.0) / max(length(g), 1e-6);
    float aa = max(fwidth(d), 1e-4);
    return 1.0 - smoothstep(halfW - aa, halfW + aa, abs(d));
  }

  vec3 sphereBackground(vec2 uv, vec2 res) {
    vec3 col = uRift;
    vec2 p = (uv - 0.5) * res;   // CSS px from centre; every layer here is
                                 // radially symmetric about the centre or a
                                 // full-screen grid, so the GL/canvas y flip
                                 // cancels and no flip is applied.
    float d = length(p);

    // ── Exergy pulse — ecocide bus, magenta breath from the centre ────────
    if (uExergy > 0.0) {
      float t = clamp(d / (min(res.x, res.y) * float(${EXERGY_R})), 0.0, 1.0);
      vec4 g = radialTwoStop(t, ${v3(EXERGY_RGB)}, uExergy);
      col = mix(col, g.rgb, g.a);
    }

    // ── Genesis glow — awakening phase 0, gold into magenta ───────────────
    if (uGenesis.x > 0.0) {
      float t = clamp(d / max(uGenesis.y, 1e-6), 0.0, 1.0);
      float mid = float(${GENESIS_MID_STOP});
      vec3 gold = ${v3(GENESIS_CORE_RGB)};
      vec3 magenta = ${v3(GENESIS_MID_RGB)};
      float aMid = uGenesis.x * float(${GENESIS_MID_SCALE});
      vec4 g;
      if (t < mid) {
        float u = t / mid;
        g = vec4(mix(gold, magenta, u), mix(uGenesis.x, aMid, u));
      } else {
        g = radialTwoStop((t - mid) / (1.0 - mid), magenta, aMid);
      }
      col = mix(col, g.rgb, g.a);
    }

    // ── State flash — anthracite hex grid on bifurcation events ───────────
    if (uFlash > 0.0) {
      vec2 cpos = vec2(p.x + res.x * 0.5, res.y * 0.5 - p.y);   // canvas coords
      col = mix(col, ${v3(FLASH_RGB)}, flashGrid(cpos, res) * uFlash);
    }

    // ── Sphere wireframe ghost — equator + vertical great circle ──────────
    // Two separate strokes in the 2D loop, so they composite source-over one
    // after the other rather than additively. It only matters where they
    // cross, and only in the 4th decimal, but adding them would be a guess
    // where copying is free.
    float hw = float(${WIRE_WIDTH}) * 0.5;
    vec2 eq = vec2(uSphereR, uSphereR * abs(cos(uRot.x)));
    vec2 vt = vec2(uSphereR * abs(cos(uRot.y)), uSphereR);
    col = mix(col, vec3(1.0), ellipseCoverage(p, eq, hw) * float(${WIRE_ALPHA}));
    col = mix(col, vec3(1.0), ellipseCoverage(p, vt, hw) * float(${WIRE_ALPHA}));

    // ── Ambient beat pulse glow — above the wireframe in the draw loop ────
    if (uBeat > 0.0) {
      float r0 = uSphereR * float(${BEAT_INNER_R});
      float r1 = uSphereR * (float(${BEAT_BASE_R}) + uBeat * float(${BEAT_SWELL_R}));
      // Canvas clamps to the first stop inside r0 and the last stop beyond r1.
      float t = clamp((length(p) - r0) / max(r1 - r0, 1e-6), 0.0, 1.0);
      vec4 g = beatGradient(t);
      col = mix(col, g.rgb, g.a * uBeat);   // alpha stops scale with the phase
    }

    return col;
  }
`;

export function backgroundUniforms() {
  return {
    uRift: { value: new THREE.Vector3(0, 0, 0) },
    uSphereR: { value: 0 },
    uRot: { value: new THREE.Vector2(0, 0) },
    uBeat: { value: 0 },
    uExergy: { value: 0 },
    uGenesis: { value: new THREE.Vector2(0, 0) },
    uFlash: { value: 0 },
  };
}

/** Copy a frame's published background state into the shader's uniforms.
 *
 *  The rift channel is an sRGB 0-255 level lifted straight from the 2D
 *  fillStyle it replaces, and the composite runs in sRGB, so it is passed
 *  through as a plain vector. Using THREE.Color here would invite a
 *  colour-space conversion and silently brighten the tint — the same class of
 *  bug as the one that made this a single pass.
 */
export function syncBackgroundUniforms(uniforms, state) {
  if (!state) return;
  const rift = state.rift;
  if (rift) uniforms.uRift.value.set(rift.r / 255, rift.g / 255, rift.b / 255);
  uniforms.uSphereR.value = state.sphereR ?? 0;
  if (state.rot) uniforms.uRot.value.set(state.rot.rx, state.rot.ry);
  uniforms.uBeat.value = state.beat ?? 0;
  uniforms.uExergy.value = state.exergy ?? 0;
  const gen = state.genesis;
  uniforms.uGenesis.value.set(gen ? gen.alpha : 0, gen ? gen.radius : 0);
  uniforms.uFlash.value = state.flash ?? 0;
}

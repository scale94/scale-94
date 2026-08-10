// SphereTrail.js — the ping-pong accumulator that gives the GL layers back the
// trail the 2D canvas never lost.
//
// ── What this is compensating for ──────────────────────────────────────────
//
// ArtTab's draw loop does not wipe its canvas between frames. It clears with
// `destination-out` and `rgba(0,0,0,m)`, which MULTIPLIES existing alpha by
// (1 - m) instead of zeroing it, and then draws source-over on the survivors.
// A layer redrawn every frame therefore settles well above the alpha it is
// drawn with — `1/m` times above it in the small-alpha limit, which is 1.389x
// in normal mode and 3.125x in immersive, the exhibit mode. See artTrail.js for
// the arithmetic and .superpowers/sdd/trail-deficit.md for the measurement.
//
// A layer that moves to the GPU draws into a render target that IS fully
// rewritten each frame, so it loses that gain silently — no error, no missing
// geometry, just less light. This module supplies the missing half of the 2D
// clear: a target whose previous contents are FADED rather than cleared, so
// whatever is drawn on top of it compounds exactly as it did on the canvas.
//
// ── Why two targets and not one ────────────────────────────────────────────
//
// A fragment shader may not sample the target it is writing to; the result is
// undefined and on some drivers it is the previous frame, on others garbage.
// So the fade reads target A and writes target B, and the pair swaps roles
// every frame. Everything drawn after the fade lands on B as well, and next
// frame B becomes the thing that is read.
//
// ── The colour space, which is the whole risk here ─────────────────────────
//
// BOTH targets are RGBA8 / UnsignedByte / NoColorSpace, and that is
// load-bearing. Tagging either one SRGBColorSpace gives it an SRGB8_ALPHA8
// internal format, so the hardware encodes on write and the sampler decodes on
// read — and the accumulation would then compound in three's LINEAR working
// space while the 2D canvas it is imitating faded in sRGB BYTE space. That is
// the exact bug step 3 spent a rewrite fixing: it measured systematically
// brighter, with individual grid cells nearly doubling, and it still scored
// 1.285 against a parity threshold of 4. Here it would be strictly worse than
// there, because a feedback loop compounds the error every frame instead of
// committing it once.
//
// So: no conversion anywhere in this chain. The single srgbToLinear stays where
// it is, in SphereComposite's screen pass, on the finished pixel.

import * as THREE from 'three';

// The clip-space fullscreen quad convention three uses for its own passes, and
// the same one createBackdrop uses, so `vUv` addresses the same texel in the
// fade as in every other pass in this pipeline.
const TRAIL_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TRAIL_FADE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uPrev;
  uniform float uSurvival;    // 1 - m; 0 makes this a wipe
  varying vec2 vUv;
  void main() {
    // Raw sRGB values in, raw sRGB values out. The 2D canvas faded in byte
    // space and so does this. Converting here is the step-3 trap.
    vec4 prev = texture2D(uPrev, vUv);
    gl_FragColor = vec4(prev.rgb, prev.a) * uSurvival;
  }
`;

/** One accumulation buffer. Matches the backdrop target's settings exactly —
 *  RGBA8, no mipmaps, no depth, no stencil, NoColorSpace — because the two are
 *  links in the same chain and any difference between them is a conversion. */
function createTarget() {
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,      // no mipmaps: sampled 1:1
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  });
  // NOT SRGBColorSpace. See the header — this is the one line that can turn
  // this module into a brightening feedback loop that passes the gate.
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt;
}

/**
 * Build the accumulator. Imperative, like the backdrop it feeds: NOTHING here
 * may enter r3f's scene graph, because everything in that graph is drawn to the
 * SCREEN by the EffectComposer — a fade quad in the tree would fade the target
 * *and* be painted over the composite.
 *
 * `read` and `write` are getters over the pair rather than fields, so callers
 * cannot hold a stale one across a swap. `write.texture` in particular must be
 * re-read every frame by whoever samples the accumulator; it alternates.
 */
export function createTrail() {
  const targets = [createTarget(), createTarget()];
  // Index of the target currently being READ. swap() flips it, so calling
  // swap() at the top of a frame makes last frame's write this frame's read.
  let index = 0;

  const fadeUniforms = {
    uPrev: { value: null },
    uSurvival: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: fadeUniforms,
    vertexShader: TRAIL_VERT,
    fragmentShader: TRAIL_FADE_FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    // REPLACES the destination, does not blend with it. The fade is the clear:
    // it covers every texel of the target, which is why the caller can render
    // it with autoClear off and let it stand in for the wipe.
    blending: THREE.NoBlending,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const fadeMesh = new THREE.Mesh(geometry, material);
  fadeMesh.frustumCulled = false;

  const scene = new THREE.Scene();
  scene.add(fadeMesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    targets, fadeMesh, fadeUniforms, scene, camera,
    get read() { return targets[index]; },
    get write() { return targets[index ^ 1]; },
    swap() { index ^= 1; },

    /** Reconcile both targets against the drawing buffer. `setSize` mutates the
     *  target in place — it never replaces the texture object — and early-exits
     *  when the dimensions already match, so this costs four integer compares
     *  in the steady state and is safe to call every frame. */
    setSize(w, h) {
      for (const rt of targets) {
        if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      }
    },

    dispose() {
      geometry.dispose();
      material.dispose();
      targets[0].dispose();
      targets[1].dispose();
    },
  };
}

/**
 * Fade last frame's accumulation into this frame's target.
 *
 * Leaves `write` BOUND: everything the caller draws next lands on top of the
 * faded result, which is the entire point. The caller must have autoClear off
 * for that to survive — this pass covers the whole target itself, so nothing is
 * lost by turning the clear off around it.
 *
 * `survival` is `trailSurvival(m)` — 0 makes this a wipe and the accumulator a
 * pass-through.
 */
export function renderTrailFade(gl, trail, survival) {
  trail.fadeUniforms.uPrev.value = trail.read.texture;
  trail.fadeUniforms.uSurvival.value = survival;
  gl.setRenderTarget(trail.write);
  gl.render(trail.scene, trail.camera);
}

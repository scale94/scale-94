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

// The backdrop, in sRGB. Layers are added here one commit at a time.
export const BACKGROUND_GLSL = /* glsl */`
  uniform vec3 uRift;   // clear colour, already /255

  vec3 sphereBackground(vec2 uv, vec2 res) {
    return uRift;
  }
`;

export function backgroundUniforms() {
  return { uRift: { value: new THREE.Vector3(0, 0, 0) } };
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
  const rift = state?.rift;
  if (rift) uniforms.uRift.value.set(rift.r / 255, rift.g / 255, rift.b / 255);
}

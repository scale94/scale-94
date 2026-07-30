// particleShader.js — pass 2. 4096 stateless particles as gl.POINTS.
//
// Every trajectory is a closed-form function of (aSeed, uPhaseT). Nothing is
// stored between frames, nothing is allocated, and replaying a collision is
// uPhaseT = 0. That is also what makes the parity snapshot possible.

export const MAX_POINT_SIZE = 64;

export const PARTICLE_UNIFORMS = [
  'uRes',    // vec2  canvas size in CSS px
  'uPhase',  // float PHASE_ID
  'uPhaseT', // float seconds in phase
  'uHue',    // vec2  hueA, hueB
  'uEase',   // float easeInCubic of the accelerating progress
  'uGates',  // vec4  sparkGate, jetGate, chimeraGate, vaporGate
  'uPx',     // float device pixels per CSS pixel
];

export const PARTICLE_VS = `#version 300 es
layout(location = 0) in vec4 aSeed; // lane[-1,1), birthPhase, hash1, hash2

uniform vec2  uRes;
uniform float uPhase;
uniform float uPhaseT;
uniform vec2  uHue;
uniform float uEase;
uniform vec4  uGates;
uniform float uPx;

out vec3  vCol;
out float vAlpha;

const float TAU = 6.28318530718;

// ES 3.00 requires a function to be declared before it is used, so this sits
// above main rather than below it.
vec3 hue2rgbLocal(float h) {
  vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
  return 1.0 - clamp(min(k, 4.0 - k), 0.0, 1.0);
}

// Curl of a cheap 2-octave sine field. Divergence-free by construction, so
// the streams swirl instead of piling up -- the "fluid deflection" the design
// asks for, at four sines a vertex.
vec2 curl(vec2 p) {
  float e = 0.35;
  float n0 = sin(p.x * 1.7 + p.y * 2.3) + 0.5 * sin(p.x * 3.9 - p.y * 1.1);
  float nx = sin((p.x + e) * 1.7 + p.y * 2.3) + 0.5 * sin((p.x + e) * 3.9 - p.y * 1.1);
  float ny = sin(p.x * 1.7 + (p.y + e) * 2.3) + 0.5 * sin(p.x * 3.9 - (p.y + e) * 1.1);
  return vec2(ny - n0, -(nx - n0)) / e;
}

void main() {
  float lane  = aSeed.x;
  float birth = aSeed.y;
  float h1    = aSeed.z;
  float h2    = aSeed.w;

  float side  = h2 < 0.5 ? -1.0 : 1.0;   // which beam this particle rides
  vec2  c     = uRes * 0.5;
  vec2  pos   = c;
  float size  = 3.0;
  float alpha = 0.0;
  vec3  col   = hue2rgbLocal(side < 0.0 ? uHue.x : uHue.y);

  if (uPhase <= 1.0) {
    // idle / selecting — sparse ambient drift along the beam axis
    float s = fract(birth + uPhaseT * 0.06);
    pos = vec2(mix(0.0, uRes.x, s), c.y + lane * 12.0 + sin(uPhaseT * 0.7 + h1 * TAU) * 3.0);
    alpha = step(0.94, h1) * 0.35;
    size = 2.0;

  } else if (uPhase == 2.0) {
    // accelerating — helical tightening plus curl turbulence
    float speed = 0.35 + 0.45 * h1 + uEase * 1.6;
    float s = fract(birth + uPhaseT * speed);          // 0 at the wall, 1 at the core
    float x = side < 0.0 ? mix(0.0, c.x, s) : mix(uRes.x, c.x, s);

    float twist  = 5.5 + 4.0 * h1;
    float theta  = s * twist + h1 * TAU;
    float radius = (18.0 + 14.0 * abs(lane)) * pow(1.0 - s, 1.7);   // tightens inward
    vec2  helix  = vec2(cos(theta), sin(theta)) * radius;

    vec2 turb = curl(vec2(x * 0.012, (c.y + lane * 20.0) * 0.05) + uPhaseT * 0.35)
              * (2.0 + 9.0 * s * uEase);

    pos   = vec2(x + helix.x * 0.35 + turb.x, c.y + lane * 6.0 + helix.y + turb.y);
    // INGRESS: gl.POINTS are culled on their centre, so a sprite arriving at
    // x=0 would pop in at full size. Ramp alpha over the first 3% of travel.
    // The second term is the EGRESS side of the same problem: without it,
    // alpha is cut hard when fract() wraps at s -> 1, so sprites at full
    // alpha and full size vanish at the exact centre instead of fading out.
    alpha = smoothstep(0.0, 0.03, s) * smoothstep(1.0, 0.97, s) * (0.35 + 0.65 * uEase);
    size  = 2.0 + 3.0 * h1 + 3.0 * uEase;

  } else {
    // colliding / result — the same vertices, re-tasked by hash into four
    // populations. The role partition is FIXED by the seed; a gate only fades
    // its own population in and out. A gate in the branch CONDITION instead
    // would make a particle change population the moment its gate closed:
    // a spark at 700ms (spark gate shut, chimera gate open) fell through into
    // the chimera branch, teleporting ~45% of the buffer from a 360px radial
    // burst onto a 40px orbit ring in a single frame.
    float role = h2 * 2.0; // 0..2, uniform because h2 also chose the side
    if (role < 0.9) {
      // spark — radial burst with drag.
      // ang and v MUST come from different seed components. Driving both from
      // h1 puts every spark on a 1-D locus in the plane — a rosette of thin
      // arcs instead of a filled disc — however much you scramble one of them
      // (fract(h1 * 7.13) is still a function of h1). birth is unused in this
      // phase, so it is the free dimension.
      float ang = h1 * TAU;
      float v   = 60.0 + 300.0 * birth;
      float k   = 1.0 - exp(-uPhaseT * 2.4);
      pos   = c + vec2(cos(ang), sin(ang)) * v * k;
      alpha = max(0.0, 1.0 - uPhaseT * 1.5) * uGates.x;
      size  = 1.5 + 2.0 * h1;
      col   = hue2rgbLocal(h1 < 0.5 ? uHue.x : uHue.y);

    } else if (role < 1.1) {
      // orthogonal debris jet — the cross-shaped burst
      float dir = h1 < 0.5 ? -1.0 : 1.0;
      // v from birth, not h1: h1 already picked the direction, so drawing the
      // magnitude from it too makes one arm systematically longer than the other.
      float v   = 180.0 + 300.0 * birth;
      float k   = 1.0 - exp(-uPhaseT * 2.4);
      pos   = c + vec2(lane * 40.0 * k, dir * v * k);
      alpha = max(0.0, 1.0 - uPhaseT * 2.4) * uGates.y;
      size  = 1.5 + 2.0 * h1;

    } else if (role < 1.6) {
      // chimera — slow orbit at the blended hue. Same rule as the spark: rad
      // must not come from h1, or the orbit collapses to a single thin ring.
      float ang = uPhaseT * 1.2 + h1 * TAU;
      float rad = 15.0 + 25.0 * birth;
      pos   = c + vec2(cos(ang), sin(ang)) * rad;
      alpha = 0.5 * uGates.z;
      size  = 5.0 + 6.0 * h1;
      col   = hue2rgbLocal(mix(uHue.x, uHue.y, 0.5));

    } else {
      // vapor — sillage. Rises, drifts, thins. Both passes put +Y up
      // (pos.y = 0 maps to clip -1), so age must ADD to y; the Canvas2D
      // original rose under canvas y-down and the sign was never flipped.
      float age = fract(h1 + uPhaseT * 0.35);
      pos   = c + vec2((lane * 25.0) + sin(age * 4.0 + h1 * TAU) * 8.0, age * 90.0 - 10.0);
      alpha = (1.0 - age) * 0.4 * uGates.w;
      size  = 6.0 + 10.0 * age;
      col   = hue2rgbLocal(0.111); // amber, the olfactory layer
    }
  }

  vCol   = col;
  vAlpha = alpha;
  // size is authored in CSS px like every other length here, but
  // gl_PointSize is in FRAMEBUFFER px — so it must be scaled by the DPR or
  // the whole particle layer renders 1/DPR too small on a HiDPI display.
  // The clamp is applied after scaling, in device px, which is the unit the
  // ANGLE large-point limit is actually expressed in.
  gl_PointSize = clamp(size * uPx, 1.0, ${MAX_POINT_SIZE}.0);
  gl_Position = vec4((pos / uRes) * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const PARTICLE_FS = `#version 300 es
precision highp float;

in vec3  vCol;
in float vAlpha;
out vec4 fragColor;

void main() {
  // Soft radial sprite. Additive blending sums these, so dense convergence
  // blows the core out to white on its own -- this is the bloom (spec 5.2).
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, d));
  a *= a * vAlpha;
  fragColor = vec4(vCol * a, a);
}
`;

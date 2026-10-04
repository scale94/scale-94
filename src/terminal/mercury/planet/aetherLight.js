// src/terminal/mercury/planet/aetherLight.js — the element flows as sunlit matter (aether spec §1).
//
// Water (mist) scatters forward, earth (regolith dust) backward with an opposition surge, air (gas) is
// Rayleigh-symmetric; fire makes its own light and is never passed through here. Every lit flow goes dark
// in the planet's shadow — a cylinder of the planet's radius running anti-sunward from its centre — with a
// soft penumbra, and never below a floor. Phase functions are normalised at the camera's own scattering
// angle, so a particle near the centre keeps today's look; the model only redistributes around it.
// GLSL mirrors the JS exactly (the planetWindow.js pattern); the JS feeds the tests and the mirror lobes.

import { glf } from '../../gl/glf';
import { SUN_DIR_WORLD } from './planetFrame';

export const AETHER_ELEMENT_LIGHT = Object.freeze({
  fluid: Object.freeze({ g: 0.6, surge: 0, ray: 0 }),   // mist: forward Henyey–Greenstein
  earth: Object.freeze({ g: -0.3, surge: 0.35, ray: 0 }), // dust: backward HG + opposition surge
  air: Object.freeze({ g: 0, surge: 0, ray: 1 }),       // gas: Rayleigh (1 + cos²)
});
export const LIT_MAX = 2.5;
export const SURGE_W = 0.08; // opposition-surge width in (1 + cos θ)
export const COS_REF = -SUN_DIR_WORLD[2]; // camera on +Z: cos θ = dot(−sun, +Z)

// cos θ: θ is the scattering angle between the incoming sunlight (−sun) and the way to the viewer.
export function litPhase({ g, surge, ray }, c) {
  const hg = (1 - g * g) / Math.max(1 + g * g - 2 * g * c, 1e-4) ** 1.5;
  const rayleigh = 0.75 * (1 + c * c);
  return hg + (rayleigh - hg) * ray + surge * Math.exp(-(1 + c) / SURGE_W);
}
export const litRef = (element) => litPhase(AETHER_ELEMENT_LIGHT[element], COS_REF);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function shadowFactor(rel, sun, R, pen) {
  const along = -dot(rel, sun); // > 0: anti-sunward of the centre
  if (along <= 0) return 1;
  const px = rel[0] + along * sun[0], py = rel[1] + along * sun[1], pz = rel[2] + along * sun[2];
  return smoothstep(R - pen, R + pen, Math.hypot(px, py, pz));
}

export function aetherLightAt(element, p, viewer, { floor, pen, R, sun = SUN_DIR_WORLD }) {
  const params = AETHER_ELEMENT_LIGHT[element];
  if (!params) return 1; // fire, or anything not lit
  const vx = viewer[0] - p[0], vy = viewer[1] - p[1], vz = viewer[2] - p[2];
  const vl = Math.hypot(vx, vy, vz) || 1;
  const c = -(sun[0] * vx + sun[1] * vy + sun[2] * vz) / vl;
  const ph = Math.min(LIT_MAX, litPhase(params, c) / litRef(element));
  return floor + (1 - floor) * shadowFactor(p, sun, R, pen) * ph;
}

export const AETHER_SHADOW_GLSL = /* glsl */ `
float aetherShadow(vec3 rel, vec3 s, float R, float pen) {
  float along = -dot(rel, s);
  if (along <= 0.0) return 1.0;
  float radial = length(rel + along * s);
  return smoothstep(R - pen, R + pen, radial);
}
`;

// Needs uViewportPx (declared by PLANET_WINDOW_VS, which every flow includes first).
export const AETHER_LIGHT_VS = /* glsl */ `
varying vec3 vLitC;
varying float vLitDiam;
void aetherLightVS(vec3 mv, float pointSizePx) {
  vLitC = mv;
  vLitDiam = pointSizePx * 2.0 * (-mv.z) / (projectionMatrix[1][1] * uViewportPx.y);
}
`;

// Per FRAGMENT, not per sprite: a sprite can be wider than the planet, so the shadow edge must cross it.
export function aetherLightFS(element) {
  const p = AETHER_ELEMENT_LIGHT[element];
  if (!p) throw new Error(`aetherLightFS: '${element}' is emissive or unknown`);
  return /* glsl */ `
uniform vec3 uSunDirW;
uniform float uLitFloor;
uniform float uLitPen;
uniform float uPlanetRadius;
varying vec3 vLitC;
varying float vLitDiam;
const float LIT_G = ${glf(p.g)};
const float LIT_SURGE = ${glf(p.surge)};
const float LIT_RAY = ${glf(p.ray)};
const float LIT_REF = ${glf(litRef(element))};
const float LIT_MAX = ${glf(LIT_MAX)};
const float SURGE_W = ${glf(SURGE_W)};
${AETHER_SHADOW_GLSL}
float litPhase(float c) {
  float hg = (1.0 - LIT_G * LIT_G) / pow(max(1.0 + LIT_G * LIT_G - 2.0 * LIT_G * c, 1e-4), 1.5);
  float rayleigh = 0.75 * (1.0 + c * c);
  return mix(hg, rayleigh, LIT_RAY) + LIT_SURGE * exp(-(1.0 + c) / SURGE_W);
}
float aetherLight() {
  vec2 o = (gl_PointCoord - 0.5) * vLitDiam;
  vec3 p = vLitC + vec3(o.x, -o.y, 0.0);
  vec3 s = normalize((viewMatrix * vec4(uSunDirW, 0.0)).xyz);
  vec3 c = (viewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float sh = aetherShadow(p - c, s, uPlanetRadius, uLitPen);
  float ph = min(LIT_MAX, litPhase(dot(-s, normalize(-p))) / LIT_REF);
  return uLitFloor + (1.0 - uLitFloor) * sh * ph;
}
`;
}

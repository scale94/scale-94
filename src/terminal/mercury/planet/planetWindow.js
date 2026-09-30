// planetWindow.js — clears aether particles that sit between the camera and
// the planet's face, so the flows read as a halo, not fog over the surface.
// Geometric on purpose: opacity alone can never empty overlapping sprites
// (mercuryTuning.js). Behind-the-planet particles are left to the depth test
// (MercuryPlanet writes gl_FragDepth). planetWindowJS mirrors it for tests.

const EDGE_IN = 0.92;   // × radius: fully cleared inside this
const EDGE_OUT = 1.12;  // × radius: untouched beyond this (+ up to EDGE_JITTER)
const EDGE_JITTER = 0.18;

export const PLANET_WINDOW_GLSL = /* glsl */ `
uniform float uPlanetWindow;
uniform float uPlanetRadius;
float planetWindow(vec3 mv) {
  if (uPlanetWindow <= 0.0) return 1.0;
  vec3 c = (viewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float cl = length(c);
  vec3 ch = c / cl;
  float along = dot(mv, ch);
  if (along <= 0.0 || along >= cl) return 1.0;
  float lateral = length(mv - ch * along) * cl / along;
  float n = fract(sin(dot(mv, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float edge = uPlanetRadius * (${EDGE_OUT.toFixed(2)} + ${EDGE_JITTER.toFixed(2)} * n);
  return mix(1.0, smoothstep(uPlanetRadius * ${EDGE_IN.toFixed(2)}, edge, lateral), uPlanetWindow);
}
`;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Deterministic mirror (jitter fixed at its maximum so tests are exact).
export function planetWindowJS(mv, c, radius, strength) {
  if (strength <= 0) return 1;
  const cl = Math.hypot(...c);
  const ch = c.map((x) => x / cl);
  const along = mv[0] * ch[0] + mv[1] * ch[1] + mv[2] * ch[2];
  if (along <= 0 || along >= cl) return 1;
  const lat = Math.hypot(...mv.map((x, i) => x - ch[i] * along)) * cl / along;
  const w = smoothstep(radius * EDGE_IN, radius * (EDGE_OUT + EDGE_JITTER), lat);
  return 1 + (w - 1) * strength;
}

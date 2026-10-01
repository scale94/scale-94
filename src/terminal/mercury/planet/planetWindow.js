// planetWindow.js — clears aether particles that sit between the camera and
// the planet's face, so the flows read as a halo, not fog over the surface.
// Per FRAGMENT, not per particle: the sprites are large (often wider than the
// planet), so a test on the sprite centre either leaves fog over the limb or
// cuts a clear ring around it. Each sprite's vertex stage projects the planet's
// disc into window pixels; each fragment of a particle in front of the planet
// fades out exactly at the disc's edge. Behind-the-planet particles are left
// to the depth test (MercuryPlanet writes gl_FragDepth). JS mirrors are for tests.

export const PLANET_WINDOW_EDGE_PX = 1.5; // antialiased limb, in drawing-buffer pixels

export const PLANET_WINDOW_VS = /* glsl */ `
uniform float uPlanetWindow;
uniform float uPlanetRadius;
uniform vec2 uViewportPx;
varying vec3 vPlanetPx;
varying float vPlanetFront;
void planetWindowVS(vec3 mv) {
  vec3 c = (viewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float cl = length(c);
  float along = dot(mv, c / cl);
  vPlanetFront = (along > 0.0 && along < cl) ? 1.0 : 0.0;
  vec4 cc = projectionMatrix * vec4(c, 1.0);
  vec2 centre = (cc.xy / cc.w * 0.5 + 0.5) * uViewportPx;
  float tanR = uPlanetRadius / sqrt(max(cl * cl - uPlanetRadius * uPlanetRadius, 1e-6));
  vPlanetPx = vec3(centre, tanR * projectionMatrix[1][1] * 0.5 * uViewportPx.y);
}
`;

export const PLANET_WINDOW_FS = /* glsl */ `
uniform float uPlanetWindow;
varying vec3 vPlanetPx;
varying float vPlanetFront;
float planetWindow() {
  float d = length(gl_FragCoord.xy - vPlanetPx.xy);
  float clear = smoothstep(vPlanetPx.z - ${PLANET_WINDOW_EDGE_PX.toFixed(1)}, vPlanetPx.z + ${PLANET_WINDOW_EDGE_PX.toFixed(1)}, d);
  return mix(1.0, mix(1.0, clear, vPlanetFront), uPlanetWindow);
}
`;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The planet's silhouette radius in drawing-buffer pixels (mirrors planetWindowVS).
export function planetDiscRadiusPx(centreDist, radius, p11, viewportH) {
  const tanR = radius / Math.sqrt(Math.max(centreDist * centreDist - radius * radius, 1e-6));
  return tanR * p11 * 0.5 * viewportH;
}

// One fragment's window factor (mirrors planetWindow()).
export function planetWindowFragJS(fragPx, discPx, front, strength) {
  const d = Math.hypot(fragPx[0] - discPx[0], fragPx[1] - discPx[1]);
  const clear = smoothstep(discPx[2] - PLANET_WINDOW_EDGE_PX, discPx[2] + PLANET_WINDOW_EDGE_PX, d);
  const f = front ? clear : 1;
  return 1 + (f - 1) * strength;
}

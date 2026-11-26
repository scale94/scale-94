// moonShader.js — GLSL sources.
//
// Two passes:
//   BAKE_FS  — runs once at mount into an offscreen texture. Produces an
//              equirectangular selenographic map: tangent-space normal (RG),
//              albedo (B), mare fraction (A).
//   MOON_FS  — runs every frame. Samples the baked texture and projects it
//              onto the visible disc.

export const QUAD_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vScreen;
void main() {
  vScreen = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Shared GLSL: hashes, value noise, fbm. Prepended to both fragment shaders.
const NOISE_GLSL = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
  return vec2(hash21(p), hash21(p + 19.19));
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, int octaves) {
  float v = 0.0, amp = 1.0, total = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += vnoise(p) * amp;
    total += amp;
    amp *= 0.5;
    p *= 2.1;
  }
  return v / total;
}`;

export const BAKE_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
out vec4 fragColor;

const float PI = 3.14159265359;
${NOISE_GLSL}

// lat, lon, radius, depth -- ported from LunarCanvasMoon's MARE_BASINS.
const int N_MARE = 9;
const vec4 MARE[9] = vec4[9](
  vec4( 0.15, -0.30, 0.25, 0.35),
  vec4( 0.12,  0.20, 0.18, 0.30),
  vec4(-0.05,  0.35, 0.20, 0.28),
  vec4(-0.20,  0.00, 0.15, 0.25),
  vec4( 0.40, -0.10, 0.12, 0.22),
  vec4(-0.10, -0.50, 0.14, 0.20),
  vec4( 0.02, -0.55, 0.22, 0.32),
  vec4(-0.30,  0.30, 0.12, 0.18),
  vec4( 0.08,  0.50, 0.10, 0.15)
);

float mareFraction(vec2 ll) {
  float m = 0.0;
  for (int i = 0; i < N_MARE; i++) {
    vec4 b = MARE[i];
    float dist = length(vec2(ll.y - b.x, ll.x - b.y));
    if (dist < b.z) {
      float f = 1.0 - dist / b.z;
      float edge = fbm(ll * 12.0 + b.x * 7.0, 3) * 0.6 + 0.7;
      m = max(m, smoothstep(0.0, 0.55, f) * edge);
    }
  }
  return clamp(m, 0.0, 1.0);
}

// Craters with a power-law size-frequency distribution.
//
// Radius is drawn as r = rmin * u^(-1/2) from uniform u, which gives
// P(R > r) proportional to r^-2 -- the observed lunar N ~ D^-2. This is what
// stops the surface reading as noise: fixed-frequency stamping (what the
// canvas moon does) produces a visible lattice.
float craters(vec2 p, float freq, float amp, float seed) {
  vec2 g = p * freq;
  vec2 gi = floor(g);
  float h = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 cell = gi + vec2(float(ox), float(oy));
      vec2 c = cell + hash22(cell + seed) * 0.9 + 0.05;
      float u = max(hash21(cell + seed + 7.7), 0.03);
      float r = clamp(0.10 * pow(u, -0.5), 0.10, 0.58);
      float d = length(g - c) / r;
      if (d < 1.0) {
        float floorTerm = -(1.0 - d * d) * 0.7;
        float rim = exp(-pow((d - 0.88) / 0.11, 2.0)) * 0.95;
        h += amp * (floorTerm + rim) * (0.4 + r);
      } else if (d < 1.7) {
        h += amp * 0.10 * (0.4 + r) * exp(-(d - 1.0) * 3.0);
      }
    }
  }
  return h;
}

float heightAt(vec2 ll) {
  float h = fbm(ll * 4.0 + 10.0, 5) * 0.22;
  h -= mareFraction(ll) * 0.16;
  h += craters(ll, 6.0,  0.100, 1.0);
  h += craters(ll, 16.0, 0.048, 2.0);
  h += craters(ll, 44.0, 0.021, 3.0);
  return h;
}

void main() {
  // vScreen is -1..1; map to lon in [-PI, PI], lat in [-PI/2, PI/2].
  vec2 ll = vec2(vScreen.x * PI, vScreen.y * PI * 0.5);

  // Longitude epsilon widens toward the poles so the gradient stays isotropic.
  float cosLat = max(cos(ll.y), 0.15);
  float epsLon = 0.0016 / cosLat;
  float epsLat = 0.0016;

  float hL = heightAt(ll - vec2(epsLon, 0.0));
  float hR = heightAt(ll + vec2(epsLon, 0.0));
  float hD = heightAt(ll - vec2(0.0, epsLat));
  float hU = heightAt(ll + vec2(0.0, epsLat));

  const float RELIEF = 0.014;
  vec3 n = normalize(vec3(
    -(hR - hL) / (2.0 * epsLon) * RELIEF,
    -(hU - hD) / (2.0 * epsLat) * RELIEF,
    1.0
  ));

  float mare = mareFraction(ll);
  float rough = fbm(ll * 4.0 + 10.0, 5);
  float albedo = clamp(0.58 + rough * 0.14 - mare * 0.33, 0.06, 0.86);

  // Fresh large craters throw bright ray systems.
  albedo += clamp(craters(ll, 6.0, 0.10, 1.0), 0.0, 0.06) * 1.4;

  fragColor = vec4(n.xy * 0.5 + 0.5, clamp(albedo, 0.06, 0.86), mare);
}`;

export const MOON_FS = `#version 300 es
precision highp float;
in vec2 vScreen;
uniform sampler2D uSurface;
uniform float uRadius;
uniform float uAge;
uniform float uIllum;
uniform float uAdapt;
uniform float uPurkinje;
uniform float uTime;
uniform vec2 uLibration;
out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
${NOISE_GLSL}

void main() {
  // ── Sky ──
  vec3 sky = vec3(0.0);
  float skyAlpha = 0.0;

  // Starfield: procedural, no buffers. Brightness climbs with adaptation --
  // the longer you sit in the dark, the more stars there are.
  vec2 sc = vScreen * 22.0;
  vec2 si = floor(sc);
  vec2 sf = fract(sc) - hash22(si);
  float starMag = hash21(si + 3.3);
  if (starMag > 0.86) {
    float d = length(sf);
    float tw = 0.72 + 0.28 * sin(uTime * (0.5 + starMag) * 2.0 + starMag * 40.0);
    float star = exp(-d * d * 90.0) * (starMag - 0.86) / 0.14;
    vec3 temp = mix(vec3(0.78, 0.84, 1.0), vec3(1.0, 0.95, 0.86), hash21(si + 9.1));
    float b = star * tw * (0.35 + 0.65 * uAdapt);
    sky += temp * b;
    skyAlpha = max(skyAlpha, b);
  }

  // Chromatic corona: the three channels fall off at slightly different radii,
  // so the halo disperses instead of gradient-stopping.
  float rr = length(vScreen);
  vec3 coronaR = vec3(exp(-pow(max(rr - uRadius, 0.0) / 0.40, 1.6)), 0.0, 0.0);
  vec3 coronaG = vec3(0.0, exp(-pow(max(rr - uRadius, 0.0) / 0.45, 1.6)), 0.0);
  vec3 coronaB = vec3(0.0, 0.0, exp(-pow(max(rr - uRadius, 0.0) / 0.54, 1.6)));
  vec3 corona = (coronaR + coronaG + coronaB)
              * vec3(0.55, 0.48, 1.0) * 0.075 * (0.35 + 0.65 * uIllum);
  sky += corona;
  skyAlpha = max(skyAlpha, max(corona.r, max(corona.g, corona.b)) * 3.0);

  // Alpha falls to zero INSIDE the canvas bounds, so there is no edge to see.
  float vignette = 1.0 - smoothstep(0.55, 1.0, rr);
  sky *= vignette;
  skyAlpha *= vignette;

  // Premultiplied validity: alpha must cover every RGB channel, since sky
  // sums star+corona contributions while skyAlpha tracked only their max.
  // On the black page background this is identical; it prevents fringing if
  // the sky ever composites over a non-black destination.
  float skyA = clamp(max(skyAlpha, max(sky.r, max(sky.g, sky.b))), 0.0, 1.0);

  // Limb coverage, analytic: the ramp is ~1.25 device px wide and CENTRED on
  // r = 1 (half inside, half outside), so the silhouette keeps its size and
  // gains real intermediate pixels. fwidth is taken HERE, before the early
  // return — derivatives are undefined in divergent control flow, and the
  // limb is exactly where neighbouring pixels diverge.
  vec2 p = vScreen / uRadius;
  float r = length(p);
  float edgeW = max(fwidth(r), 1e-5) * 1.25;
  float discCoverage = 1.0 - smoothstep(1.0 - 0.5 * edgeW, 1.0 + 0.5 * edgeW, r);
  if (discCoverage <= 0.0) {
    fragColor = vec4(sky, skyA);
    return;
  }

  // Colour from inside, coverage from geometry: the outer half of the ramp
  // (r >= 1) is shaded with the normal at the ramp's inner edge, where N.z
  // ~ 0.07 is a real surface. Shading at r -> 1 instead (N.z -> 0) would
  // halve the horizon term on the lit limb and thin the edge.
  float rc = min(r, 1.0 - 0.5 * edgeW);
  vec2 pc = p * (rc / max(r, 1e-6));
  vec3 N = vec3(pc, sqrt(max(0.0, 1.0 - rc * rc)));

  // Libration: rotate the view-space normal into selenographic coordinates.
  // The moon nods; the texture does not move under it.
  float cl = cos(-uLibration.y), sl = sin(-uLibration.y);
  vec3 S = vec3(N.x, cl * N.y - sl * N.z, sl * N.y + cl * N.z);
  float co = cos(-uLibration.x), so = sin(-uLibration.x);
  S = vec3(co * S.x + so * S.z, S.y, -so * S.x + co * S.z);

  float lon = atan(S.x, S.z);
  float lat = asin(clamp(S.y, -1.0, 1.0));
  vec2 uv = vec2(lon / TAU + 0.5, lat / PI + 0.5);

  vec4 surf = texture(uSurface, uv);
  vec2 nxy = surf.rg * 2.0 - 1.0;
  vec3 nT = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  float albedo = surf.b;

  // Tangent frame on the sphere, so the baked normal perturbs the real normal.
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
  vec3 B = cross(N, T);
  vec3 Np = normalize(nT.x * T + nT.y * B + nT.z * N);
  // Relief fades out over the last ~1% of radius. At the limb N.z -> 0, so any
  // tilt in the baked normal turns facets AWAY from the viewer (mu = 0) while,
  // at new moon, turning them TOWARD the sun behind the disc (mu0 > 0) — and
  // Lommel-Seeliger 2*mu0/(mu0+mu) then reads 2.0: the dotted ring around the
  // dark disc. Foreshortening hides relief at the limb anyway.
  Np = normalize(mix(N, Np, smoothstep(0.0, 0.15, N.z)));

  // Sun direction from synodic age. Matches the canvas moon's convention:
  // age 0 puts the sun behind the moon, age 14.77 puts it behind the viewer.
  float phase = uAge / 29.53058770576 * TAU;
  vec3 L = normalize(vec3(-sin(phase), 0.0, -cos(phase)));
  vec3 V = vec3(0.0, 0.0, 1.0);

  // Lommel-Seeliger, not Lambert. This is why a real full moon is a flat disc
  // edge to edge instead of a lit ball with a dark rim.
  float mu0 = max(dot(Np, L), 0.0);
  float mu  = max(dot(Np, V), 0.0);
  float ls  = 2.0 * mu0 / max(mu0 + mu, 1e-4);

  // Opposition surge: shadow-hiding among regolith grains spikes the
  // brightness within a few degrees of zero phase angle.
  float alpha = acos(clamp(-cos(phase), -1.0, 1.0));
  float surge = 1.0 + 0.55 * exp(-alpha / 0.075);

  // Horizon shadow: a facet cannot be sunlit where the sphere itself is on the
  // night side (geometric N.L <= 0) — the limb of the globe is in the way. Without
  // it, the baked crater normals (tilts ~0.5 for the small craters) still swing
  // the last limb pixel to face a sun behind the disc, and the L-S ratio reads
  // 2.0: single white pinpricks on the rim at new moon. Earthshine is not gated.
  float horizon = smoothstep(0.0, 0.03, dot(N, L));
  float Ld = albedo * ls * surge * horizon;

  // Earthshine. Earth is behind the viewer and full when the moon is new, so
  // this is frontal fill -- near-flat across the disc, not a shaded sphere.
  // That flatness is why the real old-moon-in-the-new-moon's-arms reads as a
  // disc. The half the sun refuses is not empty.
  float earthPhase = 1.0 - uIllum;
  float Le = albedo * 0.088 * pow(earthPhase, 1.6)
           * (0.55 + 0.45 * N.z) * (0.20 + 0.80 * uAdapt);

  float Y = Ld + Le;

  // Spectral reflectance: warm anorthosite highlands, bluish basalt mare.
  const vec3 HIGHLAND = vec3(1.00, 0.965, 0.905);
  const vec3 MARE_TINT = vec3(0.855, 0.900, 1.000);
  vec3 refl = mix(HIGHLAND, MARE_TINT, surf.a);

  // Mesopic split. Luminance decides which visual system renders the pixel,
  // and the thresholds RISE with adaptation, so the scotopic zone climbs up
  // into the lit side the longer you sit still.
  float yLo = mix(0.012, 0.10, uAdapt);
  float yHi = mix(0.100, 0.32, uAdapt);
  float s = 1.0 - smoothstep(yLo, yHi, Y);

  // Purkinje shift: rod sensitivity peaks at 507nm, not 555nm. Reds darken,
  // blues brighten. uPurkinje > 1.0 exaggerates past the physical value.
  vec3 vPrime = mix(vec3(1.0), vec3(0.42, 1.00, 1.62), uPurkinje);
  float scotLum = dot(refl * vPrime, vec3(0.33333));

  const vec3 VISUAL_PURPLE = vec3(0.60, 0.53, 1.00);
  vec3 photopic = refl * Y;
  vec3 scotopic = VISUAL_PURPLE * scotLum * Y;
  vec3 col = mix(photopic, scotopic, s);

  // Triangular dither. Violet gradients over near-black is the worst case for
  // OLED banding, which this project has already been bitten by.
  float d1 = hash21(gl_FragCoord.xy + uTime);
  float d2 = hash21(gl_FragCoord.xy + uTime + 31.7);
  col += (d1 + d2 - 1.0) / 255.0;

  // The disc is opaque foreground: no sky composited over it. The corona halo
  // and starfield render only AROUND the disc, which is what produces the
  // unboxing. Adding sky here washed the honest lit face with a center-weighted
  // violet tint (corona is constant inside the disc, where
  // max(rr-uRadius,0)==0), undoing the neutral-silver photopic decision.
  // The one exception is the ~1 px limb ramp: premultiplied "disc over sky",
  // so sky shows only by (1 - coverage) — zero everywhere inside the ramp.
  col = max(col, vec3(0.0));
  fragColor = vec4(col * discCoverage + sky * (1.0 - discCoverage),
                   discCoverage + skyA * (1.0 - discCoverage));
}`;

/** 2048x1024 desktop, halved on narrow viewports. */
export function bakeSize() {
  const wide = typeof window !== 'undefined' && window.innerWidth >= 768;
  return wide ? [2048, 1024] : [1024, 512];
}

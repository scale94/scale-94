// src/terminal/mercury/planet/mercuryPlanetShader.js — Mercury, from the bare metal.
//
// An impostor quad ray-intersects the sphere, writes gl_FragDepth (so the
// aether sorts in front of and behind it), and shades from two equirect maps:
// MESSENGER enhanced colour + USGS DEM. Airless-body photometry
// (Lommel–Seeliger), a penumbra as wide as the real Sun's disc, cast crater
// shadows near the terminator. Constants come from the modules that own and
// test them (glf), exactly like /ACCRETION. Frame convention = planetFrame.js.
// Phase 2: a body rotation matrix (mercuryBody), a transmutation front, three
// phases of the element by local temperature (mercuryThermal), and a liquid
// mirror that reflects the Sun, the four element emitters, and the aether that
// wraps the planet (8 analytic lobes, aetherLobes.js; spec amendment 2026-10-01).

import { glf, v3 } from '../../gl/glf';
import {
  R_SCENE, R_MERCURY_M, SHADOW_STEPS, SHADOW_REACH_RAD, SHADOW_SOFT_M, SHADOW_ZONE, SHADOW_SOFT_LSB, SHADOW_BIAS_LSB,
  FALLBACK_ALBEDO, HG_F0, ROUGH_LIQUID, ROUGH_BOIL, SOLID_HG_ALBEDO, SPARKLE_CELLS, SPARKLE_DENSITY, SPARKLE_COS,
  SPARKLE_GAIN, EMIT_RADIUS, FRONT_EDGE, FRONT_SOFT, FRONT_NOISE_FREQ, PHASE_BLEND_K,
  EMIT_MIN_SIN, EMIT_HORIZON_SOFT, SUN_SHOULDER, AETHER_NIGHT, AETHER_DAY_LO, AETHER_DAY_HI,
  AETHER_DIFFUSE, NIGHT_TINT,
} from './planetLook';
import { AETHER_LOBES, AETHER_SHAPES } from './aetherLobes';
import {
  HG_MELT_K, HG_BOIL_K, T_NIGHT_FLOOR_K, T_SUNSET_K, TAU_WARM_H, TAU_COOL_H, HOURS_PER_RAD,
} from './mercuryThermal';
import { DEM_MIN_M, DEM_MAX_M } from './mercuryMaps.generated';

// One 8-bit DEM step in true metres.
export const DEM_LSB_M = (DEM_MAX_M - DEM_MIN_M) / 255;

export const PLANET_BUILTINS = ['viewMatrix', 'projectionMatrix', 'cameraPosition'];

export const PLANET_UNIFORMS = [
  'uAlbedo', 'uDem', 'uHasMaps', 'uSunDir', 'uBodyRot', 'uSunIrr', 'uSunSinR',
  'uDemTexel', 'uTime', 'uExposure', 'uRelief', 'uNightFloor',
  'uTau', 'uHeatK', 'uSubsolarT', 'uEmitPos', 'uEmitCol', 'uSunGlint', 'uEmitGain',
  'uAethDir', 'uAethCol', 'uAetherGain', 'uAetherSinW', 'uAetherSilver',
  'uAetherEdge', 'uAetherStretch',
];

const AETHER_SHAPE_GLSL = `const vec2 AETHER_SHAPE[${AETHER_LOBES}] = vec2[${AETHER_LOBES}](${AETHER_SHAPES.map(([w, s]) => `vec2(${glf(w)}, ${glf(s)})`).join(', ')});`;

export const PLANET_VS = /* glsl */ `in vec3 position;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;

out vec3 vWorld;

const float R_SCENE = ${glf(R_SCENE)};

void main() {
  // Billboard at the centre plane, sized to the perspective silhouette + margin.
  float d = length(cameraPosition);
  float ext = R_SCENE * d / sqrt(max(d * d - R_SCENE * R_SCENE, 1e-4)) * 1.08;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vWorld = (right * position.x + up * position.y) * ext;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

export const PLANET_FS = /* glsl */ `precision highp float;
precision highp sampler2D;

in vec3 vWorld;
layout(location = 0) out vec4 fragColor;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform sampler2D uAlbedo;
uniform sampler2D uDem;
uniform float uHasMaps;
uniform vec3 uSunDir;
uniform mat3 uBodyRot;
uniform float uSunIrr;
uniform float uSunSinR;
uniform vec2 uDemTexel;
uniform float uTime;
uniform float uExposure;
uniform float uRelief;
uniform float uNightFloor;
uniform float uTau;
uniform float uHeatK;
uniform float uSubsolarT;
uniform vec3 uEmitPos[4];
uniform vec3 uEmitCol[4];
uniform float uSunGlint;
uniform float uEmitGain;
uniform vec3 uAethDir[${AETHER_LOBES}];
uniform vec3 uAethCol[${AETHER_LOBES}];
uniform float uAetherGain;
uniform float uAetherSinW;
uniform float uAetherSilver;
uniform float uAetherEdge;
uniform float uAetherStretch;

const float PI = 3.14159265358979;
const float TAU = 6.28318530717959;
const float HALF_PI = 1.57079632679490;
const float R_SCENE = ${glf(R_SCENE)};
const float R_MERCURY_M = ${glf(R_MERCURY_M)};
const float DEM_MIN_M = ${glf(DEM_MIN_M)};
const float DEM_MAX_M = ${glf(DEM_MAX_M)};
const int SHADOW_STEPS = ${SHADOW_STEPS};
const float SHADOW_REACH_RAD = ${glf(SHADOW_REACH_RAD)};
const float SHADOW_SOFT_M = ${glf(SHADOW_SOFT_M)};
const float SHADOW_ZONE = ${glf(SHADOW_ZONE)};
const float DEM_LSB_M = ${glf(DEM_LSB_M)};
const float SHADOW_SOFT_LSB = ${glf(SHADOW_SOFT_LSB)};
const float SHADOW_BIAS_LSB = ${glf(SHADOW_BIAS_LSB)};
const vec3 FALLBACK_ALBEDO = ${v3(FALLBACK_ALBEDO)};

const float HG_MELT_K = ${glf(HG_MELT_K)};
const float HG_BOIL_K = ${glf(HG_BOIL_K)};
const float T_NIGHT_FLOOR_K = ${glf(T_NIGHT_FLOOR_K)};
const float T_SUNSET_K = ${glf(T_SUNSET_K)};
const float TAU_WARM_H = ${glf(TAU_WARM_H)};
const float TAU_COOL_H = ${glf(TAU_COOL_H)};
const float HOURS_PER_RAD = ${glf(HOURS_PER_RAD)};
const vec3 HG_F0 = ${v3(HG_F0)};
const float ROUGH_LIQUID = ${glf(ROUGH_LIQUID)};
const float ROUGH_BOIL = ${glf(ROUGH_BOIL)};
const vec3 SOLID_HG_ALBEDO = ${v3(SOLID_HG_ALBEDO)};
const float SPARKLE_CELLS = ${glf(SPARKLE_CELLS)};
const float SPARKLE_DENSITY = ${glf(SPARKLE_DENSITY)};
const float SPARKLE_COS = ${glf(SPARKLE_COS)};
const float SPARKLE_GAIN = ${glf(SPARKLE_GAIN)};
const float EMIT_RADIUS = ${glf(EMIT_RADIUS)};
const float FRONT_EDGE = ${glf(FRONT_EDGE)};
const float FRONT_SOFT = ${glf(FRONT_SOFT)};
const float FRONT_NOISE_FREQ = ${glf(FRONT_NOISE_FREQ)};
const float PHASE_BLEND_K = ${glf(PHASE_BLEND_K)};
const float EMIT_MIN_SIN = ${glf(EMIT_MIN_SIN)};
const float EMIT_HORIZON_SOFT = ${glf(EMIT_HORIZON_SOFT)};
const float SUN_SHOULDER = ${glf(SUN_SHOULDER)};
const int AETHER_LOBES = ${AETHER_LOBES};
${AETHER_SHAPE_GLSL}
const float AETHER_NIGHT = ${glf(AETHER_NIGHT)};
const float AETHER_DAY_LO = ${glf(AETHER_DAY_LO)};
const float AETHER_DAY_HI = ${glf(AETHER_DAY_HI)};
const float AETHER_DIFFUSE = ${glf(AETHER_DIFFUSE)};
const vec3 NIGHT_TINT = ${v3(NIGHT_TINT)};

float heightAt(vec2 uv, vec2 gx, vec2 gy) {
  return mix(DEM_MIN_M, DEM_MAX_M, textureGrad(uDem, vec2(fract(uv.x), uv.y), gx, gy).r);
}

// March toward the Sun over the (exaggerated) heightfield. Terrain height is
// measured against the tangent plane, so the sphere's curvature drops away
// as (xR)^2 / 2R; the sunlight ray rises as xR * tan(elevation). Softness and
// march bias scale with relief and floor at DEM quantisation steps, so the
// dither and 8-bit stepping never swamp the penumbra at high exaggeration.
float castShadow(vec2 uv, vec3 nb, vec3 Lb, float h0, float cosLat, vec3 east, vec3 north, vec2 gx, vec2 gy) {
  vec3 tdir = Lb - nb * dot(Lb, nb);
  float tl = length(tdir);
  if (tl < 1e-4) return 1.0;
  tdir /= tl;
  float tanE = dot(Lb, nb) / tl;
  vec2 duv = vec2(dot(tdir, east) / (TAU * cosLat), dot(tdir, north) / PI);
  float vis = 1.0;
  float soft = max(SHADOW_SOFT_M, SHADOW_SOFT_LSB * DEM_LSB_M) * max(uRelief, 1e-3);
  float bias = SHADOW_BIAS_LSB * DEM_LSB_M * uRelief;
  for (int k = 1; k <= SHADOW_STEPS; k++) {
    float f = float(k) / float(SHADOW_STEPS);
    float x = SHADOW_REACH_RAD * f * f;
    float hk = heightAt(uv + duv * x, gx, gy);
    float xm = x * R_MERCURY_M;
    float terrain = hk * uRelief - xm * xm / (2.0 * R_MERCURY_M);
    float ray = h0 * uRelief + xm * tanE + bias;
    vis = min(vis, smoothstep(-soft, soft, ray - terrain));
  }
  return vis;
}

// mercuryThermal.surfaceTempK, exactly.
float surfaceTempK(float mu0, float lonRel, float cosLat, float tss, float heatK) {
  float tset = T_SUNSET_K * pow(max(cosLat, 0.0), 0.25);
  float teq = tss * pow(max(mu0, 0.0), 0.25);
  float t;
  if (lonRel >= -HALF_PI && lonRel <= HALF_PI) {
    if (lonRel < 0.0) {
      float h = (lonRel + HALF_PI) * HOURS_PER_RAD;
      t = T_NIGHT_FLOOR_K + (max(teq, T_NIGHT_FLOOR_K) - T_NIGHT_FLOOR_K) * (1.0 - exp(-h / TAU_WARM_H));
    } else {
      t = max(teq, tset);
    }
  } else {
    float h = (lonRel > 0.0 ? lonRel - HALF_PI : lonRel + 3.0 * HALF_PI) * HOURS_PER_RAD;
    t = T_NIGHT_FLOOR_K + (tset - T_NIGHT_FLOOR_K) * exp(-h / TAU_COOL_H);
  }
  return t + heatK;
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y), u.z);
}

// A disc of angular radius asin(sinR) seen in a mirror of roughness rough:
// a Gaussian in angle whose width adds the disc and the GGX alpha, scaled so
// the integrated energy stays that of the disc.
float lobe(float cosA, float sinR, float rough) {
  float a = acos(clamp(cosA, -1.0, 1.0));
  float alpha = rough * rough;
  float w2 = sinR * sinR + alpha * alpha;
  return (sinR * sinR / w2) * exp(-a * a / w2);
}

// Highlight roll-off (mirrorLobes.softShoulder).
float softShoulder(float x, float k) { return k * (1.0 - exp(-x / k)); }

// Night attenuation of the aether, keyed on the SURFACE facing the Sun (not
// the reflection direction): full day strength from AETHER_DAY_HI, a cold
// indigo AETHER_NIGHT below AETHER_DAY_LO.
vec3 aetherTint(vec3 nW) {
  float dayW = smoothstep(AETHER_DAY_LO, AETHER_DAY_HI, dot(nW, uSunDir));
  return mix(AETHER_NIGHT * NIGHT_TINT, vec3(1.0), dayW);
}

// An aether lobe's colour, pulled toward neutral silver by uAetherSilver:
// the metal stays quicksilver and the aether only tints it.
vec3 aetherHue(vec3 col) {
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  return mix(col, vec3(l), uAetherSilver);
}

// One aether streak in the mirror: an elongated lobe around d, stretched along
// the orbital flow (azimuth about +Y), with a super-Gaussian profile:
// uAetherEdge 1 = soft Gaussian; higher = a flat silver core that steps
// abruptly into the dark, like the meniscus of a mercury pool.
float aetherStreak(vec3 R, vec3 d, vec2 shape, float rough) {
  float facing = dot(R, d);
  if (facing <= 0.0) return 0.0;
  vec3 flow = normalize(cross(vec3(0.0, 1.0, 0.0), d));
  vec3 bn = cross(d, flow);
  float alpha = rough * rough;
  float wA = uAetherSinW * shape.x;
  float across = sqrt(wA * wA + alpha * alpha);
  float along = across * (1.0 + (shape.y - 1.0) * uAetherStretch);
  float u = dot(R, flow) / along;
  float v = dot(R, bn) / across;
  float d2 = u * u + v * v;
  return smoothstep(0.0, 0.15, facing) * exp(-pow(d2, max(uAetherEdge, 0.5)));
}

// What the liquid sees: the Sun disc, the four elements, and the aether that
// wraps the planet on every side. Analytic; no cubemap.
vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {
  vec3 c = vec3(softShoulder(uSunGlint * uSunIrr * uExposure * lobe(dot(R, uSunDir), uSunSinR, rough), SUN_SHOULDER));
  for (int i = 0; i < 4; i++) {
    vec3 d = uEmitPos[i] - P;
    float dist = max(length(d), 1e-3);
    vec3 dir = d / dist;
    float sinE = clamp(EMIT_RADIUS / dist, EMIT_MIN_SIN, 0.99);
    float above = smoothstep(-EMIT_HORIZON_SOFT, EMIT_HORIZON_SOFT, dot(nW, dir));
    c += uEmitCol[i] * (uEmitGain * above * lobe(dot(R, dir), sinE, rough));
  }
  vec3 a = vec3(0.0);
  for (int i = 0; i < AETHER_LOBES; i++) a += aetherHue(uAethCol[i]) * aetherStreak(R, uAethDir[i], AETHER_SHAPE[i], rough);
  return c + uAetherGain * aetherTint(nW) * a;
}

// Frozen Hg is matte: it takes the aether as a soft wrap-around ambient.
vec3 aetherDiffuse(vec3 nW) {
  vec3 a = vec3(0.0);
  for (int i = 0; i < AETHER_LOBES; i++) {
    float k = 0.5 + 0.5 * dot(nW, uAethDir[i]);
    a += uAethCol[i] * (k * k);
  }
  return uAetherGain * AETHER_DIFFUSE * aetherTint(nW) * a * (8.0 / float(AETHER_LOBES));
}

void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float b = dot(ro, rd);
  float disc = b * b - (dot(ro, ro) - R_SCENE * R_SCENE);
  float fw = max(fwidth(disc), 1e-6);
  float coverage = clamp(disc / fw + 0.5, 0.0, 1.0);

  // Shade the nearest point even for near-misses so derivatives stay defined
  // across the silhouette; discard only after all dFdx/dFdy calls.
  float t = -b - sqrt(max(disc, 0.0));
  vec3 hit = ro + rd * t;
  vec3 ng = normalize(hit);

  // uBodyRot is body → world (mercuryBody.q); v * M = transpose(M) * v.
  vec3 nb = ng * uBodyRot;
  vec3 Lb = uSunDir * uBodyRot;
  vec3 Vb = -rd * uBodyRot;
  float lat = asin(clamp(nb.y, -1.0, 1.0));
  float lon = atan(-nb.z, nb.x);
  vec2 uv = vec2(fract(lon / TAU), 0.5 + lat / PI);

  // Seam-safe gradients: take whichever of u / u+0.5 is continuous here.
  vec2 gx = dFdx(uv), gy = dFdy(uv);
  vec2 uvS = vec2(fract(uv.x + 0.5), uv.y);
  vec2 gxS = dFdx(uvS), gyS = dFdy(uvS);
  if (abs(gxS.x) + abs(gyS.x) < abs(gx.x) + abs(gy.x)) { gx.x = gxS.x; gy.x = gyS.x; }

  if (disc < -fw) discard;

  vec4 clip = projectionMatrix * viewMatrix * vec4(hit, 1.0);
  gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);

  float cosLat = max(cos(lat), 0.02);
  vec3 east = vec3(-sin(lon), 0.0, -cos(lon));
  vec3 north = vec3(-sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon));

  vec3 albedo = FALLBACK_ALBEDO;
  vec3 n = nb;
  float h0 = 0.0;
  if (uHasMaps > 0.5) {
    albedo = textureGrad(uAlbedo, uv, gx, gy).rgb;
    h0 = heightAt(uv, gx, gy);
    float hE = heightAt(uv + vec2(uDemTexel.x, 0.0), gx, gy) - heightAt(uv - vec2(uDemTexel.x, 0.0), gx, gy);
    float hN = heightAt(uv + vec2(0.0, uDemTexel.y), gx, gy) - heightAt(uv - vec2(0.0, uDemTexel.y), gx, gy);
    float distE = 2.0 * uDemTexel.x * TAU * R_MERCURY_M * cosLat;
    float distN = 2.0 * uDemTexel.y * PI * R_MERCURY_M;
    n = normalize(nb - east * (hE * uRelief / distE) - north * (hN * uRelief / distN));
  }

  // No atmosphere: the terminator is as soft as the Sun's disc is wide.
  float mu0g = dot(nb, Lb);
  float term = smoothstep(-uSunSinR, uSunSinR, mu0g);
  float mu0 = max(dot(n, Lb), 0.0);
  float mu = max(dot(n, Vb), 1e-3);
  float ls = 2.0 * mu0 / (mu0 + mu + 1e-4); // Lommel–Seeliger, 1 at normal incidence

  float vis = 1.0;
  if (uHasMaps > 0.5 && mu0g > -uSunSinR && mu0g < SHADOW_ZONE) {
    vis = castShadow(uv, nb, Lb, h0, cosLat, east, north, gx, gy);
    vis = mix(vis, 1.0, smoothstep(0.7 * SHADOW_ZONE, SHADOW_ZONE, mu0g));
  }

  vec3 colLin = albedo * (uSunIrr * uExposure * ls * term * vis + uNightFloor);

  // Transmutation: the front advances from the subsolar point outward
  // (noise-edged) and retreats the same way on refreeze. Inside it the crust
  // relief flattens into fluid and the element takes its phase from the
  // local temperature: solid at night, a liquid mirror by day and into dusk,
  // boiling near noon.
  if (uTau > 0.0) {
    float front = 1.0 - acos(clamp(mu0g, -1.0, 1.0)) / PI;
    float edgeN = (vnoise3(nb * FRONT_NOISE_FREQ) - 0.5) * FRONT_EDGE;
    float thr = 1.0 + FRONT_EDGE - uTau * (1.0 + 2.0 * FRONT_EDGE);
    float fluid = smoothstep(thr - FRONT_SOFT, thr + FRONT_SOFT, front + edgeN);

    float lonSun = length(Lb.xz) > 1e-4 ? atan(-Lb.z, Lb.x) : 0.0;
    float lonRel = mod(lon - lonSun + PI, TAU) - PI;
    float T = surfaceTempK(mu0g, lonRel, cos(lat), uSubsolarT, uHeatK);
    float liquidW = smoothstep(HG_MELT_K - PHASE_BLEND_K, HG_MELT_K + PHASE_BLEND_K, T);
    float boilW = smoothstep(HG_BOIL_K - PHASE_BLEND_K, HG_BOIL_K + PHASE_BLEND_K, T);

    vec3 nW = uBodyRot * normalize(mix(n, nb, fluid));
    vec3 R = reflect(rd, nW);
    float NoV = clamp(dot(nW, -rd), 0.0, 1.0);
    vec3 F = HG_F0 + (1.0 - HG_F0) * pow(1.0 - NoV, 5.0);
    vec3 liquid = F * envRadiance(R, mix(ROUGH_LIQUID, ROUGH_BOIL, boilW), hit, nW);

    float sunI = uSunIrr * uExposure;
    float facet = hash13(vec3(floor(uv * vec2(2.0 * SPARKLE_CELLS, SPARKLE_CELLS)), 7.0));
    float glint = step(1.0 - SPARKLE_DENSITY, facet) * smoothstep(SPARKLE_COS, 1.0, dot(R, uSunDir)) * term;
    vec3 solid = SOLID_HG_ALBEDO * (sunI * max(dot(nW, uSunDir), 0.0) * term + uNightFloor + aetherDiffuse(nW))
      + vec3(glint * SPARKLE_GAIN * sunI);

    colLin = mix(colLin, mix(solid, liquid, liquidW), fluid);
  }

  vec3 col = max(colLin, 0.0);
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  float dith = (fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  fragColor = vec4(srgb + dith, coverage);
}
`;

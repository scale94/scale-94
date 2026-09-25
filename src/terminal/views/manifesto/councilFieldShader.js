// The accretion-field fragment pass (field spec §7). Constants are
// interpolated from the JS modules that own and test them, so the shader
// and its mirrors cannot drift.

import { COLLIDER_TIMING } from './useCouncilCollider';
import { B_C, LUT_W, X_MIN, X_MAX, PHI_MAX, N_B, N_PHI, N_D, D_X_MAX, FAR } from './councilGeodesics';
import {
  COS_I, SIN_I, SPIN_SIGN, R_IN, R_OUT, F_MAX, T_PEAK, T_EXP, COUNTER_JET,
  KIM_X_LOW, KIM_X_HIGH, KIM_Y_1, KIM_Y_2, KIM_Y_3, XYZ_TO_LINEAR_SRGB,
} from './councilFieldPhysics';
import { OMEGA_ISCO_VIS } from './councilMatter';
import { SPIRAL_DEG } from './councilFieldUniforms';

export function glf(x) {
  const s = Number(x).toPrecision(9);
  return /[.e]/.test(s) ? s : `${s}.0`;
}
const v4 = (a) => `vec4(${a.map(glf).join(', ')})`;
const v3 = (a) => `vec3(${a.map(glf).join(', ')})`;
const M = XYZ_TO_LINEAR_SRGB;

export const FIELD_UNIFORMS = [
  'u_resolution', 'u_time', 'u_ui_mode', 'u_anim_phase', 'u_phase_t', 'u_phase_ms',
  'u_seatA', 'u_seatB', 'u_colorA', 'u_colorB', 'u_pointer', 'u_pointer_live',
  'u_intensity', 'u_eject', 'u_eject_color', 'u_flow', 'u_flow_w', 'u_lens_d',
  'u_geodesic', 'u_deflect', 'u_matter',
];

export const FIELD_VS = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

export const FIELD_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform vec2 u_resolution;
uniform float u_time;
uniform int u_ui_mode;
uniform int u_anim_phase;
uniform float u_phase_t;
uniform float u_phase_ms;
uniform vec2 u_seatA;
uniform vec2 u_seatB;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec2 u_pointer;
uniform float u_pointer_live;
uniform float u_intensity;
uniform vec3 u_eject;
uniform vec3 u_eject_color;
uniform vec4 u_flow;
uniform float u_flow_w;
uniform float u_lens_d;
uniform sampler2D u_geodesic;
uniform sampler2D u_deflect;
uniform sampler2D u_matter;

out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const vec2 CENTER = vec2(320.0, 320.0);
const float R_S_U = 14.0;
const float R_SEAT = 220.0;
const float R_FOUNDATION = 150.0;
const float VIEW_X0 = -170.0;
const float VIEW_W = 980.0;
const float VIEW_H = 640.0;

const float B_C = ${glf(B_C)};
const float LUT_W = ${glf(LUT_W)};
const float X_MIN = ${glf(X_MIN)};
const float X_MAX = ${glf(X_MAX)};
const float PHI_MAX = ${glf(PHI_MAX)};
const float D_X_MAX = ${glf(D_X_MAX)};
const float FAR = ${glf(FAR)};
const float N_B = ${glf(N_B)};
const float N_PHI = ${glf(N_PHI)};
const float N_D = ${glf(N_D)};

const float COS_I = ${glf(COS_I)};
const float SIN_I = ${glf(SIN_I)};
const float SPIN = ${glf(SPIN_SIGN)};
const float R_IN = ${glf(R_IN)};
const float R_OUT = ${glf(R_OUT)};
const float F_MAX = ${glf(F_MAX)};
const float T_PEAK = ${glf(T_PEAK)};
const float T_EXP = ${glf(T_EXP)};
const float DISK_GAIN = 1.6;
const float OMEGA_ISCO_VIS = ${glf(OMEGA_ISCO_VIS)};
const float COUNTER_JET = ${glf(COUNTER_JET)};

const float T_INFALL = ${glf(COLLIDER_TIMING.T_INFALL)};
const float DELAY_MAX = 900.0;
const float WOBBLE_DEG = 7.0;
const float SPIRAL_DEG = ${glf(SPIRAL_DEG)};
const int ARM_SEGMENTS = 24;

const vec4 KXL = ${v4(KIM_X_LOW)};
const vec4 KXH = ${v4(KIM_X_HIGH)};
const vec4 KY1 = ${v4(KIM_Y_1)};
const vec4 KY2 = ${v4(KIM_Y_2)};
const vec4 KY3 = ${v4(KIM_Y_3)};
const vec3 MR = ${v3(M.slice(0, 3))};
const vec3 MG = ${v3(M.slice(3, 6))};
const vec3 MB = ${v3(M.slice(6, 9))};

// ── lookup tables ──────────────────────────────────────────────────────────
float lutCoord(float f, float n) { return clamp(f, 0.0, 1.0) * (n - 1.0) / n + 0.5 / n; }

float rayRadius(float b, float phi) {
  if (phi > PHI_MAX) return FAR;
  float x = asinh((b - B_C) / LUT_W);
  float row = lutCoord((x - X_MIN) / (X_MAX - X_MIN), N_B);
  return texture(u_geodesic, vec2(lutCoord(phi / PHI_MAX, N_PHI), row)).r;
}

float deflection(float b) {
  float x = asinh((b - B_C) / LUT_W);
  return texture(u_deflect, vec2(lutCoord(x / D_X_MAX, N_D), 0.5)).r;
}

// ── colour ─────────────────────────────────────────────────────────────────
vec3 blackbody(float Tk) {
  float T = clamp(Tk, 1667.0, 25000.0);
  float T2 = T * T;
  float T3 = T2 * T;
  vec4 kx = T <= 4000.0 ? KXL : KXH;
  float x = kx.x / T3 + kx.y / T2 + kx.z / T + kx.w;
  vec4 ky = T <= 2222.0 ? KY1 : (T <= 4000.0 ? KY2 : KY3);
  float y = ky.x * x * x * x + ky.y * x * x + ky.z * x + ky.w;
  vec3 XYZ = vec3(x / y, 1.0, (1.0 - x - y) / y);
  vec3 rgb = max(vec3(dot(MR, XYZ), dot(MG, XYZ), dot(MB, XYZ)), 0.0);
  return rgb / max(max(rgb.r, rgb.g), max(rgb.b, 1e-6));
}

// ── disk matter (§7.3) ─────────────────────────────────────────────────────
float matterLayer(float lr, float psi, float seed) {
  vec2 uv = vec2(psi / TAU + seed, lr * 2.0 + seed * 0.37);
  float coarse = texture(u_matter, uv).r;
  float fine = texture(u_matter, uv * vec2(3.0, 4.0) + 0.5).r;
  return coarse * 0.65 + fine * 0.35;
}

float matter(float r, float psi) {
  float om = OMEGA_ISCO_VIS * pow(r / R_IN, -1.5);
  float lr = log(r / R_IN) / log(R_OUT / R_IN);
  float n0 = matterLayer(lr, psi + SPIN * om * u_flow.x, u_flow.z);
  float n1 = matterLayer(lr, psi + SPIN * om * u_flow.y, u_flow.w);
  float w0 = u_flow_w;
  float w1 = 1.0 - w0;
  float n = 0.5 + (w0 * (n0 - 0.5) + w1 * (n1 - 0.5)) * inversesqrt(w0 * w0 + w1 * w1);
  return clamp(n, 0.0, 1.0);
}

// ── disk emission (§7.3–7.4) ───────────────────────────────────────────────
vec3 diskEmission(float r, float psi, float b, float cosA) {
  float F = pow(r, -3.0) * (1.0 - sqrt(R_IN / r));
  float Fn = max(F, 0.0) / F_MAX;
  float om = sqrt(0.5 / (r * r * r));
  float onePlusZ = inversesqrt(1.0 - 1.5 / r) * (1.0 - SPIN * om * b * cosA * SIN_I);
  float g = 1.0 / max(onePlusZ, 0.05);
  float T = T_PEAK * pow(Fn, T_EXP) * g;
  float m = matter(r, psi);
  float I = g * g * g * g * Fn * pow(m, 1.6) * DISK_GAIN;
  return blackbody(T) * I;
}

// Primary (n = 0) then secondary (n = 1) disk-plane crossing (§7.2). The
// first crossing that lands on the disk wins: the disk is optically thick.
vec4 diskAt(float b, float cosA, float sinA, float shiftU, out float nHit) {
  nHit = -1.0;
  float bs = max(b + shiftU / R_S_U, 0.0);
  float phi0 = atan(COS_I, -sinA * SIN_I);
  for (int n = 0; n < 2; n++) {
    float phi = phi0 + float(n) * PI;
    float r = rayRadius(bs, phi);
    if (r >= R_IN && r <= R_OUT) {
      nHit = float(n);
      float sp = sin(phi);
      float cp = cos(phi);
      float psi = atan(sp * sinA * COS_I - cp * SIN_I, sp * cosA);
      return vec4(diskEmission(r, psi, bs, cosA), 1.0);
    }
  }
  return vec4(0.0);
}

// ── filaments (§7.5) ───────────────────────────────────────────────────────
vec2 lensSource(vec2 p) {
  vec2 q = p - CENTER;
  float rq = length(q);
  float b = rq / R_S_U;
  if (b <= B_C) return vec2(1.0e5);
  float taper = 1.0 - smoothstep(0.6 * R_FOUNDATION, R_FOUNDATION, rq);
  if (taper <= 0.0) return p;
  float beta = b - u_lens_d * deflection(b);
  return CENTER + (q / rq) * mix(b, beta, taper) * R_S_U;
}

float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 filament(vec2 src, vec2 A, vec2 B, vec3 cA, vec3 cB, float gain) {
  float h;
  float d = segDist(src, A, B, h);
  if (d > 30.0) return vec3(0.0);
  float core = exp(-d * d);
  float halo = exp(-(d * d) / 25.0);
  float pulse = 1.0 + 0.15 * sin(h * length(B - A) * 0.4 - u_time * 6.0);
  vec3 c = mix(cA, cB, h);
  return (c * (halo * 0.6 + core) + vec3(core * 0.8)) * pulse * gain;
}

vec3 seatDisc(vec2 p, vec2 S, vec3 c, float radius) {
  vec2 d = p - S;
  return c * exp(-dot(d, d) / (radius * radius)) * 1.2;
}

// ── infall sheath (§7.6): the envelope of the 2D particle streams ──────────
vec2 armPoint(float angDeg, float prog) {
  float r = R_SEAT * (1.0 - prog * prog * prog);
  float th = angDeg + SPIRAL_DEG * (1.0 - r / R_SEAT);
  float rad = radians(th - 90.0);
  return CENTER + r * vec2(cos(rad), sin(rad));
}

vec3 infallArm(vec2 p, vec2 seat, vec3 col) {
  float lead = clamp(u_phase_ms / T_INFALL, 0.0, 1.0);
  float trail = clamp((u_phase_ms - DELAY_MAX) / T_INFALL, 0.0, 1.0);
  if (lead <= 0.0) return vec3(0.0);
  vec2 q = p - CENTER;
  float rq = length(q);
  float rLead = R_SEAT * (1.0 - lead * lead * lead);
  float rTrail = R_SEAT * (1.0 - trail * trail * trail);
  if (rq < rLead - 30.0 || rq > rTrail + 30.0) return vec3(0.0);
  vec2 s0 = seat - CENTER;
  float ang = degrees(atan(s0.y, s0.x)) + 90.0;
  if (rq > 40.0) {
    float pixAng = degrees(atan(q.y, q.x)) + 90.0;
    float delta = mod(pixAng - ang + 540.0, 360.0) - 180.0;
    if (delta < -20.0 || delta > SPIRAL_DEG + 20.0) return vec3(0.0);
  }
  float best = 1.0e9;
  float bestProg = trail;
  vec2 prev = armPoint(ang, trail);
  for (int k = 1; k <= ARM_SEGMENTS; k++) {
    float p0 = mix(trail, lead, float(k - 1) / float(ARM_SEGMENTS));
    float p1 = mix(trail, lead, float(k) / float(ARM_SEGMENTS));
    vec2 cur = armPoint(ang, p1);
    float h;
    float d = segDist(p, prev, cur, h);
    if (d < best) { best = d; bestProg = mix(p0, p1, h); }
    prev = cur;
  }
  float rr = R_SEAT * (1.0 - bestProg * bestProg * bestProg);
  float spread = rr * radians(WOBBLE_DEG) * bestProg;
  float width = spread + 5.0;
  float glow = exp(-(best * best) / (width * width));
  float coreLine = exp(-(best * best) / (spread * spread + 1.0));
  vec2 hd = p - armPoint(ang, lead);
  float head = exp(-dot(hd, hd) / 36.0);
  return col * (glow * 0.55 + coreLine * 0.35) + vec3(head * 0.9);
}

// ── flash (§7.7) and jet (§7.8) ────────────────────────────────────────────
vec3 flashCore(float rq, float t) {
  float shift = 1.8 * (1.0 - t);
  float rc = B_C * R_S_U * (1.0 + 2.5 * t);
  float k = 6.0 * (1.0 - t) * (1.0 - t);
  float rr = rq + shift;
  float rb = max(rq - shift, 0.0);
  float c2 = rc * rc;
  return k * vec3(exp(-rr * rr / c2), exp(-rq * rq / c2), exp(-rb * rb / c2));
}

vec3 jet(vec2 p, float t) {
  vec2 ax = vec2(cos(u_eject.x), sin(u_eject.x));
  float L = u_eject.y * (1.0 - pow(1.0 - t, 3.0));
  float fade = pow(1.0 - t, 1.5);
  vec2 q = p - CENTER;
  vec3 acc = vec3(0.0);
  for (int side = 0; side < 2; side++) {
    vec2 axis = side == 0 ? ax : -ax;
    float gain = side == 0 ? 1.0 : COUNTER_JET;
    float s = dot(q, axis);
    if (s < -8.0 || s > L + 12.0) continue;
    float perp = length(q - axis * s);
    float w = max(s, 0.0) * tan(radians(3.0)) + 1.0;
    float body = sqrt(max(1.0 - max(s, 0.0) / max(L, 1e-3), 0.0)) * exp(-(perp * perp) / (w * w));
    vec2 hd = q - axis * L;
    float knot = exp(-dot(hd, hd) / 49.0);
    acc += gain * (u_eject_color * body + mix(u_eject_color, vec3(1.0), 0.7) * knot * 2.0);
  }
  return acc * fade;
}

// ── finish (§7.9) ──────────────────────────────────────────────────────────
float bayer4(vec2 fc) {
  ivec2 i = ivec2(mod(fc, 4.0));
  const float M4[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
                                 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (M4[i.x + i.y * 4] + 0.5) / 16.0;
}

vec2 ringToView(vec2 n) { return vec2(n.x * VIEW_W + VIEW_X0, (1.0 - n.y) * VIEW_H); }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x * VIEW_W + VIEW_X0, (1.0 - uv.y) * VIEW_H);
  vec2 q = p - CENTER;
  float rq = length(q);
  float b = rq / R_S_U;
  vec2 dir = rq > 1e-4 ? vec2(q.x, -q.y) / rq : vec2(1.0, 0.0); // image plane, +Y up

  int ph = u_anim_phase;
  float t = u_phase_t;
  float boost = 1.0;
  if (ph == 1) boost += 1.2 * t * u_intensity;
  else if (ph == 2 || ph == 3) boost += 1.2 * u_intensity;
  else if (ph == 4) boost += 1.2 * (1.0 - t) * u_intensity;

  vec3 disk = vec3(0.0);
  bool shadow = false;
  if (b < R_OUT + 1.0) {
    float nG;
    vec4 dG = diskAt(b, dir.x, dir.y, 0.0, nG);
    if (ph == 2 && u_intensity > 0.0) {
      float shift = 1.8 * (1.0 - t);
      float nR;
      float nB;
      vec4 dR = diskAt(b, dir.x, dir.y, shift, nR);
      vec4 dB = diskAt(b, dir.x, dir.y, -shift, nB);
      float flare = 1.0 + 8.0 * (1.0 - t) * (1.0 - t);
      disk = vec3(dR.r * (nR == 1.0 ? flare : 1.0),
                  dG.g * (nG == 1.0 ? flare : 1.0),
                  dB.b * (nB == 1.0 ? flare : 1.0));
    } else {
      disk = dG.rgb;
    }
    disk *= boost;
    shadow = dG.a < 0.5 && b < B_C;
  }

  vec3 fx = vec3(0.0);
  vec3 core = vec3(0.0);
  if (u_intensity > 0.0) {
    vec2 A = ringToView(u_seatA);
    vec2 B = ringToView(u_seatB);
    if (u_ui_mode == 1) {
      if (u_pointer_live > 0.5) fx += filament(lensSource(p), A, B, u_colorA, u_colorA, 1.0);
      float breathe = 9.0 * (1.0 + 0.3 * sin(u_time * 3.0));
      fx += seatDisc(p, A, u_colorA, u_pointer_live > 0.5 ? 9.0 : breathe);
    } else {
      float bridge = ph == 0 ? 1.0 : (ph == 1 ? 1.0 - smoothstep(0.0, 0.25, t) : 0.0);
      // AMBIENT has no static bridge before INFALL (IDLE draws nothing), so
      // the bridge fades in instead of popping to full at t = 0. FIRING's
      // static bridge precedes INFALL and is already continuous.
      if (u_ui_mode == 0 && ph == 1) bridge *= smoothstep(0.0, 0.04, t);
      if (bridge > 0.0) {
        fx += filament(lensSource(p), A, B, u_colorA, u_colorB, 1.8 * bridge);
        fx += (seatDisc(p, A, u_colorA, 9.0) + seatDisc(p, B, u_colorB, 9.0)) * bridge;
      }
      if (ph == 1) fx += infallArm(p, A, u_colorA) + infallArm(p, B, u_colorB);
      if (ph == 2) core = flashCore(rq, t);
      if (ph == 3) fx += jet(p, t);
    }
    fx *= u_intensity;
    core *= u_intensity;
  }

  vec3 emissive = shadow ? core : disk + fx + core;
  vec3 c = 1.0 - exp(-1.4 * emissive);
  c = pow(c, vec3(1.0 / 2.2));
  float a = shadow ? 1.0 : max(max(c.r, c.g), c.b);
  if (a > 0.0) c += (bayer4(gl_FragCoord.xy) - 0.5) / 255.0;
  c = clamp(c, 0.0, a);
  fragColor = vec4(c, a);
}
`;

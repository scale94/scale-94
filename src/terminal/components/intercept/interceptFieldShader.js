// The intercept lattice's felt layer (spec §7): trunk glow, ambient beads,
// node bloom, retention rings, the packet bead. Array sizes are interpolated
// from the model so the shader and the uniform buffers cannot drift.
// Coordinates are WorldMap viewBox units (800 × 400, y down).

import { TRUNKS, NODES } from '../../lib/interceptLattice';

const N_T = TRUNKS.length;
const N_N = NODES.length;

export const FIELD_UNIFORMS = ['u_resolution', 'u_time', 'u_trunks', 'u_trunkState', 'u_nodes', 'u_packet', 'u_marks'];

export const FIELD_VS = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

export const FIELD_FS = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_trunks[${N_T}];
uniform vec2 u_trunkState[${N_T}];
uniform vec4 u_nodes[${N_N}];
uniform vec4 u_packet;
uniform vec2 u_marks;

out vec4 outColor;

const vec3 INDIGO = vec3(0.388, 0.400, 0.945);
const vec3 CYAN   = vec3(0.133, 0.827, 0.933);
const vec3 AMBER  = vec3(0.984, 0.573, 0.235);
const vec3 RED    = vec3(0.937, 0.267, 0.267);
const vec3 BONE   = vec3(1.000, 0.953, 0.878);

vec3 heatColor(float h) {
  vec3 cool = mix(INDIGO, CYAN, 0.6);
  vec3 hot = mix(AMBER, RED, smoothstep(0.5, 1.0, h));
  return mix(cool, hot, smoothstep(0.0, 0.35, h));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x * 800.0, (1.0 - uv.y) * 400.0);
  float unit = 800.0 / u_resolution.x;
  vec3 col = vec3(0.0);

  for (int i = 0; i < ${N_T}; i++) {
    vec4 t = u_trunks[i];
    vec2 ab = t.zw - t.xy;
    float len = max(length(ab), 0.001);
    float s = clamp(dot(p - t.xy, ab) / (len * len), 0.0, 1.0);
    float d = length(p - (t.xy + ab * s));
    float heat = u_trunkState[i].x;
    float traced = u_trunkState[i].y;
    float w = 0.55 + unit;
    float core = exp(-(d * d) / (2.0 * w * w));
    float halo = exp(-d / (5.0 + 5.0 * heat)) * 0.10;
    float beads = 0.0;
    for (int k = 0; k < 3; k++) {
      float ph = fract(u_time * (26.0 / len) + float(k) / 3.0 + float(i) * 0.137);
      float bd = (s - ph) * len;
      beads += exp(-(bd * bd) / 6.0);
    }
    col += heatColor(heat) * (core * (0.28 + 0.35 * traced + 0.9 * beads) + halo);
  }

  for (int n = 0; n < ${N_N}; n++) {
    vec4 nd = u_nodes[n];
    float d = length(p - nd.xy);
    float r = 2.5 + 9.0 * nd.z;
    float bloom = exp(-(d * d) / (2.0 * r * r)) * (0.18 + 0.7 * nd.z);
    float ring = nd.w * exp(-((d - 7.0) * (d - 7.0)) / 1.6) * 0.55;
    col += heatColor(nd.z) * bloom + AMBER * ring;
  }

  if (u_packet.z > 0.0) {
    float d = length(p - u_packet.xy);
    float pulse = u_marks.y > 0.5 ? 0.72 + 0.28 * sin(u_time * 5.0) : 1.0;
    float bead = exp(-(d * d) / 6.5) * 1.6 * pulse;
    float shell = u_packet.w > 0.5 ? exp(-((d - 4.0) * (d - 4.0)) / 1.2) * 0.9 : 0.0;
    float glyph = u_marks.x > 0.5 ? exp(-length(p - u_packet.xy - vec2(5.0, -5.0)) * 1.4) * 0.9 : 0.0;
    col += BONE * (bead + shell + glyph) * u_packet.z;
  }

  // Premultiplied output: every channel is <= alpha by construction.
  vec3 c = 1.0 - exp(-col);
  float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  outColor = vec4(c, a);
}
`;

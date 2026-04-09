import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── GLSL ───────────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uTurbulence;
  uniform float uFlameWidth;
  uniform float uPointSizeMax;

  attribute float aPhase;     // per-particle lifecycle offset [0,1)
  attribute float aSpeed;     // per-particle speed multiplier [0,1]
  attribute float aSeed;      // spawn position seed [0,1]
  attribute float aSize;      // base screen size [0,1] → 0–5 px
  attribute float aTemp;      // inherent temperature bias [0,1]
  attribute float aEmber;     // 0 = flame, 1 = ember (flies sideways)

  varying float vAge;
  varying float vTemp;
  varying float vAlpha;

  // ── Simplex noise (Stefan Gustavson) ────────────────────────────────────
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4  j  = p - 49.0 * floor(p * ns.z * ns.z);
    vec4  x_ = floor(j * ns.z);
    vec4  y_ = floor(j - 7.0 * x_);
    vec4  x  = x_ * ns.x + ns.yyyy;
    vec4  y  = y_ * ns.x + ns.yyyy;
    vec4  h  = 1.0 - abs(x) - abs(y);
    vec4  b0 = vec4(x.xy, y.xy);
    vec4  b1 = vec4(x.zw, y.zw);
    vec4  s0 = floor(b0)*2.0+1.0;
    vec4  s1 = floor(b1)*2.0+1.0;
    vec4  sh = -step(h, vec4(0.0));
    vec4  a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4  a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3  p0 = vec3(a0.xy, h.x);
    vec3  p1 = vec3(a0.zw, h.y);
    vec3  p2 = vec3(a1.xy, h.z);
    vec3  p3 = vec3(a1.zw, h.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314*
                vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m = m*m;
    return 42.0*dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  // ── Curl noise (divergence-free turbulence) ──────────────────────────────
  vec3 curlNoise(vec3 p){
    const float e = 0.07;
    float nx1 = snoise(p + vec3(e,0,0)), nx2 = snoise(p - vec3(e,0,0));
    float ny1 = snoise(p + vec3(0,e,0)), ny2 = snoise(p - vec3(0,e,0));
    float nz1 = snoise(p + vec3(0,0,e)), nz2 = snoise(p - vec3(0,0,e));
    return vec3(
      (ny1-ny2)-(nz1-nz2),
      (nz1-nz2)-(nx1-nx2),
      (nx1-nx2)-(ny1-ny2)
    ) / (2.0*e);
  }

  void main(){
    // Per-particle lifecycle: age 0 = newborn at base, 1 = ash at tip
    float lifeMult = 0.4 + aSpeed * 0.6;
    float age = fract(aPhase + uTime * uSpeed * lifeMult);
    vAge = age;

    // ── Spawn: uniform disk via sqrt for even area distribution ─────────
    float spawnR     = sqrt(aSeed) * uFlameWidth;
    float spawnAngle = fract(aSeed * 6.3791 + 0.17) * 6.28318;
    float sx = spawnR * cos(spawnAngle);
    float sz = spawnR * sin(spawnAngle);

    // ── Flame particles: rise with tapering cone shape ───────────────────
    // Embers: drift sideways and upward, escaping the cone
    float riseSpeed  = mix(2.4, 3.5, aTemp);   // hot particles rise faster
    float riseY      = age * riseSpeed;
    float taper      = max(0.0, 1.0 - age * 1.35);  // cone narrows to a tip
    float emberDrift = aEmber * age * 1.8;

    // Ember lateral escape direction encoded in aSeed
    float escapeAngle = fract(aSeed * 9.137 + 0.43) * 6.28318;
    float ex = cos(escapeAngle) * emberDrift;
    float ez = sin(escapeAngle) * emberDrift;

    vec3 pos = vec3(
      sx * taper + ex,
      -1.1 + riseY,
      sz * taper + ez
    );

    // ── Multi-octave turbulence (bell-shaped — peaks at mid-flame) ───────
    float turbEnvelope = sin(age * 3.14159) * uTurbulence;  // zero at birth/death
    float t = uTime * 0.16;
    vec3 curl1 = curlNoise(pos * 1.3 + vec3(t,         t*0.7, t*0.5));
    vec3 curl2 = curlNoise(pos * 2.8 + vec3(t*1.4+3.1, t*1.1, t*0.9+1.7)) * 0.4;
    pos += (curl1 + curl2) * turbEnvelope * 0.45;

    // ── Fine thermal shimmer ─────────────────────────────────────────────
    float st = uTime * 1.0;
    pos.x += snoise(pos * 5.5 + vec3(st,   0.0,  0.0)) * 0.035;
    pos.z += snoise(pos * 5.5 + vec3(0.0,  0.0,  st*1.1)) * 0.035;
    pos.y += snoise(pos * 4.0 + vec3(0.0,  st*0.7, 0.0)) * 0.02;

    // ── Temperature: hottest at base center, cools as it rises ──────────
    float coreProx = max(0.0, 1.0 - (spawnR / uFlameWidth));
    float rawTemp  = (1.0 - age) * (0.5 + coreProx * 0.5) + aTemp * 0.15;
    vTemp = clamp(rawTemp, 0.0, 1.0);

    // ── Alpha: fade in and out, embers fade slower ───────────────────────
    float fadeIn  = smoothstep(0.0, 0.06, age);
    float fadeOut = 1.0 - smoothstep(mix(0.72, 0.88, aEmber), 1.0, age);
    vAlpha = fadeIn * fadeOut;

    // ── Point size: 0–5 px screen-space range ───────────────────────────
    // aSize [0,1] maps to 0–5 base units; shrinks as particle ages
    float baseSize   = aSize * 5.0;
    float sizeFactor = max(0.1, 1.0 - age * 0.7);
    // Embers stay small; flame particles can be large near base
    float emberShrink = mix(1.0, 0.5, aEmber);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    float depth  = max(-mvPos.z, 0.5);
    gl_PointSize = min(baseSize * sizeFactor * emberShrink * (80.0 / depth), uPointSizeMax);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vAge;
  varying float vTemp;
  varying float vAlpha;

  void main(){
    // Circular soft sprite — clamp PointCoord for mobile driver safety
    vec2  pc    = clamp(gl_PointCoord, vec2(0.0), vec2(1.0));
    float d     = length(pc - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.1, 1.0, d);
    if (alpha < 0.004) discard;

    // ── Full blackbody radiation spectrum ────────────────────────────────
    // t=0 → blue-white plasma  |  t=1 → cold dark ash
    // Stops: blue-white, white, yellow-white, yellow, orange, red, crimson, dark, ash
    float t = 1.0 - clamp(vTemp, 0.0, 1.0);

    // Hot particles are saturated yellow/orange (NOT white).
    // White core appears from additive accumulation only.
    vec3 col;
    if (t < 0.18) {
      col = mix(vec3(1.00, 0.82, 0.10), vec3(1.00, 0.60, 0.05), t / 0.18);
    } else if (t < 0.38) {
      col = mix(vec3(1.00, 0.60, 0.05), vec3(1.00, 0.30, 0.02), (t-0.18)/0.20);
    } else if (t < 0.58) {
      col = mix(vec3(1.00, 0.30, 0.02), vec3(0.75, 0.06, 0.01), (t-0.38)/0.20);
    } else if (t < 0.75) {
      col = mix(vec3(0.75, 0.06, 0.01), vec3(0.38, 0.01, 0.01), (t-0.58)/0.17);
    } else if (t < 0.90) {
      col = mix(vec3(0.38, 0.01, 0.01), vec3(0.09, 0.004, 0.002), (t-0.75)/0.15);
    } else {
      col = mix(vec3(0.09, 0.004, 0.002), vec3(0.035, 0.022, 0.018), (t-0.90)/0.10);
    }

    if (any(isnan(col)) || any(isinf(col))) discard;
    // Additive blending: accumulation of many particles IS the glow.
    // Keep per-particle contribution tiny so the color ramp shows through.
    float finalAlpha = alpha * vAlpha * (0.006 + vTemp * 0.012);
    gl_FragColor = vec4(col, finalAlpha * uOpacity);
  }
`;

// ── Buffer init ────────────────────────────────────────────────────────────
function buildBuffers(count) {
  // Reserve 15% for ember-type particles
  const emberCutoff = 0.85;

  const positions = new Float32Array(count * 3);
  const phases    = new Float32Array(count);
  const speeds    = new Float32Array(count);
  const seeds     = new Float32Array(count);
  const sizes     = new Float32Array(count);
  const temps     = new Float32Array(count);
  const embers    = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    positions[i * 3]     = (Math.random() * 2 - 1) * 0.9;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.5;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * 0.9;
    phases[i]  = Math.random();
    speeds[i]  = Math.random();
    seeds[i]   = Math.random();
    // Skew sizes: many tiny (0–2px), fewer large (2–5px)
    sizes[i]   = Math.pow(Math.random(), 1.4);
    temps[i]   = Math.random();
    embers[i]  = r > emberCutoff ? 1.0 : 0.0;
  }
  return { positions, phases, speeds, seeds, sizes, temps, embers };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ThermalFlow({
  isMobile          = false,
  speed             = 0.13,
  turbulence        = 0.40,
  flameWidth        = 0.85,
  density           = null,
  onFps             = null,
  opacityMultiplier = 1,
}) {
  const PARTICLE_COUNT = density ?? (isMobile ? 4000 : 10000);
  const materialRef = useRef();
  const fpsFrames   = useRef(0);
  const fpsTime     = useRef(0);

  const buffers = useMemo(() => buildBuffers(PARTICLE_COUNT), [PARTICLE_COUNT]);

  useFrame((_, delta) => {
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uTime.value       += delta;
      mat.uniforms.uSpeed.value       = speed;
      mat.uniforms.uTurbulence.value  = turbulence;
      mat.uniforms.uFlameWidth.value  = flameWidth;
      mat.uniforms.uOpacity.value     = opacityMultiplier;
    }
    if (onFps) {
      fpsFrames.current++;
      fpsTime.current += delta;
      if (fpsTime.current >= 1) {
        onFps(Math.round(fpsFrames.current / fpsTime.current));
        fpsFrames.current = 0;
        fpsTime.current   = 0;
      }
    }
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry key={PARTICLE_COUNT}>
        <bufferAttribute attach="attributes-position" array={buffers.positions} count={PARTICLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aPhase"   array={buffers.phases}    count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aSpeed"   array={buffers.speeds}    count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aSeed"    array={buffers.seeds}     count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aSize"    array={buffers.sizes}     count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aTemp"    array={buffers.temps}     count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aEmber"   array={buffers.embers}    count={PARTICLE_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime:         { value: Math.random() * 120 },
          uSpeed:        { value: speed },
          uTurbulence:   { value: turbulence },
          uFlameWidth:   { value: flameWidth },
          uPointSizeMax: { value: isMobile ? 32.0 : 64.0 },
          uOpacity:      { value: opacityMultiplier },
        }}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

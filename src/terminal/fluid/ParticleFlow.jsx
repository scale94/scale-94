import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Torus Knot parametric helpers ──────────────────────────────────────────
// p=2, q=3 trefoil knot. Returns centerline point at parameter t ∈ [0, 1].
function knotPoint(t, R = 1, r = 0.4) {
  const phi = t * Math.PI * 2;
  const p = 2, q = 3;
  const x = (R + r * Math.cos(q * phi)) * Math.cos(p * phi);
  const y = (R + r * Math.cos(q * phi)) * Math.sin(p * phi);
  const z = r * Math.sin(q * phi);
  return [x, y, z];
}

// Tangent via finite difference (normalized)
function knotTangent(t, R = 1, r = 0.4) {
  const dt = 0.0001;
  const [ax, ay, az] = knotPoint(t, R, r);
  const [bx, by, bz] = knotPoint(t + dt, R, r);
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  return [dx / len, dy / len, dz / len];
}

// ── GLSL Shaders ───────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  attribute float aPhase;
  attribute float aRadius;
  attribute float aOffset;
  varying float vSpeed;
  varying float vLife;

  //
  // 3D simplex noise (Stefan Gustavson)
  //
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec3 v){
    const vec2  C = vec2(1.0/6.0, 1.0/3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x  = x_ * ns.x + ns.yyyy;
    vec4 y  = y_ * ns.x + ns.yyyy;
    vec4 h  = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
                vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  // Curl noise — divergence-free 3D field from simplex noise
  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    float n1 = snoise(p + vec3(e, 0, 0));
    float n2 = snoise(p - vec3(e, 0, 0));
    float n3 = snoise(p + vec3(0, e, 0));
    float n4 = snoise(p - vec3(0, e, 0));
    float n5 = snoise(p + vec3(0, 0, e));
    float n6 = snoise(p - vec3(0, 0, e));
    float x = (n4 - n3) - (n6 - n5);
    float y = (n6 - n5) - (n2 - n1);
    float z = (n2 - n1) - (n4 - n3);
    return normalize(vec3(x, y, z)) * 0.5;
  }

  // Torus knot centerline (p=2, q=3)
  vec3 knotCenter(float t) {
    float phi = t * 6.283185307;
    float R = 1.0;
    float r = 0.4;
    float cp = cos(2.0 * phi);
    float sp = sin(2.0 * phi);
    float cq = cos(3.0 * phi);
    float sq = sin(3.0 * phi);
    return vec3((R + r * cq) * cp, (R + r * cq) * sp, r * sq);
  }

  void main() {
    // Advance parametric position along knot
    float t = fract(aPhase + uTime * uSpeed * (0.6 + aOffset * 0.4));

    // Centerline position
    vec3 center = knotCenter(t);

    // Tangent via finite difference
    vec3 tangent = normalize(knotCenter(t + 0.001) - center);

    // Build a local frame (Frenet-like)
    vec3 up = abs(tangent.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    vec3 normal = normalize(cross(tangent, up));
    vec3 binormal = cross(tangent, normal);

    // Offset inside tube — spiral with curl noise perturbation
    float angle = aOffset * 6.283185307 + uTime * 0.5;
    float rad = aRadius * 0.32; // max ~0.32, tube radius is 0.4
    vec3 localOffset = normal * cos(angle) * rad + binormal * sin(angle) * rad;

    // Add curl noise turbulence
    vec3 curl = curlNoise(center * 2.0 + uTime * 0.15) * 0.06;

    vec3 pos = center + localOffset + curl;

    // Velocity proxy — how much curl noise displaces this particle
    vSpeed = length(curl) * 10.0 + aOffset * 0.3;
    vLife = aPhase;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (3.0 + aRadius * 3.0) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vSpeed;
  varying float vLife;

  void main() {
    // Soft radial Gaussian sprite
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = exp(-d * d * 3.0);
    if (alpha < 0.01) discard;

    // Bioluminescent gradient: magenta → violet → cyan
    vec3 magenta = vec3(1.0, 0.0, 0.667);   // #ff00aa
    vec3 violet  = vec3(0.533, 0.267, 1.0);  // #8844ff
    vec3 cyan    = vec3(0.0, 1.0, 0.8);      // #00ffcc

    float t = clamp(vSpeed, 0.0, 1.0);
    vec3 color = t < 0.5
      ? mix(magenta, violet, t * 2.0)
      : mix(violet, cyan, (t - 0.5) * 2.0);

    // Slight brightness variation by phase
    color *= 0.8 + 0.4 * sin(vLife * 6.283185307);

    gl_FragColor = vec4(color, alpha * 0.85);
  }
`;

// ── Component ──────────────────────────────────────────────────────────────
const PARTICLE_COUNT_DESKTOP = 10000;
const PARTICLE_COUNT_MOBILE  = 4000;

export default function ParticleFlow({ isMobile = false }) {
  const PARTICLE_COUNT = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
  const meshRef = useRef();
  const materialRef = useRef();

  // Build particle attribute buffers once
  const { positions, phases, radii, offsets } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const phases    = new Float32Array(PARTICLE_COUNT);
    const radii     = new Float32Array(PARTICLE_COUNT);
    const offsets   = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = Math.random();
      const [x, y, z] = knotPoint(t);
      positions[i * 3]     = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      phases[i]  = t;
      radii[i]   = Math.random();
      offsets[i]  = Math.random();
    }

    return { positions, phases, radii, offsets };
  }, [PARTICLE_COUNT]);

  // Advance time uniform each frame
  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <points ref={meshRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={PARTICLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aPhase"    array={phases}    count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aRadius"   array={radii}     count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aOffset"   array={offsets}   count={PARTICLE_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime:  { value: 0 },
          uSpeed: { value: 0.08 },
        }}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

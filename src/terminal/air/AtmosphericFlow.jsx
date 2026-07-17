import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── GLSL ───────────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uOrbitalSpeed;
  uniform float uTurbulence;
  uniform float uSpread;
  uniform float uCondense;
  uniform float uCondenseSizeBite;

  attribute float aPhase;    // orbit phase offset [0,1)
  attribute float aSpeed;    // per-particle speed multiplier [0,1]
  attribute float aSeed;     // seed [0,1]
  attribute float aSize;     // base screen size [0,1] → 0–5 px
  attribute float aAlt;      // altitude layer [0,1]
  attribute float aIon;      // 0=atmosphere, 1=ionospheric fast layer

  varying float vAltitude;
  varying float vSpeed;
  varying float vIon;

  // ── Simplex noise (Gustavson) ────────────────────────────────────────────
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x,289.0); }
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i =floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g =step(x0.yzx,x0.xyz);
    vec3 l =1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod(i,289.0);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=1.0/7.0;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=1.79284291400159-0.85373472095314*
      vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  vec3 curlNoise(vec3 p){
    const float e=0.07;
    float nx1=snoise(p+vec3(e,0,0)),nx2=snoise(p-vec3(e,0,0));
    float ny1=snoise(p+vec3(0,e,0)),ny2=snoise(p-vec3(0,e,0));
    float nz1=snoise(p+vec3(0,0,e)),nz2=snoise(p-vec3(0,0,e));
    return vec3((ny1-ny2)-(nz1-nz2),(nz1-nz2)-(nx1-nx2),(nx1-nx2)-(ny1-ny2))/(2.0*e);
  }

  void main(){
    // ── Cyclone / helical orbit ──────────────────────────────────────────
    // Orbital radius: widest at mid-altitude (eye-wall), narrows at base and top
    float altSq       = aAlt * aAlt;
    float eyeWall     = sin(aAlt * 3.14159);           // peaks at mid-altitude
    float baseRadius  = (0.15 + eyeWall * 1.1) * uSpread;

    // Ionosphere particles orbit faster at larger radius
    float ionRadius   = 1.35 * uSpread;
    float radius      = mix(baseRadius, ionRadius, aIon);

    // Orbit height spans full geode
    float orbitHeight = -1.2 + aAlt * 2.5;

    // Contra-rotating layers: lower half CW, upper half CCW (realistic cyclone)
    float direction  = aAlt > 0.5 ? 1.0 : -0.85;
    float ionSpeedMult = mix(1.0, 2.8, aIon); // ionosphere is fast
    float orbitSpeed = uOrbitalSpeed * (0.4 + aSpeed * 0.7) * direction * ionSpeedMult;
    float angle      = aPhase * 6.28318 + uTime * orbitSpeed;

    vec3 pos = vec3(
      cos(angle) * radius,
      orbitHeight + snoise(vec3(angle * 0.25, uTime * 0.07, aAlt * 4.0)) * 0.15,
      sin(angle) * radius
    );

    // ── Atmospheric eddies (slow curl turbulence) ────────────────────────
    float t = uTime * 0.08;
    vec3 curl = curlNoise(pos * 0.9 + vec3(t, t * 0.6, t * 0.8));
    pos += curl * uTurbulence * 0.3;

    // Fine molecular shimmer
    float st = uTime * 0.6;
    pos.x += snoise(pos * 5.0 + vec3(st, 0.0, aPhase)) * 0.03;
    pos.z += snoise(pos * 5.0 + vec3(aPhase, 0.0, st * 1.1)) * 0.03;

    // Altitude from actual height + inherent layer
    float normY   = clamp((pos.y + 1.2) / 2.5, 0.0, 1.0);
    vAltitude = mix(aAlt, normY, 0.35);
    vSpeed    = aSpeed;
    vIon      = aIon;

    // Air particles barely shrink — they persist at full size
    float baseSize = aSize * 5.0;

    // Nebula condensation — see ParticleFlow.jsx for the physics note.
    pos *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vAltitude;
  varying float vSpeed;
  varying float vIon;

  void main(){
    float d = length(gl_PointCoord - 0.5) * 2.0;
    // Very soft — air has no hard edges
    float alpha = smoothstep(1.0, 0.0, d);
    if (alpha < 0.003) discard;

    // ── 8-stop atmospheric spectrum ───────────────────────────────────────
    // vAltitude: 0=deep/dark, 1=high/bright
    float t = clamp(vAltitude, 0.0, 1.0);
    vec3 col;

    if (t < 0.12) {
      col = mix(vec3(0.04, 0.06, 0.10), vec3(0.05, 0.13, 0.25), t/0.12);         // near-space → midnight blue
    } else if (t < 0.25) {
      col = mix(vec3(0.05, 0.13, 0.25), vec3(0.10, 0.29, 0.50), (t-0.12)/0.13);  // midnight → deep blue
    } else if (t < 0.40) {
      col = mix(vec3(0.10, 0.29, 0.50), vec3(0.18, 0.48, 0.75), (t-0.25)/0.15);  // deep blue → stratosphere
    } else if (t < 0.55) {
      col = mix(vec3(0.18, 0.48, 0.75), vec3(0.36, 0.64, 0.85), (t-0.40)/0.15);  // stratosphere → sky blue
    } else if (t < 0.68) {
      col = mix(vec3(0.36, 0.64, 0.85), vec3(0.60, 0.78, 0.92), (t-0.55)/0.13);  // sky → azure
    } else if (t < 0.80) {
      col = mix(vec3(0.60, 0.78, 0.92), vec3(0.82, 0.91, 0.97), (t-0.68)/0.12);  // azure → pale blue
    } else if (t < 0.92) {
      col = mix(vec3(0.82, 0.91, 0.97), vec3(0.93, 0.96, 0.99), (t-0.80)/0.12);  // cloud white-blue
    } else {
      col = mix(vec3(0.93, 0.96, 0.99), vec3(0.97, 0.98, 1.00), (t-0.92)/0.08);  // mist → white
    }

    // Ionospheric override: electric blue-white glow
    vec3 ionColor = mix(vec3(0.33, 0.53, 1.00), vec3(0.67, 0.80, 1.00), vSpeed);
    col = mix(col, ionColor, vIon);

    // Brightness: scaled down so 10k additive particles don't stack to white
    float glow = 0.35 + vAltitude * 0.45 + vIon * 0.55;
    col *= glow;

    // Soft outer halo — reduced to avoid compound bloom
    float halo = smoothstep(0.9, 0.0, d) * (vAltitude * 0.2 + vIon * 0.35);
    col += col * halo * 0.3;

    // Alpha: deep layers very faint, only high-altitude / ionosphere reads clearly
    float alphaScale = 0.05 + vAltitude * 0.28 + vIon * 0.22;
    gl_FragColor = vec4(col, alpha * alphaScale * uOpacity);
  }
`;

// ── Buffer init ────────────────────────────────────────────────────────────
function buildBuffers(count) {
  const ionFraction = 0.08;

  const positions = new Float32Array(count * 3);
  const phases    = new Float32Array(count);
  const speeds    = new Float32Array(count);
  const seeds     = new Float32Array(count);
  const sizes     = new Float32Array(count);
  const alts      = new Float32Array(count);
  const ions      = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() * 2 - 1) * 1.2;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.2;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * 1.2;
    phases[i]  = Math.random();
    speeds[i]  = Math.random();
    seeds[i]   = Math.random();
    // Air particles are mostly tiny (molecules), skewed very small
    sizes[i]   = Math.pow(Math.random(), 1.6);
    // Altitude distributed across all layers, slight bias toward mid
    alts[i]    = Math.random();
    ions[i]    = Math.random() < ionFraction ? 1.0 : 0.0;
  }
  return { positions, phases, speeds, seeds, sizes, alts, ions };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AtmosphericFlow({
  isMobile          = false,
  orbitalSpeed      = 1.2,
  turbulence        = 0.18,
  spread            = 1.0,
  density           = null,
  onFps             = null,
  opacityMultiplier = 1,
  condense = 0,
  condenseSizeBite = 0.6,
  blending = THREE.AdditiveBlending,
}) {
  const PARTICLE_COUNT = density ?? (isMobile ? 4000 : 10000);
  const materialRef = useRef();
  const fpsFrames   = useRef(0);
  const fpsTime     = useRef(0);

  const buffers = useMemo(() => buildBuffers(PARTICLE_COUNT), [PARTICLE_COUNT]);

  // Created ONCE — see ParticleFlow.jsx for the stale-upload-bond note.
  const [uniforms] = useState(() => ({
    uTime:         { value: Math.random() * 100 },
    uOrbitalSpeed: { value: orbitalSpeed },
    uTurbulence:   { value: turbulence },
    uSpread:       { value: spread },
    uOpacity:      { value: opacityMultiplier },
    uCondense:         { value: condense },
    uCondenseSizeBite: { value: condenseSizeBite },
  }));

  useFrame((_, delta) => {
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uTime.value         += delta;
      mat.uniforms.uOrbitalSpeed.value  = orbitalSpeed;
      mat.uniforms.uTurbulence.value    = turbulence;
      mat.uniforms.uSpread.value        = spread;
      mat.uniforms.uOpacity.value       = opacityMultiplier;
      mat.uniforms.uCondense.value         = condense;
      mat.uniforms.uCondenseSizeBite.value = condenseSizeBite;
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
        <bufferAttribute attach="attributes-aAlt"     array={buffers.alts}      count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aIon"     array={buffers.ions}      count={PARTICLE_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        blending={blending}
        depthWrite={false}
      />
    </points>
  );
}

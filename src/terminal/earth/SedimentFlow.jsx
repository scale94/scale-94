import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── GLSL ───────────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uTurbulence;
  uniform float uEruptStrength;
  uniform float uCondense;
  uniform float uCondenseSizeBite;

  attribute float aPhase;    // lifecycle offset [0,1)
  attribute float aSpeed;    // per-particle speed [0,1]
  attribute float aSeed;     // spawn seed [0,1]
  attribute float aSize;     // base screen size [0,1] → 0–5 px
  attribute float aMass;     // geological mass [0,1] (heavy=sinks=dark, light=floats=pale)
  attribute float aErupt;    // 0=sediment, 1=eruption particle

  varying float vStrata;     // 0=chalk surface, 1=obsidian deep
  varying float vAlpha;

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
    // Per-particle lifecycle
    float lifeMult = 0.5 + aSpeed * 0.5;
    float age = fract(aPhase + uTime * uSpeed * lifeMult);

    // Spawn on sphere surface (uniform distribution via spherical coords)
    float theta  = fract(aSeed * 3.9301) * 3.14159;
    float phi    = fract(aSeed * 7.1731) * 6.28318;
    float spawnX = sin(theta) * cos(phi) * 1.1;
    float spawnY = cos(theta) * 1.1;
    float spawnZ = sin(theta) * sin(phi) * 1.1;
    vec3 spawnPos = vec3(spawnX, spawnY, spawnZ);

    // ── Sediment particles: drift toward base under mass ─────────────────
    // Heavy particles sink faster; light ones stay higher
    float sinkRate   = aMass * 2.2 * uSpeed;
    float sinkOffset = fract(aPhase + uTime * sinkRate * 0.4);
    // Y oscillates from spawn height downward, then resets
    float settledY   = spawnY - sinkOffset * 2.4;

    vec3 pos = vec3(spawnX, settledY, spawnZ);

    // ── Eruption particles: shoot upward then arc back ───────────────────
    float eruptY   = -1.2 + sin(age * 3.14159) * 2.5 * uEruptStrength;
    float eruptR   = fract(aSeed * 5.713) * 0.5;
    float eruptAng = fract(aSeed * 2.391) * 6.28318;
    vec3 eruptPos  = vec3(cos(eruptAng)*eruptR, eruptY, sin(eruptAng)*eruptR);

    pos = mix(pos, eruptPos, aErupt);

    // ── Slow geological turbulence ────────────────────────────────────────
    float t = uTime * 0.06; // very slow
    vec3 curl = curlNoise(pos * 1.0 + vec3(t, t*0.7, t*0.5));
    pos += curl * uTurbulence * 0.35;

    // Fine granular shimmer
    float st = uTime * 0.5;
    pos.x += snoise(pos*6.0 + vec3(st, 0.0, 0.0)) * 0.025;
    pos.z += snoise(pos*6.0 + vec3(0.0, 0.0, st)) * 0.025;

    // Normalize height to [0,1] for stratum mapping
    float normY    = clamp((pos.y + 1.5) / 3.0, 0.0, 1.0);
    float massStrat = aMass;
    // Mix: heavy mass pulls to dark deep strata; height also contributes
    vStrata = mix(massStrat, 1.0 - normY, 0.4);
    vStrata = clamp(vStrata, 0.0, 1.0);

    // Eruption particles are hot terra cotta / sandstone color
    float eruptStrat = 0.35; // sandstone-ochre range
    vStrata = mix(vStrata, eruptStrat, aErupt * sin(age * 3.14159));

    vAlpha = smoothstep(0.0, 0.07, age) * smoothstep(1.0, 0.78, age);

    // Size: 0–5px, large for heavy chunks, small for fine dust
    float baseSize   = aSize * 5.0;
    float ageFactor  = max(0.15, 1.0 - age * 0.45);

    // Nebula condensation — see ParticleFlow.jsx for the physics note.
    pos *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = baseSize * ageFactor * (280.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vStrata;
  varying float vAlpha;

  void main(){
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.15, d);
    if (alpha < 0.004) discard;

    // ── 8-stop geological spectrum ────────────────────────────────────────
    // vStrata: 0=pale chalk surface, 1=dark obsidian mantle
    float t = clamp(vStrata, 0.0, 1.0);
    vec3 col;

    if (t < 0.12) {
      col = mix(vec3(0.91, 0.87, 0.78), vec3(0.72, 0.66, 0.53), t/0.12);       // chalk → limestone
    } else if (t < 0.26) {
      col = mix(vec3(0.72, 0.66, 0.53), vec3(0.83, 0.56, 0.35), (t-0.12)/0.14); // limestone → sandstone
    } else if (t < 0.40) {
      col = mix(vec3(0.83, 0.56, 0.35), vec3(0.75, 0.41, 0.13), (t-0.26)/0.14); // sandstone → ochre
    } else if (t < 0.53) {
      col = mix(vec3(0.75, 0.41, 0.13), vec3(0.67, 0.27, 0.13), (t-0.40)/0.13); // ochre → clay
    } else if (t < 0.66) {
      col = mix(vec3(0.67, 0.27, 0.13), vec3(0.53, 0.13, 0.07), (t-0.53)/0.13); // clay → terra cotta
    } else if (t < 0.78) {
      col = mix(vec3(0.53, 0.13, 0.07), vec3(0.22, 0.19, 0.19), (t-0.66)/0.12); // terra → basalt
    } else if (t < 0.90) {
      col = mix(vec3(0.22, 0.19, 0.19), vec3(0.07, 0.06, 0.06), (t-0.78)/0.12); // basalt → obsidian
    } else {
      col = mix(vec3(0.07, 0.06, 0.06), vec3(0.03, 0.03, 0.04), (t-0.90)/0.10); // deep void
    }

    // Surface minerals are brighter; deep rock is dim
    float glow = 0.6 + (1.0 - vStrata) * 0.9;
    col *= glow;

    // Subtle mineral shimmer highlight at the core
    float sparkle = smoothstep(0.4, 0.0, d) * (1.0 - vStrata) * 1.2;
    col += vec3(sparkle * 0.5, sparkle * 0.4, sparkle * 0.2);

    gl_FragColor = vec4(col, alpha * vAlpha * (0.5 + (1.0 - vStrata) * 0.4) * uOpacity);
  }
`;

// ── Buffer init ────────────────────────────────────────────────────────────
function buildBuffers(count) {
  const eruption = 0.10; // 10% eruption particles

  const positions = new Float32Array(count * 3);
  const phases    = new Float32Array(count);
  const speeds    = new Float32Array(count);
  const seeds     = new Float32Array(count);
  const sizes     = new Float32Array(count);
  const masses    = new Float32Array(count);
  const erupts    = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() * 2 - 1) * 1.1;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * 1.1;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * 1.1;
    phases[i]  = Math.random();
    speeds[i]  = Math.random();
    seeds[i]   = Math.random();
    // Skewed toward small (more fine dust than large boulders)
    sizes[i]   = Math.pow(Math.random(), 1.3);
    // Mass: bimodal — mostly heavy-ish sediment with some light surface dust
    masses[i]  = Math.random() < 0.2 ? Math.random() * 0.3 : 0.4 + Math.random() * 0.6;
    erupts[i]  = Math.random() < eruption ? 1.0 : 0.0;
  }
  return { positions, phases, speeds, seeds, sizes, masses, erupts };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SedimentFlow({
  isMobile          = false,
  speed             = 0.08,
  turbulence        = 0.25,
  eruptStrength     = 0.8,
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
    uTime:          { value: Math.random() * 100 },
    uSpeed:         { value: speed },
    uTurbulence:    { value: turbulence },
    uEruptStrength: { value: eruptStrength },
    uOpacity:       { value: opacityMultiplier },
    uCondense:         { value: condense },
    uCondenseSizeBite: { value: condenseSizeBite },
  }));

  useFrame((_, delta) => {
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uTime.value          += delta;
      mat.uniforms.uSpeed.value          = speed;
      mat.uniforms.uTurbulence.value     = turbulence;
      mat.uniforms.uEruptStrength.value  = eruptStrength;
      mat.uniforms.uOpacity.value        = opacityMultiplier;
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
        <bufferAttribute attach="attributes-aMass"    array={buffers.masses}    count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aErupt"   array={buffers.erupts}    count={PARTICLE_COUNT} itemSize={1} />
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

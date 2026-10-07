import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_WINDOW_VS, PLANET_WINDOW_FS } from '../mercury/planet/planetWindow';
import { R_SCENE, PLANET_TUNE } from '../mercury/planet/planetLook';
import { AETHER_LIGHT_VS, aetherLightFS } from '../mercury/planet/aetherLight';
import { SUN_DIR_WORLD } from '../mercury/planet/planetFrame';
import { GAS_STREAK_VS, GAS_STREAK_FS, GAS_TUNE_UNIFORMS, writeGasTune, gasPointMax } from '../mercury/planet/gasStreak';
import { createAetherClock, configureAetherClock, tickAetherClock } from '../mercury/planet/aetherClock';
import {
  buildBuffers, AIR_TILT_MIN, AIR_TILT_MAX, AIR_WANDER, AIR_WANDER_R, AIR_WANDER_RATE, AIR_FIL_CURL, AIR_FIL_ASPECT, AIR_FIL_WARP,
} from './atmosphericFlowBuffers';
import { glf } from '../gl/glf';

// ── GLSL ───────────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  ${PLANET_WINDOW_VS}
  ${AETHER_LIGHT_VS}
  uniform float uTime;
  uniform float uPhase;
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
  attribute float aRole;   // 0 = fog (the old sprite), 1 = filament (mirror-sky spec §3b)
  attribute float aLane;   // filament thread id (Task 7d; -1 for fog)
  attribute float aGap;    // filament: the larger along gap to its lane neighbours, aPhase units (Task 7f fix; fog 0)

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

  ${GAS_STREAK_VS}

  const float AIR_TILT_MIN = ${glf(AIR_TILT_MIN)};
  const float AIR_TILT_MAX = ${glf(AIR_TILT_MAX)};
  const float AIR_WANDER = ${glf(AIR_WANDER)};
  const float AIR_WANDER_R = ${glf(AIR_WANDER_R)};
  const float AIR_WANDER_RATE = ${glf(AIR_WANDER_RATE)};
  const float AIR_FIL_CURL = ${glf(AIR_FIL_CURL)};
  const float AIR_FIL_ASPECT = ${glf(AIR_FIL_ASPECT)};
  const float AIR_FIL_WARP = ${glf(AIR_FIL_WARP)};

  // Filament threads (Task 7e): tilt a lane's orbit ring by a seeded 8–20° about a seeded horizontal axis
  // (Rodrigues). A tilt < 90° keeps the rotation sense; now and prev both go through orbitPos, so the dash follows
  // the tilted tangent.
  vec3 airTilt(vec3 v, float lane) {
    float th = mix(AIR_TILT_MIN, AIR_TILT_MAX, gasHash(lane, 0.71));
    float az = 6.283185307 * gasHash(lane, 0.13);
    vec3 u = vec3(cos(az), 0.0, sin(az));
    float c = cos(th);
    float s = sin(th);
    return v * c + cross(u, v) * s + u * dot(u, v) * (1.0 - c);
  }

  // The orbit ring (tilted for filaments) at orbit angle.
  vec3 orbitAt(float angle) {
    // Orbital radius: widest at mid-altitude (eye-wall), narrows at base and top
    float eyeWall     = sin(aAlt * 3.14159);           // peaks at mid-altitude
    float baseRadius  = (0.15 + eyeWall * 1.1) * uSpread;
    // Ionosphere particles orbit faster at larger radius
    float ionRadius   = 1.35 * uSpread;
    float radius      = mix(baseRadius, ionRadius, aIon);
    // Orbit height spans full geode
    float orbitHeight = -1.2 + aAlt * 2.5;
    vec3 ring = vec3(cos(angle) * radius, 0.0, sin(angle) * radius);
    if (aRole > 0.5) ring = airTilt(ring, aLane);
    return vec3(0.0, orbitHeight, 0.0) + ring;
  }

  // The cyclone orbit alone (the big motion) at air phase ph.
  vec3 orbitPos(float ph, out float angle) {
    // Contra-rotating layers: lower half CW, upper half CCW (realistic cyclone)
    float direction  = aAlt > 0.5 ? 1.0 : -0.85;
    float ionSpeedMult = mix(1.0, 2.8, aIon); // ionosphere is fast
    float orbitRate  = (0.4 + aSpeed * 0.7) * direction * ionSpeedMult; // × orbitalSpeed lives in uPhase (the clock)
    angle            = aPhase * 6.28318 + ph * orbitRate;
    return orbitAt(angle);
  }

  // Everything the flow adds on top of the orbit core at this orbit angle. Fog: the old chain, op for op.
  vec3 airDisplace(vec3 core, float angle) {
    vec3 pos = core;
    // Fog: the old argument. Filaments: the same frequency, periodic in the angle (aPhase 0/1 neighbours on a thread).
    vec3 yArg = aRole < 0.5
      ? vec3(angle * 0.25, uTime * 0.07, aAlt * 4.0)
      : vec3(cos(angle) * 0.25, sin(angle) * 0.25 + uTime * 0.07, aAlt * 4.0);
    pos.y += snoise(yArg) * 0.15;
    // Filaments: slow per-lane vertical wander, periodic in the angle (no seam), lanes decorrelated by aLane.
    if (aRole > 0.5) pos.y += snoise(vec3(cos(angle) * AIR_WANDER_R + aLane * 3.1, sin(angle) * AIR_WANDER_R, uTime * AIR_WANDER_RATE)) * AIR_WANDER;
    if (aRole > 0.5) pos += gasWarp(pos, uTime, AIR_FIL_WARP); // soft threads §3: in the shared chain (prev + neighbours)

    // ── Atmospheric eddies (slow curl turbulence) ────────────────────────
    float t = uTime * 0.08;
    vec3 curl = curlNoise(pos * 0.9 + vec3(t, t * 0.6, t * 0.8));
    pos += curl * uTurbulence * 0.3 * (aRole < 0.5 ? 1.0 : AIR_FIL_CURL); // filaments: damped (streamlines)

    // Fine molecular shimmer: fog only (on a filament it is crossed at orbital speed: a scribble, Task 7e fix 2)
    float st = uTime * 0.6;
    if (aRole < 0.5) {
      pos.x += snoise(pos * 5.0 + vec3(st, 0.0, aPhase)) * 0.03;
      pos.z += snoise(pos * 5.0 + vec3(aPhase, 0.0, st * 1.1)) * 0.03;
    }
    return pos;
  }

  void main(){
    // ── Cyclone / helical orbit (now, and STREAK_DT of clock time ago) ──
    float angle, anglePrev;
    vec3 core = orbitPos(uPhase, angle);
    vec3 prevCore = orbitPos(uPhase - STREAK_DT * uPhaseRate, anglePrev);
    vec3 pos = airDisplace(core, angle);
    // Fog: the streak shows the current, not the eddies (the old prev). Filaments (Task 7e fix): the y-noise, wander,
    // curl and shimmer are crossed at orbital speed, so they ARE the thread's path: prev runs the same chain at the
    // prev angle and the dash follows the wavy tilted thread (the old prev hatched across it, up to ~90° at the limb).
    vec3 prev = aRole < 0.5 ? prevCore + (pos - core) : airDisplace(prevCore, anglePrev);

    // Altitude from actual height + inherent layer
    float normY   = clamp((pos.y + 1.2) / 2.5, 0.0, 1.0);
    vAltitude = mix(aAlt, normY, 0.35);
    vSpeed    = aSpeed;
    vIon      = aIon;

    // Air particles barely shrink — they persist at full size
    float baseSize = aSize * 5.0;

    // Nebula condensation — see ParticleFlow.jsx for the physics note.
    pos *= 1.0 - uCondense * uCondense;
    prev *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vec4 mvPrev = modelViewMatrix * vec4(prev, 1.0);
    // Fog = the old sprite, untouched; filament = a thin capsule (mirror-sky spec §3b/§3c).
    float fogSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);
    float filW = gasFilWidth(-mvPos.z, aSize, 1.0 - uCondense * uCondenseSizeBite);
    float size = aRole < 0.5 ? fogSize : filW;
    gl_Position  = projectionMatrix * mvPos;
    // Threads (Task 7f fix): the lane neighbours sit ±aGap along the orbit: the full filament chain there gives the
    // path secant (direction) and the gap, as in the fluid.
    vec4 clipBack = gl_Position;
    vec4 clipAhead = gl_Position;
    if (aRole > 0.5) {
      float dA = aGap * 6.28318;
      float squash = 1.0 - uCondense * uCondense;
      clipBack = projectionMatrix * (modelViewMatrix * vec4(airDisplace(orbitAt(angle - dA), angle - dA) * squash, 1.0));
      clipAhead = projectionMatrix * (modelViewMatrix * vec4(airDisplace(orbitAt(angle + dA), angle + dA) * squash, 1.0));
    }
    float fray = aRole < 0.5 ? 1.0 : gasFray(gasThreadCoord(aLane, aPhase), uTime);
    gl_PointSize = gasSpriteThread(gl_Position, projectionMatrix * mvPrev, clipBack, clipAhead, aRole, size, AIR_FIL_ASPECT, gasHash(aPhase, aSeed), fray);
    // Fog: × fogAlpha. Filaments: the mask runs along each thread (lane id + orbit label), slowly evolving, × filAlpha, ÷ the fray.
    vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime) * (aRole < 0.5 ? 1.0 : uAirFilGain) / fray;
    planetWindowVS(mvPos.xyz);
    aetherLightVS(mvPos.xyz, size);
  }
`;

const fragmentShader = /* glsl */ `
  ${PLANET_WINDOW_FS}
  ${aetherLightFS('air')}
  ${GAS_STREAK_FS}
  uniform float uOpacity;
  varying float vAltitude;
  varying float vSpeed;
  varying float vIon;

  void main(){
    float d = vRole < 0.5 ? gasStreakDist(gl_PointCoord) : gasThreadDist(gl_PointCoord);
    // Very soft — air has no hard edges
    float alpha = (vRole < 0.5 ? smoothstep(1.0, 0.0, d) : gasFilProfile(d)) * gasTaper(gl_PointCoord);
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
    col = gasFilTint(col, d);

    // Brightness: scaled down so 10k additive particles don't stack to white
    float glow = 0.35 + vAltitude * 0.45 + vIon * 0.55;
    col *= glow;

    // Soft outer halo — reduced to avoid compound bloom
    float halo = smoothstep(0.9, 0.0, d) * (vAltitude * 0.2 + vIon * 0.35);
    col += col * halo * 0.3;

    // Alpha: deep layers very faint, only high-altitude / ionosphere reads clearly
    float alphaScale = 0.05 + vAltitude * 0.28 + vIon * 0.22;
    // Banding dither — see ParticleFlow.jsx for the physics note.
    float dither = (fract(sin(dot(gl_FragCoord.xy + gl_PointCoord * 61.803, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    col *= aetherLight();
    gl_FragColor = gasOut(col, (alpha * alphaScale * uOpacity * vLane) * planetWindow(), dither);
  }
`;

// ── Component ──────────────────────────────────────────────────────────────
export default function AtmosphericFlow({
  isMobile          = false,
  orbitalSpeed      = 1.2,
  turbulence        = 0.18,
  spread            = 1.0,
  density           = null,
  fogCount = null,
  onFps             = null,
  opacityMultiplier = 1,
  condense = 0,
  condenseSizeBite = 0.6,
  planetWindow = 0,
  blending = THREE.AdditiveBlending,
  premultiplied = false, // MercuryCanvas: one-draw premultiplied blend, fog = normal, filaments additive (Task 7c)
  aetherClock = null,
  visible = true,
}) {
  const PARTICLE_COUNT = density ?? (isMobile ? 4000 : 10000);
  const N_FOG = fogCount ?? PARTICLE_COUNT; // MercuryCanvas passes gasCounts().fog; standalone = all fog, the old look (spec §3e)
  const materialRef = useRef();
  const fpsFrames   = useRef(0);
  const fpsTime     = useRef(0);

  const buffers = useMemo(() => buildBuffers(PARTICLE_COUNT, N_FOG), [PARTICLE_COUNT, N_FOG]);

  // Created ONCE — see ParticleFlow.jsx for the stale-upload-bond note.
  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uPhaseRate: { value: 0 },
    ...GAS_TUNE_UNIFORMS(PLANET_TUNE),
    uTurbulence:   { value: turbulence },
    uSpread:       { value: spread },
    uOpacity:      { value: opacityMultiplier },
    uCondense:         { value: condense },
    uCondenseSizeBite: { value: condenseSizeBite },
    uPremult: { value: premultiplied ? 1 : 0 },
    uPlanetWindow: { value: planetWindow },
    uViewportPx: { value: new THREE.Vector2(1, 1) },
    uPlanetRadius: { value: R_SCENE },
    uSunDirW: { value: new THREE.Vector3(...SUN_DIR_WORLD) },
    uLitFloor: { value: PLANET_TUNE.aetherFloor },
    uLitPen: { value: Math.max(PLANET_TUNE.aetherPenumbra, 1e-3) },
  }));

  // The shared aether clock (MercuryCanvas); standalone use runs its own from the props.
  const [ownClock] = useState(createAetherClock);
  const clk = aetherClock ?? configureAetherClock(ownClock, { speed: 0, orbitalSpeed: orbitalSpeed, calm: false });

  useFrame((state, delta) => {
    tickAetherClock(clk, state.clock.elapsedTime, delta);
    if (!visible) return;
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uTime.value = clk.t;
      mat.uniforms.uPhase.value = clk.phase.air;
      mat.uniforms.uPhaseRate.value = clk.rate.air;
      writeGasTune(mat.uniforms, PLANET_TUNE, state.gl.getPixelRatio(), gasPointMax(state.gl));
      mat.uniforms.uTurbulence.value    = turbulence;
      mat.uniforms.uSpread.value        = spread;
      mat.uniforms.uOpacity.value       = opacityMultiplier;
      mat.uniforms.uCondense.value         = condense;
      mat.uniforms.uCondenseSizeBite.value = condenseSizeBite;
      mat.uniforms.uPlanetWindow.value = planetWindow;
      mat.uniforms.uLitFloor.value = PLANET_TUNE.aetherFloor;
      mat.uniforms.uLitPen.value = Math.max(PLANET_TUNE.aetherPenumbra, 1e-3);
      state.gl.getDrawingBufferSize(mat.uniforms.uViewportPx.value);
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
    <points frustumCulled={false} visible={visible}>
      <bufferGeometry key={`${PARTICLE_COUNT}:${N_FOG}`}>
        <bufferAttribute attach="attributes-position" array={buffers.positions} count={PARTICLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aPhase"   array={buffers.phases}    count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aSpeed"   array={buffers.speeds}    count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aSeed"    array={buffers.seeds}     count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aSize"    array={buffers.sizes}     count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aAlt"     array={buffers.alts}      count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aIon"     array={buffers.ions}      count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aRole" array={buffers.roles} count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aLane" array={buffers.lanes} count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aGap" array={buffers.gaps} count={PARTICLE_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        blending={premultiplied ? THREE.CustomBlending : blending}
        blendEquation={THREE.AddEquation}
        blendSrc={THREE.OneFactor}
        blendDst={THREE.OneMinusSrcAlphaFactor}
        blendEquationAlpha={THREE.AddEquation}
        blendSrcAlpha={THREE.OneFactor}
        blendDstAlpha={THREE.OneMinusSrcAlphaFactor}
        depthWrite={false}
      />
    </points>
  );
}

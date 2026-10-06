import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_WINDOW_VS, PLANET_WINDOW_FS } from '../mercury/planet/planetWindow';
import { R_SCENE, PLANET_TUNE } from '../mercury/planet/planetLook';
import { AETHER_LIGHT_VS, aetherLightFS } from '../mercury/planet/aetherLight';
import { SUN_DIR_WORLD } from '../mercury/planet/planetFrame';
import { GAS_STREAK_VS, GAS_STREAK_FS, GAS_TUNE_UNIFORMS, writeGasTune, gasPointMax } from '../mercury/planet/gasStreak';
import { createAetherClock, configureAetherClock, tickAetherClock } from '../mercury/planet/aetherClock';
import { buildBuffers, FLUID_FIL_SHIMMER } from './particleFlowBuffers';
import { glf } from '../gl/glf';

// ── GLSL Shaders ───────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
  ${PLANET_WINDOW_VS}
  ${AETHER_LIGHT_VS}
  uniform float uTime;
  uniform float uPhase;
  uniform float uCurlAmp;
  uniform float uTubeRadius;
  uniform float uChromatic;
  uniform float uCondense;
  uniform float uCondenseSizeBite;
  attribute float aPhase;
  attribute float aRadius;
  attribute float aOffset;
  attribute float aRole;   // 0 = fog (the old sprite), 1 = filament (mirror-sky spec §3b)
  attribute float aLane;   // filament thread id (Task 7d; -1 for fog)
  attribute float aGap;    // filament: the larger along gap to its lane neighbours, aPhase units (Task 7f; fog 0)
  varying float vHue;
  varying float vBrightness;

  // 3D simplex noise (Stefan Gustavson)
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

  // Curl noise — demoted to subtle environmental drift
  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    float n1 = snoise(p + vec3(e, 0, 0));
    float n2 = snoise(p - vec3(e, 0, 0));
    float n3 = snoise(p + vec3(0, e, 0));
    float n4 = snoise(p - vec3(0, e, 0));
    float n5 = snoise(p + vec3(0, 0, e));
    float n6 = snoise(p - vec3(0, 0, e));
    return vec3(
      (n4 - n3) - (n6 - n5),
      (n6 - n5) - (n2 - n1),
      (n2 - n1) - (n4 - n3)
    ) * 0.5;
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

  ${GAS_STREAK_VS}

  // The knot drift alone (the big motion) at knot phase ph: the particle's place in its tube.
  vec3 knotPos(float ph, out vec3 center) {
    float t = fract(aPhase + ph * (0.6 + aOffset * 0.4));
    center = knotCenter(t);

    // Tangent + local Frenet frame
    vec3 tangent = normalize(knotCenter(t + 0.001) - center);
    vec3 up = abs(tangent.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    vec3 normal = normalize(cross(tangent, up));
    vec3 binormal = cross(tangent, normal);

    // ── Gravity bias: project world-down onto local frame ──
    vec3 gravity = vec3(0.0, -1.0, 0.0);
    float gravNormal = dot(gravity, normal) * 0.015;
    float gravBinormal = dot(gravity, binormal) * 0.015;

    // ── Tube offset: sand-grain position inside tube ──
    float angle = aOffset * 6.283185307;
    float rad = aRadius * uTubeRadius;
    return center + normal * (cos(angle) * rad + gravNormal) + binormal * (sin(angle) * rad + gravBinormal);
  }

  const float FLUID_FIL_SHIMMER = ${glf(FLUID_FIL_SHIMMER)};

  // A filament's full position at knot phase ph (Task 7f fix: its lane neighbours' samples for the path secant):
  // the knot + damped shimmer + curl drift, as in main.
  vec3 fluidFilAt(float ph) {
    vec3 c;
    vec3 b = knotPos(ph, c);
    vec3 j = vec3(snoise(b * 8.0 + vec3(uTime, 0.0, 0.0)), snoise(b * 8.0 + vec3(0.0, uTime, 0.0)),
      snoise(b * 8.0 + vec3(0.0, 0.0, uTime))) * (0.012 * FLUID_FIL_SHIMMER);
    return b + j + curlNoise(c * 2.0 + uTime * 0.1) * uCurlAmp;
  }

  void main() {
    // ── Primary motion: tangential drift along knot (now, and STREAK_DT of clock time ago) ──
    vec3 center, centerPrev;
    vec3 basePos = knotPos(uPhase, center);
    vec3 prevCore = knotPos(uPhase - STREAK_DT * uPhaseRate, centerPrev);

    // ── Per-particle granular jitter (sand shimmer) ──
    // Filaments: damped (Task 7f fix): the shimmer is crossed at knot speed, so it bends the thread's path.
    float shimK = aRole < 0.5 ? 1.0 : FLUID_FIL_SHIMMER;
    float jx = snoise(basePos * 8.0 + vec3(uTime, 0.0, 0.0)) * 0.012 * shimK;
    float jy = snoise(basePos * 8.0 + vec3(0.0, uTime, 0.0)) * 0.012 * shimK;
    float jz = snoise(basePos * 8.0 + vec3(0.0, 0.0, uTime)) * 0.012 * shimK;

    // ── Subtle curl drift (environmental, not primary) ──
    vec3 curl = curlNoise(center * 2.0 + uTime * 0.1) * uCurlAmp;

    vec3 pos = basePos + vec3(jx, jy, jz) + curl;
    vec3 prev = prevCore + (pos - basePos); // the streak shows the current, not the shimmer

    // ── Harmonic color cycling ──
    float laneHue = aRole < 0.5 ? 0.0 : gasHash(aLane, 0.37); // filaments: each thread its own place on the palette
    vHue = fract(aPhase + uTime * 0.05 + uChromatic * 0.33 + laneHue);
    vBrightness = 0.8 + 0.2 * sin(aPhase * 6.283185307 + uTime * 0.3);

    // Nebula condensation: contract the post-sim field into the drop.
    // Squared ease = gravity well (slow drift, fast swallow); the sphere's
    // depth buffer occludes arrivals. Applies to pos, NOT the raw attribute.
    pos *= 1.0 - uCondense * uCondense;
    prev *= 1.0 - uCondense * uCondense;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vec4 mvPrev = modelViewMatrix * vec4(prev, 1.0);
    // Fog = the old sprite, untouched; filament = a thin capsule (mirror-sky spec §3b/§3c).
    float fogSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite);
    float filW = gasFilWidth(-mvPosition.z, aRadius, 1.0 - uCondense * uCondenseSizeBite);
    float size = aRole < 0.5 ? fogSize : filW;
    gl_Position = projectionMatrix * mvPosition;
    // Threads (Task 7f + fix): the lane neighbours sit ±aGap along the same streamline (same aOffset, so the same
    // knot speed): the full filament chain at those knot phases gives the path secant (direction) and the gap.
    vec4 clipBack = gl_Position;
    vec4 clipAhead = gl_Position;
    if (aRole > 0.5) {
      float dph = aGap / (0.6 + aOffset * 0.4);
      float squash = 1.0 - uCondense * uCondense;
      clipBack = projectionMatrix * (modelViewMatrix * vec4(fluidFilAt(uPhase - dph) * squash, 1.0));
      clipAhead = projectionMatrix * (modelViewMatrix * vec4(fluidFilAt(uPhase + dph) * squash, 1.0));
    }
    gl_PointSize = gasSpriteThread(gl_Position, projectionMatrix * mvPrev, clipBack, clipAhead, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius));
    // Fog: × fogAlpha. Filaments: the mask runs along each thread (lane id + knot label), slowly evolving, × filAlpha.
    vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime);
    planetWindowVS(mvPosition.xyz);
    aetherLightVS(mvPosition.xyz, size);
  }
`;

const fragmentShader = /* glsl */ `
  ${PLANET_WINDOW_FS}
  ${aetherLightFS('fluid')}
  ${GAS_STREAK_FS}
  uniform float uOpacity;
  varying float vHue;
  varying float vBrightness;

  void main() {
    // Sharp sprite — bright core with tight halo
    float d = gasStreakDist(gl_PointCoord);
    float alpha = smoothstep(1.0, 0.3, d) * gasTaper(gl_PointCoord);
    if (alpha < 0.01) discard;

    // Bioluminescent palette: magenta → violet → cyan → magenta
    vec3 magenta = vec3(1.0, 0.0, 0.667);
    vec3 violet  = vec3(0.533, 0.267, 1.0);
    vec3 cyan    = vec3(0.0, 1.0, 0.8);

    float h = vHue;
    vec3 color = h < 0.333
      ? mix(magenta, violet, h * 3.0)
      : h < 0.666
        ? mix(violet, cyan, (h - 0.333) * 3.0)
        : mix(cyan, magenta, (h - 0.666) * 3.0);

    color *= vBrightness;

    // 8-bit backbuffer dither: the additive falloff quantizes to 1/255 steps
    // (terracing an OLED renders faithfully). ±0.5/255 on the alpha side so it
    // survives the premultiply; seeded per-pixel AND per-sprite (gl_PointCoord)
    // so overlapping sprites decorrelate instead of summing the same noise.
    float dither = (fract(sin(dot(gl_FragCoord.xy + gl_PointCoord * 61.803, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

    color *= aetherLight();
    gl_FragColor = gasOut(color, (alpha * 0.95 * uOpacity * vLane) * planetWindow(), dither);
  }
`;

// ── Component ──────────────────────────────────────────────────────────────
export default function ParticleFlow({
  isMobile = false,
  speed = 0.08,
  curlAmp = 0.02,
  tubeRadius = 0.32,
  chromatic = 0.0,
  density = null,
  fogCount = null,
  onFps = null,
  opacityMultiplier = 1,
  condense = 0,
  condenseSizeBite = 0.6,
  planetWindow = 0,
  blending = THREE.AdditiveBlending,
  premultiplied = false, // MercuryCanvas: one-draw premultiplied blend, fog = normal, filaments additive (Task 7c)
  aetherClock = null,
}) {
  const PARTICLE_COUNT = density ?? (isMobile ? 4000 : 10000);
  const N_FOG = fogCount ?? PARTICLE_COUNT; // MercuryCanvas passes gasCounts().fog; standalone = all fog, the old look (spec §3e)
  const pointsRef = useRef();
  const materialRef = useRef();
  const fpsFrames = useRef(0);
  const fpsTime = useRef(0);

  const buffers = useMemo(() => buildBuffers(PARTICLE_COUNT, N_FOG), [PARTICLE_COUNT, N_FOG]);

  // Uniforms are created ONCE (lazy useState). An inline object here is
  // rebuilt every render; r3f then replaces material.uniforms, but three's
  // compiled program keeps uploading the value-wrappers it captured at
  // compile time — every later .value write silently stops reaching the GPU.
  // Per-frame values flow through useFrame below.
  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uPhaseRate: { value: 0 },
    ...GAS_TUNE_UNIFORMS(PLANET_TUNE),
    uCurlAmp:    { value: curlAmp },
    uTubeRadius: { value: tubeRadius },
    uChromatic:  { value: chromatic },
    uOpacity:    { value: opacityMultiplier },
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
  const clk = aetherClock ?? configureAetherClock(ownClock, { speed: speed, orbitalSpeed: 0, calm: false });

  // Update uniforms from props each frame + FPS counter
  useFrame((state, delta) => {
    tickAetherClock(clk, state.clock.elapsedTime, delta);
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uTime.value = clk.t;
      mat.uniforms.uPhase.value = clk.phase.fluid;
      mat.uniforms.uPhaseRate.value = clk.rate.fluid;
      writeGasTune(mat.uniforms, PLANET_TUNE, state.gl.getPixelRatio(), gasPointMax(state.gl));
      mat.uniforms.uCurlAmp.value = curlAmp;
      mat.uniforms.uTubeRadius.value = tubeRadius;
      mat.uniforms.uChromatic.value = chromatic;
      mat.uniforms.uOpacity.value = opacityMultiplier;
      mat.uniforms.uCondense.value         = condense;
      mat.uniforms.uCondenseSizeBite.value = condenseSizeBite;
      mat.uniforms.uPlanetWindow.value = planetWindow;
      mat.uniforms.uLitFloor.value = PLANET_TUNE.aetherFloor;
      mat.uniforms.uLitPen.value = Math.max(PLANET_TUNE.aetherPenumbra, 1e-3);
      state.gl.getDrawingBufferSize(mat.uniforms.uViewportPx.value);
    }
    // FPS counter — report once per second
    if (onFps) {
      fpsFrames.current++;
      fpsTime.current += delta;
      if (fpsTime.current >= 1) {
        onFps(Math.round(fpsFrames.current / fpsTime.current));
        fpsFrames.current = 0;
        fpsTime.current = 0;
      }
    }
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry key={`${PARTICLE_COUNT}:${N_FOG}`}>
        <bufferAttribute attach="attributes-position" array={buffers.positions} count={PARTICLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aPhase"    array={buffers.phases}    count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aRadius"   array={buffers.radii}     count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aOffset"   array={buffers.offsets}   count={PARTICLE_COUNT} itemSize={1} />
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

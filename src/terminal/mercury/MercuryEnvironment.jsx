// src/terminal/mercury/MercuryEnvironment.jsx — the mirror's world.
// A procedural night environment rendered into a small cubemap via drei
// <Environment> children mode. Replaces preset="night" (no HDR, no CDN).
// Spec: docs/superpowers/specs/2026-07-16-elemental-mirror-design.md
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { NEUTRAL_NIGHT, resolveEnvState } from './elements';
import { TUNE, registerTuningRig } from './mercuryTuning';

// Exported for elemental-mirror-probe.html — the headless-pane tuning probe
// renders this exact shader against the drei night HDR for A/B readback.
export const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // Sphere is centered on the cube camera and unrotated: object-space
    // position of a unit sphere IS the world direction. No matrix chunks needed.
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  varying vec3 vDir;
  uniform vec3  uElementColor;   // effective (pre-blended) element chroma
  uniform vec3  uNeutralColor;   // quintessence night chroma
  uniform float uChromePhase;    // 1.0 = pure mirror: world drains to neutral
  uniform float uHorizonHeight;  // world-y of the glow band
  uniform float uTime;
  // Tunable gains — fed from mercuryTuning.js TUNE each frame (console rig).
  uniform float uChromaGain;
  uniform float uFloorGain;
  uniform float uStratumGain;
  uniform float uBlobGain;
  uniform float uMoonGain;
  uniform float uBreatheSpeed;
  uniform float uBreatheAmp;

  // Hash dither — a smooth gradient in a low-res cubemap is a banding
  // machine, and banding is a hard fail for this project.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float y = dir.y;

    // The dissolution: element chroma drains to neutral night at peak chrome.
    vec3 chroma = mix(uElementColor, uNeutralColor, uChromePhase);

    // World base — dark ground below, quintessence-dark zenith above.
    vec3 zenith = vec3(0.010, 0.010, 0.018);
    vec3 ground = vec3(0.004, 0.004, 0.008);
    vec3 world  = mix(ground, zenith, smoothstep(-1.0, 1.0, y));

    // Horizon band — the world's main light source. Breathes slowly.
    // The vec3 floor never drains with chromePhase: a mirror of a lightless
    // night is black glass (probe-verified against the shipped dikhololo HDR;
    // hex chroma lands ~0.01 in linear space, far too dim to carry the band
    // alone). Element chroma rides ON the floor at 0.5 gain — loud enough to
    // read on chrome, quiet enough not to wash the planet.
    float breathe = 1.0 + uBreatheAmp * sin(uTime * uBreatheSpeed);
    // x*x, not pow(x, 2.0): pow is UB in GLSL for negative bases, and the
    // base goes negative below the horizon — NaN on some mobile GPUs, which
    // PMREM blur then smears across the whole reflection.
    float bd = (y - uHorizonHeight) * 4.5;
    float band = exp(-bd * bd);
    world += (chroma * uChromaGain + vec3(0.065, 0.065, 0.100) * uFloorGain) * band * breathe;

    // Faint stratum below the horizon — the ground remembering the glow.
    float sd = (y - uHorizonHeight + 0.45) * 3.0;
    float stratum = exp(-sd * sd);
    world += chroma * stratum * uStratumGain;

    // Distant sources drifting on slow incommensurate orbits.
    // b2 is the moon: an HDR point (>1) so the liquid mirror always catches
    // one hard specular landmark, like the shipped HDR's moon.
    vec3 b1 = normalize(vec3(cos(uTime * 0.050),        0.35, sin(uTime * 0.050)));
    vec3 b2 = normalize(vec3(cos(uTime * 0.031 + 2.4),  0.28, sin(uTime * 0.031 + 2.4)));
    vec3 b3 = normalize(vec3(cos(uTime * 0.021 + 4.2), -0.25, sin(uTime * 0.021 + 4.2)));
    world += chroma * pow(max(dot(dir, b1), 0.0), 22.0) * 0.25 * uBlobGain;
    float moon = max(dot(dir, b2), 0.0);
    world += (vec3(1.60, 1.60, 1.70) * pow(moon, 260.0)   // the disc
           +  vec3(0.14, 0.14, 0.18) * pow(moon, 30.0))   // its halo
           * uMoonGain;
    world += chroma * pow(max(dot(dir, b3), 0.0), 40.0) * 0.15 * uBlobGain;

    // Dither before quantization.
    world += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * (1.5 / 255.0);

    gl_FragColor = vec4(world, 1.0);
  }
`;

// Drives the env uniforms from the live phase signals. Pure w.r.t. its
// inputs; exported so the dissolution arc is testable without WebGL.
// eslint-disable-next-line react-refresh/only-export-components -- pure uniform-driver exported for unit tests (mercuryEnvironment.test.js); HMR of this module already reloads the canvas wholesale
export function applyEnvState(uniforms, activePhase, pendingPhase, sphereState) {
  const s = resolveEnvState(activePhase, pendingPhase, sphereState);
  uniforms.uElementColor.value.setRGB(...s.elementColor);
  uniforms.uChromePhase.value = s.chromePhase;
  uniforms.uHorizonHeight.value = s.horizonHeight + TUNE.horizonLift;
  // Tunable gains flow TUNE -> uniforms every frame, so console pokes
  // (window.__mercuryTune) are authoritative and never fight this loop.
  uniforms.uChromaGain.value   = TUNE.chromaGain;
  uniforms.uFloorGain.value    = TUNE.floorGain;
  uniforms.uStratumGain.value  = TUNE.stratumGain;
  uniforms.uBlobGain.value     = TUNE.blobGain;
  uniforms.uMoonGain.value     = TUNE.moonGain;
  uniforms.uBreatheSpeed.value = TUNE.breatheSpeed;
  uniforms.uBreatheAmp.value   = TUNE.breatheAmp;
}

// Mobile staging: the env cubemap re-renders only while a transition runs.
// Returns the burst counter to key <Environment> with — increments ONLY
// when a transition STARTS (pendingPhase null -> phase); keying on
// pendingPhase itself would remount a second time when it nulls at the
// transition's end, churning render targets.
// drei's internal frames counter resets on any re-render of the Environment
// subtree, so a mobile burst can run longer than 70 frames and an idle-time
// parent re-render buys a fresh burst (cosmetic blob time-jump); the remount
// key is the deliberate contract regardless.
// eslint-disable-next-line react-refresh/only-export-components -- pure key-policy helper exported for unit tests (mercuryEnvironment.test.js)
export function nextBurst(prevBurst, prevPending, pendingPhase) {
  return pendingPhase && pendingPhase !== prevPending ? prevBurst + 1 : prevBurst;
}

export default function MercuryEnvironment({ activePhase, pendingPhase, sphereState, isMobile = false }) {
  const uniforms = useMemo(() => ({
    uElementColor:  { value: new THREE.Color(NEUTRAL_NIGHT.color) },
    uNeutralColor:  { value: new THREE.Color(NEUTRAL_NIGHT.color) },
    uChromePhase:   { value: 0 },
    uHorizonHeight: { value: NEUTRAL_NIGHT.horizonHeight },
    uTime:          { value: 0 },
    uChromaGain:    { value: TUNE.chromaGain },
    uFloorGain:     { value: TUNE.floorGain },
    uStratumGain:   { value: TUNE.stratumGain },
    uBlobGain:      { value: TUNE.blobGain },
    uMoonGain:      { value: TUNE.moonGain },
    uBreatheSpeed:  { value: TUNE.breatheSpeed },
    uBreatheAmp:    { value: TUNE.breatheAmp },
  }), []);

  // Dev-only console tuning rig (window.__mercuryTune). Zero prod footprint.
  useEffect(() => {
    if (import.meta.env.DEV) registerTuningRig();
  }, []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
    // Ride the existing beats: chromePhase drains the world to neutral at
    // peak mirror; colorBlend floods the pending element back in.
    applyEnvState(uniforms, activePhase, pendingPhase, sphereState);
  });

  // Mobile: re-render the env only while a transition runs (~800ms), then
  // hold a static frame. Bump the key only when a transition STARTS —
  // keying on pendingPhase directly would remount again when it nulls.
  const burstRef = useRef(0);
  const prevPendingRef = useRef(null);
  burstRef.current = nextBurst(burstRef.current, prevPendingRef.current, pendingPhase);
  prevPendingRef.current = pendingPhase;

  return (
    <Environment
      key={isMobile ? `burst-${burstRef.current}` : 'live'}
      frames={isMobile ? 70 : Infinity}
      resolution={isMobile ? 64 : 128}
    >
      {/* Positive scale + BackSide = inverted sphere. Never negate the scale:
          that flips winding and un-inverts it. */}
      <mesh scale={50}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <sphereGeometry args={[1, 48, 32]} />
        {/* eslint-disable react/no-unknown-property */}
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
        {/* eslint-enable react/no-unknown-property */}
      </mesh>
    </Environment>
  );
}

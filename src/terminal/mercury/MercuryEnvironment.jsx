// src/terminal/mercury/MercuryEnvironment.jsx — the mirror's world.
// A procedural night environment rendered into a small cubemap via drei
// <Environment> children mode. Replaces preset="night" (no HDR, no CDN).
// Spec: docs/superpowers/specs/2026-07-16-elemental-mirror-design.md
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { NEUTRAL_NIGHT } from './elements';

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
    float breathe = 1.0 + 0.12 * sin(uTime * 0.35);
    float band = exp(-pow((y - uHorizonHeight) * 4.5, 2.0));
    world += (chroma * 0.5 + vec3(0.065, 0.065, 0.100)) * band * breathe;

    // Faint stratum below the horizon — the ground remembering the glow.
    float stratum = exp(-pow((y - uHorizonHeight + 0.45) * 3.0, 2.0));
    world += chroma * stratum * 0.12;

    // Distant sources drifting on slow incommensurate orbits.
    // b2 is the moon: an HDR point (>1) so the liquid mirror always catches
    // one hard specular landmark, like the shipped HDR's moon.
    vec3 b1 = normalize(vec3(cos(uTime * 0.050),        0.35, sin(uTime * 0.050)));
    vec3 b2 = normalize(vec3(cos(uTime * 0.031 + 2.4),  0.28, sin(uTime * 0.031 + 2.4)));
    vec3 b3 = normalize(vec3(cos(uTime * 0.021 + 4.2), -0.25, sin(uTime * 0.021 + 4.2)));
    world += chroma * pow(max(dot(dir, b1), 0.0), 22.0) * 0.25;
    float moon = max(dot(dir, b2), 0.0);
    world += vec3(1.60, 1.60, 1.70) * pow(moon, 260.0)   // the disc
           + vec3(0.14, 0.14, 0.18) * pow(moon, 30.0);   // its halo
    world += chroma * pow(max(dot(dir, b3), 0.0), 40.0) * 0.15;

    // Dither before quantization.
    world += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * (1.5 / 255.0);

    gl_FragColor = vec4(world, 1.0);
  }
`;

// eslint-disable-next-line no-unused-vars -- activePhase/pendingPhase/sphereState wired in the dissolution-arc task
export default function MercuryEnvironment({ activePhase, pendingPhase, sphereState, isMobile = false }) {
  const uniforms = useMemo(() => ({
    uElementColor:  { value: new THREE.Color(NEUTRAL_NIGHT.color) },
    uNeutralColor:  { value: new THREE.Color(NEUTRAL_NIGHT.color) },
    uChromePhase:   { value: 0 },
    uHorizonHeight: { value: NEUTRAL_NIGHT.horizonHeight },
    uTime:          { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <Environment frames={Infinity} resolution={128}>
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

// useDropletField.js — the phase-5 droplet SDF pass (spec §7): its material, mesh ref and per-frame upload.
// MercuryPlanet calls upload() at the end of its own useFrame, after packFamily, so the field never
// lags the sim (a child's useFrame would run first). The mirror uniforms ARE the planet material's
// objects (one source of truth for the Sun, the elements and the aether), except the beads' own glint gain.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildDropletShader, DROPLET_MATERIAL, DROPLET_RENDER_ORDER } from './planet/dropletShader';
import { HG_MIRROR_UNIFORMS } from './planet/hgMirrorGlsl';
import { PLANET_TUNE } from './planet/planetLook';

export default function useDropletField({ tier, isMobile, planetMaterial, caps }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const shader = useMemo(() => buildDropletShader({ tier }), [tier]);
  const material = useMemo(() => {
    const vec4s = (n) => Array.from({ length: n }, () => new THREE.Vector4());
    const uniforms = {
      uRect: { value: new THREE.Vector4(-1, -1, 1, 1) },
      uBead: { value: vec4s(caps.bodies) },
      uBeadAxis: { value: vec4s(caps.bodies) },
      uNeck: { value: vec4s(caps.necks) },
      uNeckR: { value: new Float32Array(caps.necks) },
      uBridge: { value: vec4s(caps.bridges) },
      uCounts: { value: new THREE.Vector3() },
      uPxAngle: { value: 1e-3 },
      uTime: { value: 0 },
    };
    for (const name of HG_MIRROR_UNIFORMS) uniforms[name] = planetMaterial.uniforms[name];
    // except the Sun's glint gain: the beads take the planet's × PLANET_TUNE.beadGlint (set in upload)
    uniforms.uSunGlint = { value: planetMaterial.uniforms.uSunGlint.value };
    return new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: shader.vs, fragmentShader: shader.fs, uniforms, ...DROPLET_MATERIAL, alphaToCoverage: !isMobile,
    });
  }, [shader, planetMaterial, caps, isMobile]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const meshRef = useRef(null);
  const renderOrder = DROPLET_RENDER_ORDER;

  const upload = (frame, tS) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = frame.visible;
    if (!frame.visible) return;
    const u = material.uniforms;
    u.uRect.value.set(frame.rect[0], frame.rect[1], frame.rect[2], frame.rect[3]);
    for (let i = 0; i < frame.nb; i++) {
      u.uBead.value[i].fromArray(frame.bead, 4 * i);
      u.uBeadAxis.value[i].fromArray(frame.beadAxis, 4 * i);
    }
    for (let i = 0; i < frame.nn; i++) u.uNeck.value[i].fromArray(frame.neck, 4 * i);
    u.uNeckR.value.set(frame.neckR);
    for (let i = 0; i < frame.nk; i++) u.uBridge.value[i].fromArray(frame.bridge, 4 * i);
    u.uCounts.value.set(frame.nb, frame.nn, frame.nk);
    u.uPxAngle.value = frame.pxAngle;
    u.uTime.value = tS;
    u.uSunGlint.value = planetMaterial.uniforms.uSunGlint.value * PLANET_TUNE.beadGlint;
  };

  return { geometry, material, meshRef, renderOrder, upload };
}

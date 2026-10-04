// src/terminal/mercury/useHgBeads.js — the Hg bead pass: sim state, geometry, material and the per-frame upload.
// MercuryPlanet steps the sim at the end of its own useFrame (after the fling/splash sources), then calls upload().
// The mirror uniforms ARE the planet material's objects (one source of truth for the Sun, the elements and the
// aether), except the beads' own glint gain — the useDropletField pattern.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createBeads } from './planet/hgBeads';
import { BEAD_VS, BEAD_FS, BEAD_MATERIAL, BEAD_RENDER_ORDER } from './planet/hgBeadShader';
import { HG_MIRROR_UNIFORMS } from './planet/hgMirrorGlsl';
import { TIERS } from './planet/planetQuality';
import { PLANET_TUNE, R_SCENE } from './planet/planetLook';

export default function useHgBeads({ tier, planetMaterial }) {
  const cap = TIERS[tier].beads;
  const sim = useMemo(() => createBeads(cap), [cap]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(sim.outPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aBead', new THREE.BufferAttribute(sim.outBead, 2).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    return g;
  }, [sim]);
  const material = useMemo(() => {
    const uniforms = {
      uViewportPx: { value: new THREE.Vector2(1, 1) },
      uPlanetR: { value: R_SCENE },
      uLitPen: { value: Math.max(PLANET_TUNE.aetherPenumbra, 1e-3) },
      uBeadSparkle: { value: PLANET_TUNE.beadSparkle },
    };
    for (const name of HG_MIRROR_UNIFORMS) uniforms[name] = planetMaterial.uniforms[name];
    uniforms.uSunGlint = { value: planetMaterial.uniforms.uSunGlint.value }; // own: × PLANET_TUNE.beadGlint (upload)
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BEAD_VS,
      fragmentShader: BEAD_FS,
      uniforms,
      ...BEAD_MATERIAL,
    });
  }, [planetMaterial]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  const upload = (gl, coreR) => {
    const n = sim.n;
    geometry.setDrawRange(0, n);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aBead.needsUpdate = true;
    const u = material.uniforms;
    gl.getDrawingBufferSize(u.uViewportPx.value);
    u.uPlanetR.value = coreR;
    u.uLitPen.value = Math.max(PLANET_TUNE.aetherPenumbra, 1e-3);
    u.uSunGlint.value = planetMaterial.uniforms.uSunGlint.value * PLANET_TUNE.beadGlint;
    u.uBeadSparkle.value = PLANET_TUNE.beadSparkle;
  };

  return { geometry, material, renderOrder: BEAD_RENDER_ORDER, sim, upload };
}

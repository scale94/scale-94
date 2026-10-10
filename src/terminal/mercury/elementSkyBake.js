// src/terminal/mercury/elementSkyBake.js — renders the weighted element skies (aetherSky.ELEMENT_SKY_GLSL) into one
// mipmapped cube map, every frame an element's sky is up. Every mirror (planet, droplets, beads, visitors) reads it with
// one textureLod (aetherSky.skyElements) instead of carrying its own copy of ~22 fBm calls, which ANGLE/FXC compiled once
// per call site (2026-10-10: 52 s planet, 47 s visitors on D3D11). The mips are the rough mirror's blur.
import * as THREE from 'three';
import { NEBULA_BAKE_VS } from './planet/nebulaSky';
import { ELEMENT_SKY_FACE, ELEMENT_SKY_BAKE_FS } from './planet/aetherSky';

// Half-float when the renderer can render to it (the earth pings reach SKY_PING_GAIN, past 8-bit); 8-bit otherwise.
export function createElementSky(renderer, halfFloat) {
  const rt = new THREE.WebGLCubeRenderTarget(ELEMENT_SKY_FACE, {
    type: halfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const uniforms = {
    uSkyT: { value: 0 },
    uSkyPhase: { value: new THREE.Vector4() },
    uSkyW: { value: new THREE.Vector4() },
    uSunDir: { value: new THREE.Vector3() },
  };
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: NEBULA_BAKE_VS, fragmentShader: ELEMENT_SKY_BAKE_FS, uniforms,
    side: THREE.BackSide, depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geo, mat));
  const cam = new THREE.CubeCamera(0.1, 10, rt);
  // Linked now (KHR_parallel_shader_compile: off the main thread), so the first element tap does not compile it.
  renderer.compile(scene, cam.children[0]);
  return {
    texture: rt.texture,
    // Copies the planet's live sky uniforms (by value: a calm/tier rebuild swaps the planet's uniform objects), then
    // re-renders the six faces; CubeCamera restores the renderer's target and generates the mips on the last face.
    update(u) {
      uniforms.uSkyT.value = u.uSkyT.value;
      uniforms.uSkyPhase.value.copy(u.uSkyPhase.value);
      uniforms.uSkyW.value.copy(u.uSkyW.value);
      uniforms.uSunDir.value.copy(u.uSunDir.value);
      cam.update(renderer, scene);
    },
    dispose() { rt.dispose(); geo.dispose(); mat.dispose(); },
  };
}

// The droplet pass must draw AFTER the nebula flows and the exosphere tail, yet still depth-test
// against the opaque planet and write depth (so beads behind the planet stay hidden).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WebGLRenderList } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import { EXO_MATERIAL, EXO_RENDER_ORDER } from '../exosphereShader';
import { DROPLET_MATERIAL, DROPLET_RENDER_ORDER } from '../dropletShader';
import fieldSrc from '../../useDropletField.js?raw';
import planetSrc from '../../MercuryPlanet.jsx?raw';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import thermalSrc from '../../../thermal/ThermalFlow.jsx?raw';
import sedimentSrc from '../../../earth/SedimentFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';

const FLOWS = { particleSrc, thermalSrc, sedimentSrc, atmoSrc };

describe('droplet draw order', () => {
  it('is transparent-list, no blending, depth test and write on', () => {
    expect(DROPLET_MATERIAL.transparent).toBe(true);
    expect(DROPLET_MATERIAL.blending).toBe(THREE.NoBlending);
    expect(DROPLET_MATERIAL.depthTest).toBe(true);
    expect(DROPLET_MATERIAL.depthWrite).toBe(true);
    expect(fieldSrc).toMatch(/\.\.\.DROPLET_MATERIAL/);
    expect(fieldSrc).toContain('alphaToCoverage');
  });

  it('renderOrder is above the exosphere, which is above the nebula flows (read from their sources)', () => {
    for (const [name, src] of Object.entries(FLOWS)) expect(src, name).not.toMatch(/renderOrder/); // flows stay at 0
    expect(EXO_RENDER_ORDER).toBeGreaterThan(0);
    expect(DROPLET_RENDER_ORDER).toBeGreaterThan(EXO_RENDER_ORDER);
    expect(fieldSrc).toContain('DROPLET_RENDER_ORDER');
    expect(planetSrc).toContain('renderOrder={field.renderOrder}');
    expect(planetSrc).toMatch(/ref=\{field\.meshRef\}[^>]*visible=\{false\}/); // idle: not drawn
  });

  it("three's sort draws the droplets last of the transparents, though they are nearer than the flows", () => {
    const list = new WebGLRenderList();
    list.init();
    const geo = new THREE.BufferGeometry();
    const exoMat = new THREE.RawShaderMaterial({ ...EXO_MATERIAL });
    const exo = new THREE.Mesh(geo, exoMat);
    exo.renderOrder = EXO_RENDER_ORDER;
    list.push(exo, geo, exoMat, 0, 5.01, null);
    const dMat = new THREE.RawShaderMaterial({ ...DROPLET_MATERIAL });
    const drop = new THREE.Mesh(geo, dMat);
    drop.renderOrder = DROPLET_RENDER_ORDER;
    list.push(drop, geo, dMat, 0, 0.5, null);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.PointsMaterial({ transparent: true, depthWrite: false });
      list.push(new THREE.Points(geo, m), geo, m, 0, 3.6, null);
    }
    list.sort();
    expect(list.opaque.length).toBe(0);
    expect(list.transparent[list.transparent.length - 1].object).toBe(drop);
    expect(list.transparent[list.transparent.length - 2].object).toBe(exo);
  });
});

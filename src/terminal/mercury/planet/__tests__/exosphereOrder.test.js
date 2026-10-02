// The exosphere must draw AFTER the nebula flows. three sorts transparents back to front
// (by renderOrder, then view z); the exo box's centre lies beyond the planet (z ≈ 5.01)
// while the four flow Points sit at ≈ 3.6, so without an explicit renderOrder the opaque-
// sprite nebula paints over the tail (sig-task7-tuning-report §1).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WebGLRenderList } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import { EXO_MATERIAL, EXO_RENDER_ORDER } from '../exosphereShader';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import thermalSrc from '../../../thermal/ThermalFlow.jsx?raw';
import sedimentSrc from '../../../earth/SedimentFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';
import sphereSrc from '../../MercurySphere.jsx?raw';
import exoSrc from '../../MercuryExosphere.jsx?raw';

const FLOWS = { particleSrc, thermalSrc, sedimentSrc, atmoSrc };

function sorted(exoOrder) {
  const list = new WebGLRenderList();
  list.init();
  const geo = new THREE.BufferGeometry();
  const exoMat = new THREE.RawShaderMaterial({ ...EXO_MATERIAL });
  const exo = new THREE.Mesh(geo, exoMat);
  exo.renderOrder = exoOrder;
  list.push(exo, geo, exoMat, 0, 5.01, null);
  const flows = [0, 1, 2, 3].map(() => {
    const m = new THREE.PointsMaterial({ transparent: true, depthWrite: false, blending: THREE.NormalBlending });
    const p = new THREE.Points(geo, m);
    list.push(p, geo, m, 0, 3.6, null);
    return p;
  });
  list.sort();
  return { order: list.transparent.map((r) => r.object), exo, flows };
}

describe('exosphere draw order', () => {
  it('the flows and the orbit ring/handles never set renderOrder (they stay at 0, transparent, no depth write)', () => {
    for (const [name, src] of Object.entries(FLOWS)) {
      expect(src, name).not.toMatch(/renderOrder/);
      expect(src, name).toMatch(/transparent\s/);
      expect(src, name).toMatch(/depthWrite=\{false\}/);
    }
    expect(sphereSrc).not.toMatch(/renderOrder/);
  });

  it('EXO_RENDER_ORDER is above the flows and the mesh uses it', () => {
    expect(EXO_RENDER_ORDER).toBeGreaterThan(0);
    expect(exoSrc).toContain('renderOrder={EXO_RENDER_ORDER}');
    expect(exoSrc).toMatch(/\.\.\.EXO_MATERIAL/);
  });

  it("three's transparent sort puts the exosphere last, though it is the farthest", () => {
    const { order, exo } = sorted(EXO_RENDER_ORDER);
    expect(order[order.length - 1]).toBe(exo);
    // the defect it fixes: at renderOrder 0 the far box draws first and the nebula covers it
    const before = sorted(0);
    expect(before.order[0]).toBe(before.exo);
  });
});

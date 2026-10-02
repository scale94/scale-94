// MercuryExosphere.jsx — the sodium tail + Hg vapour haze box (phase-4 spec §7).
// MercuryPlanet owns the state (`exo`, a mutable object it writes every frame); this
// component only fits the box on change and writes uniforms. Premultiplied "over" (the
// tail dims the backdrop, then adds amber; the halo stays additive), depth-tested, never
// writes depth, drawn after the nebula (EXO_RENDER_ORDER). No allocation per frame.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildExosphereShader, EXO_MATERIAL, EXO_RENDER_ORDER } from './planet/exosphereShader';
import { TAIL_AXIS, exoBox } from './planet/mercuryExosphere';
import { TIERS } from './planet/planetQuality';
import { PLANET_TUNE } from './planet/planetLook';

export default function MercuryExosphere({ exo, tier = 'full' }) {
  const steps = TIERS[tier].exoSteps;
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const shader = useMemo(() => buildExosphereShader({ steps }), [steps]);
  const material = useMemo(() => new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: shader.vs,
    fragmentShader: shader.fs,
    ...EXO_MATERIAL,
    uniforms: {
      uWorldToBox: { value: new THREE.Matrix4() },
      uTailAxis: { value: new THREE.Vector3(...TAIL_AXIS) },
      uTailB: { value: exo.B },
      uTailL: { value: exo.L },
      uCoverage: { value: 0 },
      uExoTime: { value: 0 },
      uExoGain: { value: PLANET_TUNE.exoGain },
    },
  }), [shader, exo]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const mesh = useRef(null);
  const fit = useMemo(() => {
    const a = new THREE.Vector3(...TAIL_AXIS);
    const u = new THREE.Vector3(0, 1, 0).cross(a).normalize();
    const v = new THREE.Vector3().crossVectors(a, u);
    return { a, u, v, m: new THREE.Matrix4(), scale: new THREE.Vector3(), pos: new THREE.Vector3() };
  }, []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const un = material.uniforms;
    if (exo.boxDirty) {
      const { s0, s1, width } = exoBox(exo.L);
      fit.m.makeBasis(fit.a, fit.u, fit.v);
      fit.m.scale(fit.scale.set(s1 - s0, width, width));
      fit.m.setPosition(fit.pos.copy(fit.a).multiplyScalar((s0 + s1) / 2));
      m.matrix.copy(fit.m);
      m.matrixWorldNeedsUpdate = true;
      un.uWorldToBox.value.copy(fit.m).invert();
      exo.boxDirty = false;
    }
    un.uTailB.value = exo.B;
    un.uTailL.value = exo.L;
    un.uCoverage.value = exo.coverage;
    un.uExoTime.value = exo.time;
    un.uExoGain.value = PLANET_TUNE.exoGain;
  });

  // After the nebula flows, which sit at renderOrder 0 and sort nearer (see EXO_RENDER_ORDER).
  return <mesh ref={mesh} renderOrder={EXO_RENDER_ORDER} geometry={geometry} material={material} matrixAutoUpdate={false} frustumCulled={false} />;
}

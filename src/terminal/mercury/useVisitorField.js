// useVisitorField.js — the visitors' body pass (visitors spec §5.5): its material, mesh ref and per-frame upload.
// MercuryPlanet calls upload() after packVisitors in its own useFrame (a child's useFrame would run first and lag a
// frame). The mirror uniforms and uCoreR ARE the planet material's objects (one source of truth), as in useDropletField.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildVisitorShader, VISITOR_MATERIAL, VISITOR_RENDER_ORDER } from './planet/visitorShader';
import { HG_MIRROR_UNIFORMS } from './planet/hgMirrorGlsl';
import { VISITOR_SLOTS } from './planet/visitorSim';

export default function useVisitorField({ planetMaterial }) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);
  const shader = useMemo(() => buildVisitorShader(), []);
  const material = useMemo(() => {
    const vec4s = () => Array.from({ length: VISITOR_SLOTS }, () => new THREE.Vector4());
    const uniforms = {
      uRect: { value: new THREE.Vector4(-1, -1, 1, 1) },
      uVis: { value: vec4s() },
      uVisAx: { value: vec4s() },
      uVisK: { value: vec4s() },
      uVisN: { value: 0 },
      uPxAngle: { value: 1e-3 },
      uTime: { value: 0 },
      uCoreR: planetMaterial.uniforms.uCoreR,
    };
    for (const name of HG_MIRROR_UNIFORMS) uniforms[name] = planetMaterial.uniforms[name];
    return new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: shader.vs, fragmentShader: shader.fs, uniforms, ...VISITOR_MATERIAL });
  }, [shader, planetMaterial]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const meshRef = useRef(null);

  const upload = (frame, tS, pxAngle) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = frame.visible;
    if (!frame.visible) return;
    const u = material.uniforms;
    u.uRect.value.set(frame.rect[0], frame.rect[1], frame.rect[2], frame.rect[3]);
    for (let i = 0; i < frame.n; i++) {
      u.uVis.value[i].fromArray(frame.vis, 4 * i);
      u.uVisAx.value[i].fromArray(frame.ax, 4 * i);
      u.uVisK.value[i].fromArray(frame.k, 4 * i);
    }
    u.uVisN.value = frame.n;
    u.uPxAngle.value = pxAngle;
    u.uTime.value = tS;
  };

  return { geometry, material, meshRef, renderOrder: VISITOR_RENDER_ORDER, upload };
}

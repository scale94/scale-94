// MercuryPlanet.jsx — the planet under the real Sun, and the body you can spin
// (spec 2026-09-30, phases 1–2).
// Owns: impostor mesh, raw material, map loading, the body (drag → torque →
// inertia → recapture, heat, transmutation), per-frame uniform writes.
// All maths lives in ./planet/* and ./orbitNodes (tested); this file only wires it to GL.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_VS, PLANET_FS } from './planet/mercuryPlanetShader';
import { mercuryEphemeris } from './planet/mercuryEphemeris';
import { SUN_DIR_WORLD, bodyYawFor } from './planet/planetFrame';
import { PLANET_TUNE, MEAN_R_AU } from './planet/planetLook';
import { AETHER_BASE_DIRS, aetherLobeColors, aetherLobeDirs } from './planet/aetherLobes';
import { MAPS } from './planet/mercuryMaps.generated';
import { subsolarTempK } from './planet/mercuryThermal';
import { createBody, stepBody, targetFromYaw } from './planet/mercuryBody';
import { ORBIT_NODES, orbitPrecessionAngle, nodeWorldPosition } from './orbitNodes';
import useMercuryDrag from './useMercuryDrag';
import { registerTuningRig } from './mercuryTuning';

const EPHEMERIS_REFRESH_S = 1;
const MAX_FRAME_DT_S = 0.1; // a backgrounded tab must not fling the body
const EMIT_COLORS = ORBIT_NODES.map((n) => new THREE.Color(n.color)); // linear

export function planetEphemerisUniforms(nowMs) {
  const eph = mercuryEphemeris(nowMs);
  return {
    yaw: bodyYawFor(eph.subsolarLonDeg),
    irr: (MEAN_R_AU / eph.r) ** 2,
    sinR: Math.sin(eph.sunAngularRadiusRad),
    subsolarLonDeg: eph.subsolarLonDeg,
    subsolarT: subsolarTempK(eph.r),
  };
}

function loadMap(loader, url, srgb) {
  return new Promise((resolve, reject) => {
    loader.load(url, (tex) => {
      tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      resolve(tex);
    }, undefined, reject);
  });
}

export default function MercuryPlanet({ isMobile = false, emitters = {} }) {
  const gl = useThree((s) => s.gl);
  const drag = useMercuryDrag(gl.domElement);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const init = useMemo(() => planetEphemerisUniforms(Date.now()), []);
  const target = useMemo(() => targetFromYaw(init.yaw), [init]);
  const body = useMemo(() => createBody(target), [target]);
  const m4 = useMemo(() => new THREE.Matrix4(), []);

  const material = useMemo(() => new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: PLANET_VS,
    fragmentShader: PLANET_FS,
    alphaToCoverage: !isMobile,
    uniforms: {
      uAlbedo: { value: null },
      uDem: { value: null },
      uHasMaps: { value: 0 },
      uSunDir: { value: new THREE.Vector3(...SUN_DIR_WORLD) },
      uBodyRot: { value: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(body.q)) },
      uSunIrr: { value: init.irr },
      uSunSinR: { value: init.sinR },
      uDemTexel: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uExposure: { value: PLANET_TUNE.exposure },
      uRelief: { value: PLANET_TUNE.relief },
      uNightFloor: { value: PLANET_TUNE.nightFloor },
      uTau: { value: 0 },
      uHeatK: { value: 0 },
      uSubsolarT: { value: init.subsolarT },
      uEmitPos: { value: ORBIT_NODES.map(() => new THREE.Vector3()) },
      uEmitCol: { value: ORBIT_NODES.map(() => new THREE.Vector3()) },
      uSunGlint: { value: PLANET_TUNE.sunGlint },
      uEmitGain: { value: PLANET_TUNE.emitGain },
      uAethDir: { value: AETHER_BASE_DIRS.map((d) => new THREE.Vector3(...d)) },
      uAethCol: { value: AETHER_BASE_DIRS.map(() => new THREE.Vector3()) },
      uAetherGain: { value: PLANET_TUNE.aetherGain },
      uAetherSinW: { value: PLANET_TUNE.aetherSinW },
      uAetherSilver: { value: PLANET_TUNE.aetherSilver },
      uAetherEdge: { value: PLANET_TUNE.aetherEdge },
      uAetherStretch: { value: PLANET_TUNE.aetherStretch },
    },
  }), [isMobile, init, body]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Dev-only console tuning rig (window.__mercuryTune). Zero prod footprint.
  useEffect(() => {
    if (import.meta.env.DEV) registerTuningRig();
  }, []);

  const emitRef = useRef(emitters);
  const aether = useMemo(() => ({
    dirs: AETHER_BASE_DIRS.map((d) => [...d]),
    cols: AETHER_BASE_DIRS.map(() => [0, 0, 0]),
  }), []);
  useEffect(() => { emitRef.current = emitters; }, [emitters]);

  useEffect(() => {
    const set = isMobile ? MAPS.mobile : MAPS.desktop;
    const loader = new THREE.TextureLoader();
    let disposed = false;
    let textures = [];
    Promise.all([loadMap(loader, set.albedo, true), loadMap(loader, set.dem, false)])
      .then(([albedo, dem]) => {
        textures = [albedo, dem];
        if (disposed) { textures.forEach((t) => t.dispose()); return; }
        const u = material.uniforms;
        u.uAlbedo.value = albedo;
        u.uDem.value = dem;
        u.uDemTexel.value.set(1 / set.demSize[0], 1 / set.demSize[1]);
        u.uHasMaps.value = 1;
      })
      .catch((err) => console.error('[mercury] planet maps failed; flat fallback stays', err));
    return () => { disposed = true; textures.forEach((t) => t.dispose()); };
  }, [material, isMobile]);

  const nextEphemeris = useRef(0);
  useFrame(({ clock }, delta) => {
    const u = material.uniforms;
    const t = clock.elapsedTime;
    u.uTime.value = t;
    u.uExposure.value = PLANET_TUNE.exposure;
    u.uRelief.value = PLANET_TUNE.relief;
    u.uNightFloor.value = PLANET_TUNE.nightFloor;
    u.uSunGlint.value = PLANET_TUNE.sunGlint;
    u.uEmitGain.value = PLANET_TUNE.emitGain;
    u.uAetherGain.value = PLANET_TUNE.aetherGain;
    u.uAetherSinW.value = PLANET_TUNE.aetherSinW;
    u.uAetherSilver.value = PLANET_TUNE.aetherSilver;
    u.uAetherEdge.value = PLANET_TUNE.aetherEdge;
    u.uAetherStretch.value = PLANET_TUNE.aetherStretch;
    if (t >= nextEphemeris.current) {
      nextEphemeris.current = t + EPHEMERIS_REFRESH_S;
      const e = planetEphemerisUniforms(Date.now());
      targetFromYaw(e.yaw, target);
      u.uSunIrr.value = e.irr;
      u.uSunSinR.value = e.sinR;
      u.uSubsolarT.value = e.subsolarT;
    }

    const { dragging, omegaPtr } = drag.sample(performance.now());
    stepBody(body, Math.min(delta, MAX_FRAME_DT_S), { dragging, omegaPtr, target });
    u.uBodyRot.value.setFromMatrix4(m4.makeRotationFromQuaternion(body.q));
    u.uTau.value = body.tau;
    u.uHeatK.value = body.heatK;

    const precession = orbitPrecessionAngle(t);
    ORBIT_NODES.forEach((node, i) => {
      const [x, y, z] = nodeWorldPosition(node.angle, precession);
      u.uEmitPos.value[i].set(x, y, z);
      const o = emitRef.current[node.phase] ?? 0;
      const c = EMIT_COLORS[i];
      u.uEmitCol.value[i].set(c.r * o, c.g * o, c.b * o);
    });

    aetherLobeDirs(t, aether.dirs);
    aetherLobeColors(emitRef.current, aether.cols);
    for (let i = 0; i < aether.dirs.length; i++) {
      u.uAethDir.value[i].set(aether.dirs[i][0], aether.dirs[i][1], aether.dirs[i][2]);
      u.uAethCol.value[i].set(aether.cols[i][0], aether.cols[i][1], aether.cols[i][2]);
    }
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

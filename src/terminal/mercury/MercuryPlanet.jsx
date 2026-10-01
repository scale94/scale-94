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
import { PLANET_TUNE, MEAN_R_AU, R_SCENE } from './planet/planetLook';
import { AETHER_BASE_DIRS, aetherLobeColors, aetherLobeDirs } from './planet/aetherLobes';
import { MAPS } from './planet/mercuryMaps.generated';
import { subsolarTempK } from './planet/mercuryThermal';
import { createScarMap, stampCrater, matureScars, healScars, SCAR_TICK_S } from './planet/scarMap';
import {
  IMPULSE_SLOTS, createImpulses, addImpulse, createImpulseFrame, impulseFrame, spinBulge, createWake, wakeImpulse,
} from './planet/mercuryWaves';
import {
  IMPACT_MODE_AMP, IMPACT_WAVE_AMP, strikeDirWorld, worldToBody, bodyToWorld, localTempK, impactKind,
} from './planet/mercuryImpacts';
import { pickSphereDir } from './planet/pickSphere';
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

export default function MercuryPlanet({ isMobile = false, emitters = {}, strikes = null }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const drag = useMercuryDrag(gl.domElement);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const init = useMemo(() => planetEphemerisUniforms(Date.now()), []);
  const target = useMemo(() => targetFromYaw(init.yaw), [init]);
  const body = useMemo(() => createBody(target), [target]);
  const m4 = useMemo(() => new THREE.Matrix4(), []);

  // The crust's memory (scarMap.js): a CPU buffer uploaded as RGBA8. Neutral = no scars.
  const scar = useMemo(() => createScarMap(), []);
  const scarTex = useMemo(() => {
    const tex = new THREE.DataTexture(scar.bytes, scar.w, scar.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }, [scar]);
  useEffect(() => () => scarTex.dispose(), [scarTex]);

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
      uAetherCurve: { value: PLANET_TUNE.aetherCurve },
      uAetherCore: { value: PLANET_TUNE.aetherCore },
      uScar: { value: scarTex },
      uRayGain: { value: PLANET_TUNE.rayGain },
      uSurfOn: { value: 0 },
      uImpDir: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3(0, 0, 1)) },
      uImpMode: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3()) },
      uImpWave: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector2()) },
      uBulge: { value: new THREE.Vector4(0, 1, 0, 0) },
    },
  }), [isMobile, init, body, scarTex]);

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

  // Phase 3 state: the bead's impulses, the drag wake, the scar clock. Preallocated; useFrame allocates nothing.
  const surf = useMemo(() => ({
    impulses: createImpulses(),
    frame: createImpulseFrame(),
    wake: createWake(),
    bulge: [0, 1, 0, 0],
    seed: 1,
    scarClock: 0,
    dragDirBody: [0, 0, 1],
    hasDragDir: false,
    w: [0, 0, 0],
    b: [0, 0, 0],
    nodePos: [0, 0, 0],
    cam: [0, 0, 0],
    wakeArgs: { tS: 0, dragging: false, released: false, ptrOmega: 0, bodyOmega: 0, tau: 0 },
    frameOpts: { modeScale: 1, waveScale: 1 },
  }), []);

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
    u.uAetherCurve.value = PLANET_TUNE.aetherCurve;
    u.uAetherCore.value = PLANET_TUNE.aetherCore;
    u.uRayGain.value = PLANET_TUNE.rayGain;
    if (t >= nextEphemeris.current) {
      nextEphemeris.current = t + EPHEMERIS_REFRESH_S;
      const e = planetEphemerisUniforms(Date.now());
      targetFromYaw(e.yaw, target);
      u.uSunIrr.value = e.irr;
      u.uSunSinR.value = e.sinR;
      u.uSubsolarT.value = e.subsolarT;
    }

    const ds = drag.sample(performance.now());
    const { dragging, omegaPtr } = ds;
    stepBody(body, Math.min(delta, MAX_FRAME_DT_S), { dragging, omegaPtr, target });
    u.uBodyRot.value.setFromMatrix4(m4.makeRotationFromQuaternion(body.q));
    u.uTau.value = body.tau;
    u.uHeatK.value = body.heatK;

    // --- Phase 3: strikes, wake, scars, the bead ---
    const precession = orbitPrecessionAngle(t);
    surf.cam[0] = camera.position.x; surf.cam[1] = camera.position.y; surf.cam[2] = camera.position.z;

    const queue = strikes?.current;
    let scarDirty = false;
    while (queue && queue.length > 0) {
      const phase = queue.shift();
      const node = ORBIT_NODES.find((n) => n.phase === phase);
      if (!node) continue;
      const p = nodeWorldPosition(node.angle, precession);
      surf.nodePos[0] = p[0]; surf.nodePos[1] = p[1]; surf.nodePos[2] = p[2];
      strikeDirWorld(surf.nodePos, surf.cam, surf.w);
      worldToBody(surf.w, body.q, surf.b);
      const kind = impactKind(body.tau, localTempK(surf.w, SUN_DIR_WORLD, u.uSubsolarT.value, body.heatK));
      if (kind === 'crater') {
        stampCrater(scar, surf.b, surf.seed++);
        scarDirty = true;
      } else {
        addImpulse(surf.impulses, { dirBody: surf.b, tS: t, mode: IMPACT_MODE_AMP[kind], wave: IMPACT_WAVE_AMP[kind], kind });
      }
    }

    if ((ds.dragging || ds.released) && ds.aimed && pickSphereDir(ds.ndc, camera, R_SCENE, surf.w)) {
      worldToBody(surf.w, body.q, surf.dragDirBody);
      surf.hasDragDir = true;
    }
    const ptrOmega = Math.hypot(omegaPtr[0], omegaPtr[1], omegaPtr[2]);
    surf.wakeArgs.tS = t;
    surf.wakeArgs.dragging = dragging;
    surf.wakeArgs.released = ds.released;
    surf.wakeArgs.ptrOmega = ptrOmega;
    surf.wakeArgs.bodyOmega = body.omega.length();
    surf.wakeArgs.tau = body.tau;
    const imp = wakeImpulse(surf.wake, surf.wakeArgs);
    if (imp && surf.hasDragDir) addImpulse(surf.impulses, { dirBody: surf.dragDirBody, tS: t, ...imp });
    if (ds.released) surf.hasDragDir = false;

    if (body.tau >= 1 && healScars(scar)) scarDirty = true;
    surf.scarClock += Math.min(delta, MAX_FRAME_DT_S);
    if (surf.scarClock >= SCAR_TICK_S) {
      if (matureScars(scar, surf.scarClock)) scarDirty = true;
      surf.scarClock = 0;
    }
    if (scarDirty) scarTex.needsUpdate = true;

    surf.frameOpts.modeScale = body.tau * PLANET_TUNE.modeGain;
    surf.frameOpts.waveScale = PLANET_TUNE.waveGain;
    impulseFrame(surf.impulses, t, surf.frameOpts, surf.frame);
    for (let i = 0; i < IMPULSE_SLOTS; i++) {
      bodyToWorld(surf.impulses.slots[i].dir, body.q, surf.w);
      u.uImpDir.value[i].set(surf.w[0], surf.w[1], surf.w[2]);
      u.uImpMode.value[i].set(surf.frame.mode[3 * i], surf.frame.mode[3 * i + 1], surf.frame.mode[3 * i + 2]);
      u.uImpWave.value[i].set(surf.frame.wave[2 * i], surf.frame.wave[2 * i + 1]);
    }
    spinBulge(body.omega, body.tau * PLANET_TUNE.modeGain, surf.bulge);
    u.uBulge.value.set(surf.bulge[0], surf.bulge[1], surf.bulge[2], surf.bulge[3]);
    u.uSurfOn.value = surf.frame.any || Math.abs(surf.bulge[3]) > 1e-5 ? 1 : 0;

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

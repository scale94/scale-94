// MercuryPlanet.jsx — the planet under the real Sun, and the body you can spin
// (spec 2026-09-30, phases 1–2).
// Owns: impostor mesh, raw material, map loading, the body (drag → torque →
// inertia → recapture, heat, transmutation), per-frame uniform writes.
// All maths lives in ./planet/* and ./orbitNodes (tested); this file only wires it to GL.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildPlanetShader } from './planet/mercuryPlanetShader';
import { impulseOrder, TIERS } from './planet/planetQuality';
import { PERF_INFO } from './planet/perfStats';
import { mercuryEphemeris } from './planet/mercuryEphemeris';
import { SUN_DIR_WORLD, bodyYawFor } from './planet/planetFrame';
import { PLANET_TUNE, MEAN_R_AU, R_SCENE } from './planet/planetLook';
import { AETHER_BASE_DIRS, aetherLobeColors, aetherLobeDirs } from './planet/aetherLobes';
import { MAPS } from './planet/mercuryMaps.generated';
import { bindPlanetMaps } from './planet/planetMaps';
import { subsolarTempK } from './planet/mercuryThermal';
import { createScarMap, stampCrater, matureScars, healScars, SCAR_TICK_S } from './planet/scarMap';
import {
  IMPULSE_SLOTS, createImpulses, addImpulse, createImpulseFrame, impulseFrame, spinBulge, createWake, wakeImpulse, slipDirWorld,
  shapeHeight,
} from './planet/mercuryWaves';
import {
  IMPACT_MODE_AMP, IMPACT_WAVE_AMP, strikeDirWorld, worldToBody, bodyToWorld, localTempK, impactKind, calmGlow,
} from './planet/mercuryImpacts';
import { pickSphereDir } from './planet/pickSphere';
import { popZoom, subsolarPxArc } from './planet/mercuryRoil';
import { createBody, stepBody, coolBody, targetFromYaw } from './planet/mercuryBody';
import { ORBIT_NODES, orbitPrecessionAngle, nodeWorldPosition } from './orbitNodes';
import useMercuryDrag from './useMercuryDrag';
import { registerTuningRig, DEV_OVERRIDES } from './mercuryTuning';
import MercuryExosphere from './MercuryExosphere';
import { tailBrightness, tailLength, boilCoverage } from './planet/mercuryExosphere';
import {
  createFamily, canHold, canFire, breakExcess, tongueAxis, holdTongue, fireFamily, nextSnapIn, qRotateInv, DROP_V_REF,
} from './planet/breakupFamily';
import { TONGUE_MAX_R, sigmaRatio } from './planet/breakupPhysics';
import { stepFamily, DROP_DT } from './planet/breakupStep';
import { muRef, returnTarget, createMuSolver, stepMuSolver, solverBudget, finishMuSolver } from './planet/breakupBudget';
import { createDropFrame, packFamily, pxPerUnitAt, pxAngleOf } from './planet/breakupFrame';
import useDropletField from './useDropletField';

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
    tailB: tailBrightness(nowMs),
    vrKmS: eph.rdotKmS,
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

// Phase 5: release → a family, a provisional pull, and the budget solver (it lands before the first neck snaps).
function fireDrop(drop, omega, heatK) {
  const fam = drop.fam;
  fam.e = breakExcess(omega, drop.env.omegaTh);
  fireFamily(fam, { maxBodies: drop.frame.caps.bodies, satellites: drop.frame.caps.satellites });
  fam.mu = muRef(drop.env.omegaTh);
  drop.solver = createMuSolver(fam, drop.env, returnTarget(heatK, PLANET_TUNE.dropDrift));
  drop.warned = false;
}

// Phase 5, once per frame (spec 2026-10-02): hold the tongues, fire on release, step the family, pack the
// field. Its own function so the frame loop's hot path stays small and a heap profile names it. Allocates
// nothing on the idle and hold paths; fire time and snap / merge events may.
function stepDrop(drop, { body, surf, camera, ds, calm, stepS, t, bufferW, bufferH }) {
  const fam = drop.fam;
  if (calm) {
    if (fam.phase !== 'idle') { Object.assign(fam, createFamily(fam.seed)); drop.solver = null; }
    drop.frame.visible = false;
    PERF_INFO.dropPrims = 0; PERF_INFO.dropAreaPx = 0; PERF_INFO.sigma = 0;
  } else {
    const env = drop.env;
    env.q[0] = body.q.x; env.q[1] = body.q.y; env.q[2] = body.q.z; env.q[3] = body.q.w;
    env.omega[0] = body.omega.x; env.omega[1] = body.omega.y; env.omega[2] = body.omega.z;
    env.gamma = PLANET_TUNE.dropDrag;
    env.kappa = PLANET_TUNE.dropCohesion;
    env.omegaTh = PLANET_TUNE.breakOmega;
    env.pxPerUnit = pxPerUnitAt(camera.position.length(), camera.fov, bufferH);
    const dropDt = stepS * (DEV_OVERRIDES.dropTimeScale ?? 1);
    let omega = body.omega.length();
    let holding = ds.dragging;
    if (DEV_OVERRIDES.holdOmega != null && fam.phase !== 'fired') { holding = true; omega = DEV_OVERRIDES.holdOmega; }
    if (DEV_OVERRIDES.breakNow != null) {
      const w = DEV_OVERRIDES.breakNow;
      DEV_OVERRIDES.breakNow = null;
      if (fam.phase !== 'fired' && body.tau >= 1) {
        // Dev rig: fire as if released at w rad/s about the current spin axis (world Y at rest).
        const l = Math.hypot(env.omega[0], env.omega[1], env.omega[2]);
        if (l > 1e-6) { env.omega[0] *= w / l; env.omega[1] *= w / l; env.omega[2] *= w / l; } else { env.omega[0] = 0; env.omega[1] = w; env.omega[2] = 0; }
        // …and really spin the body at w: the beads launch at ω × p when their necks snap (breakupStep),
        // so without this they would drop off a still planet the solver replayed as spinning.
        body.omega.set(env.omega[0], env.omega[1], env.omega[2]);
        body.sinceReleaseS = 0; // a fresh release: inertia first, recapture ramps in (mercuryBody)
        omega = w;
        if (fam.phase === 'idle') {
          qRotateInv(env.q, env.omega, drop.spinBody);
          tongueAxis(drop.spinBody, null, fam.axisBody);
          fam.L = breakExcess(w, env.omegaTh) * PLANET_TUNE.breakGain * TONGUE_MAX_R;
        }
        fam.phase = 'hold';
        fireDrop(drop, w, body.heatK);
      }
    }
    if (fam.phase === 'idle' || fam.phase === 'hold') {
      const st = drop.st; // written in place: the idle and hold paths allocate nothing
      st.tau = body.tau; st.omega = omega; st.omegaTh = env.omegaTh; st.calm = calm; st.phase = fam.phase;
      st.released = ds.released; st.heatK = body.heatK; st.dragging = holding;
      if (canFire(st)) {
        fireDrop(drop, omega, body.heatK);
      } else if (canHold(st)) {
        if (fam.phase === 'idle') {
          fam.phase = 'hold';
          qRotateInv(env.q, env.omega, drop.spinBody);
          tongueAxis(drop.spinBody, surf.hasDragDir ? surf.dragDirBody : null, fam.axisBody);
        }
        holdTongue(fam, dropDt, breakExcess(omega, env.omegaTh), PLANET_TUNE.breakGain);
      } else if (fam.phase === 'hold') {
        holdTongue(fam, dropDt, 0, PLANET_TUNE.breakGain);
        if (fam.L < 1e-4) { fam.L = 0; fam.phase = 'idle'; }
      }
    }
    if (fam.phase === 'fired') {
      const sv = drop.solver;
      if (sv && !sv.done) {
        stepMuSolver(sv, solverBudget(sv, Math.max(1, Math.floor(nextSnapIn(fam) / dropDt))));
        // never let a drop fly on a provisional pull: this frame can advance the family by up to dropDt plus one
        // leftover DROP_DT substep (stepFamily's accumulator), so finish whenever the next snap is inside that
        if (!sv.done && nextSnapIn(fam) < dropDt + DROP_DT) finishMuSolver(sv);
        if (sv.done) {
          fam.mu = sv.best;
          if (import.meta.env.DEV && !sv.landed && !drop.warned) {
            drop.warned = true;
            console.warn(`[mercury] breakup: no pull up to mu ${sv.best.toPrecision(3)} lands the drops by the ${sv.target.toFixed(1)} s target (dropDrag ${PLANET_TUNE.dropDrag}); they may come home late`);
          }
        }
      }
      stepFamily(fam, dropDt, env);
      for (const ev of fam.events) {
        worldToBody(ev.dir, body.q, surf.b);
        addImpulse(surf.impulses, { dirBody: surf.b, tS: t, mode: ev.mode, wave: ev.wave, kind: ev.kind });
      }
      fam.events.length = 0;
    }
    drop.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    drop.view.vp.set(drop.m.elements);
    drop.view.p00 = camera.projectionMatrix.elements[0];
    drop.view.p11 = camera.projectionMatrix.elements[5];
    drop.view.wPx = bufferW;
    drop.view.hPx = bufferH;
    packFamily(fam, env, drop.frame, drop.view);
    drop.frame.pxAngle = pxAngleOf(camera.fov, bufferH);
    PERF_INFO.dropPrims = drop.frame.nb + drop.frame.nn + drop.frame.nk;
    PERF_INFO.dropAreaPx = drop.frame.areaPx;
    PERF_INFO.sigma = sigmaRatio(omega);
  }
}

export default function MercuryPlanet({ isMobile = false, tier = 'full', calm = false, emitters = {}, strikes = null }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  // The drawing buffer's height in device px: the pops are sized from it (mercuryRoil.popZoom).
  const bufferH = useThree((s) => s.size.height * s.viewport.dpr);
  const bufferW = useThree((s) => s.size.width * s.viewport.dpr);
  const drag = useMercuryDrag(gl.domElement);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const init = useMemo(() => planetEphemerisUniforms(Date.now()), []);
  const target = useMemo(() => targetFromYaw(init.yaw), [init]);
  const body = useMemo(() => createBody(target), [target]);
  // The exosphere's state (MercuryExosphere reads it every frame; written here, allocation-free).
  const exo = useMemo(() => ({ B: init.tailB, L: tailLength(init.tailB), coverage: 0, time: 0, boxDirty: true }), [init]);
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

  const shader = useMemo(() => buildPlanetShader({ tier, calm }), [tier, calm]);
  const material = useMemo(() => new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: shader.vs,
    fragmentShader: shader.fs,
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
      uRoilGain: { value: PLANET_TUNE.roilGain },
      uRoughLiquid: { value: PLANET_TUNE.roughLiquid },
      uMeniscus: { value: PLANET_TUNE.meniscus },
      uMeniscusW: { value: PLANET_TUNE.meniscusW },
      uPopZoom: { value: 1 },
      uSurfOn: { value: 0 },
      uImpDir: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3(0, 0, 1)) },
      uImpMode: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3()) },
      uImpWave: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3()) },
      uBulge: { value: new THREE.Vector4(0, 1, 0, 0) },
      uGlow: { value: new THREE.Vector4(0, 0, 1, 0) },
    },
  }), [isMobile, init, body, scarTex, shader]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Dev-only console tuning rig (window.__mercuryTune). Zero prod footprint.
  useEffect(() => {
    if (import.meta.env.DEV) { registerTuningRig(); window.__mercuryPerf = PERF_INFO; }
  }, []);

  const emitRef = useRef(emitters);
  const aether = useMemo(() => ({
    dirs: AETHER_BASE_DIRS.map((d) => [...d]),
    cols: AETHER_BASE_DIRS.map(() => [0, 0, 0]),
  }), []);
  useEffect(() => { emitRef.current = emitters; }, [emitters]);

  // Phase 3 state: the bead's impulses, the drag wake, the scar clock. Preallocated; useFrame allocates nothing.
  const surf = useMemo(() => ({
    order: Array.from({ length: IMPULSE_SLOTS }, (_, i) => i),
    impulses: createImpulses(),
    frame: createImpulseFrame(),
    wake: createWake(),
    bulge: [0, 1, 0, 0],
    seed: 1,
    scarClock: 0,
    aetherT: 0,
    glowT0: -Infinity,
    glowDirBody: [0, 0, 1],
    dragDirBody: [0, 0, 1],
    dragDirWorld: [0, 0, 1],
    hasDragDir: false,
    w: [0, 0, 0],
    b: [0, 0, 0],
    nodePos: [0, 0, 0],
    cam: [0, 0, 0],
    wakeArgs: { tS: 0, dragging: false, released: false, ptrOmega: 0, bodyOmega: 0, tau: 0 },
    frameOpts: { modeScale: 1, waveScale: 1 },
    dirsW: Array.from({ length: IMPULSE_SLOTS }, () => [0, 0, 1]),
  }), []);

  // Phase 5 state: the droplet family, its solver, the packed frame, the sim's view of the world.
  const drop = useMemo(() => {
    const d = {
      fam: createFamily(1), solver: null, warned: false, frame: createDropFrame(TIERS[tier].drop), spinBody: [0, 0, 0],
      env: { q: [0, 0, 0, 1], omega: [0, 0, 0], gamma: 0, kappa: 0, vRef: DROP_V_REF, pxPerUnit: 1, omegaTh: 7.5, planetRadiusAt: null },
      view: { vp: new Float32Array(16), p00: 1, p11: 1, wPx: 1, hPx: 1 }, m: new THREE.Matrix4(),
      // canHold / canFire read their fields from this one object, written in place (no per-frame spread).
      st: { tau: 0, omega: 0, omegaTh: 0, calm: false, phase: 'idle', released: false, heatK: 0, dragging: false },
      // stepDrop's per-frame arguments, written in place.
      args: { body: null, surf: null, camera: null, ds: null, calm: false, stepS: 0, t: 0, bufferW: 1, bufferH: 1 },
    };
    // The planet's live surface (body modes + bulge) where a drop lands: the shader's shapeH, mirrored.
    d.env.planetRadiusAt = (dir) => R_SCENE * (1 + shapeHeight(dir, surf.dirsW, surf.frame.mode, surf.bulge));
    return d;
  }, [tier, surf]);
  const field = useDropletField({ tier, isMobile, planetMaterial: material, caps: TIERS[tier].drop });
  useEffect(() => { if (import.meta.env.DEV) window.__mercuryDrop = drop; }, [drop]);

  // The maps outlive the material: a live CALM toggle swaps the shader variant (a new
  // material) without reloading them or flashing the flat fallback (planetMaps.js).
  const [maps, setMaps] = useState(null);
  useEffect(() => {
    const set = isMobile ? MAPS.mobile : MAPS.desktop;
    const loader = new THREE.TextureLoader();
    let disposed = false;
    let textures = [];
    Promise.all([loadMap(loader, set.albedo, true), loadMap(loader, set.dem, false)])
      .then(([albedo, dem]) => {
        textures = [albedo, dem];
        if (disposed) { textures.forEach((t) => t.dispose()); return; }
        setMaps({ albedo, dem, demSize: set.demSize });
      })
      .catch((err) => console.error('[mercury] planet maps failed; flat fallback stays', err));
    return () => { disposed = true; textures.forEach((t) => t.dispose()); setMaps(null); };
  }, [isMobile]);
  // Layout effects run in the commit that attaches a new material, before r3f's next frame.
  useLayoutEffect(() => { bindPlanetMaps(material.uniforms, maps); }, [material, maps]);

  // Pop size from the screen: on mount, on resize / DPR change, and for each new material; never per frame.
  // The pop lattice re-forms only here, so a pop never jumps mid-life except on a resize.
  useLayoutEffect(() => {
    material.uniforms.uPopZoom.value = popZoom(subsolarPxArc(isMobile ? 'mobile' : 'desktop', bufferH));
  }, [material, bufferH, isMobile]);

  // A new material starts from the mount-time ephemeris; refresh it on the very next frame.
  const nextEphemeris = useRef(0);
  useLayoutEffect(() => { nextEphemeris.current = 0; }, [material]);
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
    u.uRoilGain.value = PLANET_TUNE.roilGain;
    u.uRoughLiquid.value = PLANET_TUNE.roughLiquid;
    u.uMeniscus.value = PLANET_TUNE.meniscus;
    u.uMeniscusW.value = PLANET_TUNE.meniscusW;
    if (t >= nextEphemeris.current) {
      nextEphemeris.current = t + EPHEMERIS_REFRESH_S;
      const e = planetEphemerisUniforms(DEV_OVERRIDES.dateMs ?? Date.now());
      targetFromYaw(e.yaw, target);
      u.uSunIrr.value = e.irr;
      u.uSunSinR.value = e.sinR;
      u.uSubsolarT.value = e.subsolarT;
      exo.B = e.tailB;
      const L = tailLength(e.tailB);
      if (Math.abs(L - exo.L) > 1e-4) { exo.L = L; exo.boxDirty = true; }
      PERF_INFO.tailB = e.tailB;
      PERF_INFO.vrKmS = e.vrKmS;
    }

    const ds = drag.sample(performance.now());
    const { dragging, omegaPtr } = ds;
    const stepS = Math.min(delta, MAX_FRAME_DT_S);
    stepBody(body, stepS, { dragging, omegaPtr, target, calm });
    coolBody(body, delta - stepS); // the clamp holds the body still, not the heat: a hidden tab still cools
    u.uBodyRot.value.setFromMatrix4(m4.makeRotationFromQuaternion(body.q));
    u.uTau.value = body.tau;
    u.uHeatK.value = body.heatK;
    PERF_INFO.tau = body.tau;
    PERF_INFO.heatK = body.heatK;
    exo.coverage = boilCoverage(body.tau, body.heatK, u.uSubsolarT.value);
    if (!calm) exo.time += stepS; // the streamers hold still under reduced motion
    PERF_INFO.coverage = exo.coverage;

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
      } else if (calm) {
        surf.glowT0 = t; // reduced motion: the tap brightens the point instead of ringing
        surf.glowDirBody[0] = surf.b[0]; surf.glowDirBody[1] = surf.b[1]; surf.glowDirBody[2] = surf.b[2];
      } else {
        addImpulse(surf.impulses, { dirBody: surf.b, tS: t, mode: IMPACT_MODE_AMP[kind], wave: IMPACT_WAVE_AMP[kind], kind });
      }
    }

    if ((ds.dragging || ds.released) && ds.aimed && pickSphereDir(ds.ndc, camera, R_SCENE, surf.w)) {
      worldToBody(surf.w, body.q, surf.dragDirBody);
      surf.dragDirWorld[0] = surf.w[0]; surf.dragDirWorld[1] = surf.w[1]; surf.dragDirWorld[2] = surf.w[2];
      surf.hasDragDir = true;
    }
    const ptrOmega = Math.hypot(omegaPtr[0], omegaPtr[1], omegaPtr[2]);
    surf.wakeArgs.tS = t;
    surf.wakeArgs.dragging = dragging;
    surf.wakeArgs.released = ds.released;
    surf.wakeArgs.ptrOmega = ptrOmega;
    surf.wakeArgs.bodyOmega = body.omega.length();
    surf.wakeArgs.tau = body.tau;
    const imp = calm ? null : wakeImpulse(surf.wake, surf.wakeArgs);
    if (imp && surf.hasDragDir) addImpulse(surf.impulses, { dirBody: surf.dragDirBody, dirWorld: surf.dragDirWorld, tS: t, ...imp });
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
    // Strongest first: a tier whose shader loops over fewer slots draws the ones that show.
    impulseOrder(surf.frame, IMPULSE_SLOTS, surf.order);
    for (let j = 0; j < IMPULSE_SLOTS; j++) {
      const i = surf.order[j];
      const slot = surf.impulses.slots[i];
      bodyToWorld(slot.dir, body.q, surf.w);
      slipDirWorld(surf.w, slot.dirWorld0, slot.slip, surf.w);
      surf.dirsW[i][0] = surf.w[0]; surf.dirsW[i][1] = surf.w[1]; surf.dirsW[i][2] = surf.w[2];
      u.uImpDir.value[j].set(surf.w[0], surf.w[1], surf.w[2]);
      u.uImpMode.value[j].set(surf.frame.mode[3 * i], surf.frame.mode[3 * i + 1], surf.frame.mode[3 * i + 2]);
      u.uImpWave.value[j].set(surf.frame.wave[2 * i], surf.frame.wave[2 * i + 1], surf.frame.dimple[i]);
    }
    spinBulge(body.omega, calm ? 0 : body.tau * PLANET_TUNE.modeGain, surf.bulge);
    u.uBulge.value.set(surf.bulge[0], surf.bulge[1], surf.bulge[2], surf.bulge[3]);
    u.uSurfOn.value = !calm && (surf.frame.any || Math.abs(surf.bulge[3]) > 1e-5) ? 1 : 0;

    // --- Phase 5: breakup (spec 2026-10-02) ---
    const da = drop.args;
    da.body = body; da.surf = surf; da.camera = camera; da.calm = calm; da.ds = ds; da.stepS = stepS; da.t = t; da.bufferW = bufferW; da.bufferH = bufferH;
    stepDrop(drop, da);
    field.upload(drop.frame, t);
    if (calm) {
      bodyToWorld(surf.glowDirBody, body.q, surf.w);
      u.uGlow.value.set(surf.w[0], surf.w[1], surf.w[2], calmGlow(t - surf.glowT0));
    }

    ORBIT_NODES.forEach((node, i) => {
      const [x, y, z] = nodeWorldPosition(node.angle, precession);
      u.uEmitPos.value[i].set(x, y, z);
      const o = emitRef.current[node.phase] ?? 0;
      const c = EMIT_COLORS[i];
      u.uEmitCol.value[i].set(c.r * o, c.g * o, c.b * o);
    });

    if (!calm) surf.aetherT += delta; // reduced motion freezes the streak drift (D5)
    aetherLobeDirs(surf.aetherT, aether.dirs);
    aetherLobeColors(emitRef.current, aether.cols);
    for (let i = 0; i < aether.dirs.length; i++) {
      u.uAethDir.value[i].set(aether.dirs[i][0], aether.dirs[i][1], aether.dirs[i][2]);
      u.uAethCol.value[i].set(aether.cols[i][0], aether.cols[i][1], aether.cols[i][2]);
    }
  });

  return (
    <>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      <mesh ref={field.meshRef} geometry={field.geometry} material={field.material} frustumCulled={false} visible={false} />
      <MercuryExosphere exo={exo} tier={tier} />
    </>
  );
}

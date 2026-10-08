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
import { tickAetherClock, skyWeights } from './planet/aetherClock';
import { MAPS } from './planet/mercuryMaps.generated';
import { bindPlanetMaps } from './planet/planetMaps';
import { subsolarTempK, HG_BOIL_K } from './planet/mercuryThermal';
import {
  createScarMap, stampCrater, stampFrost, stampQuench, stampGlaze, stampPit, matureScars, healScars, healMelted, crossMarks, SCAR_TICK_S,
} from './planet/scarMap';
import {
  IMPULSE_SLOTS, createImpulses, addImpulse, createImpulseFrame, impulseFrame, spinBulge, createWake, wakeImpulse, slipDirWorld,
  shapeHeight, LIQUID_TAU,
} from './planet/mercuryWaves';
import {
  IMPACT_MODE_AMP, IMPACT_WAVE_AMP, VISITOR_IMPACT, worldToBody, bodyToWorld, calmGlow,
} from './planet/mercuryImpacts';
import { pickSphereDir } from './planet/pickSphere';
import { popZoom, subsolarPxArc } from './planet/mercuryRoil';
import { createBody, stepBody, coolBody, targetFromYaw, MAX_OMEGA } from './planet/mercuryBody';
import { ORBIT_NODES, orbitPrecessionAngle, nodeWorldPosition } from './orbitNodes';
import useMercuryDrag from './useMercuryDrag';
import useStageCameraDist from './useStageCameraDist';
import { registerTuningRig, DEV_OVERRIDES } from './mercuryTuning';
import MercuryExosphere from './MercuryExosphere';
import { tailBrightness, tailLength, boilCoverage } from './planet/mercuryExosphere';
import {
  createFamily, canHold, canFire, fireBlockedBy, breakExcess, tongueAxis, holdTongue, fireFamily, nextSnapIn, qRotateInv, DROP_V_REF,
} from './planet/breakupFamily';
import { TONGUE_MAX_R, sigmaRatio } from './planet/breakupPhysics';
import { stepFamily, DROP_DT } from './planet/breakupStep';
import { muRef, returnTarget, createMuSolver, stepMuSolver, solverBudget, finishMuSolver } from './planet/breakupBudget';
import { canHyper, hyperGate, hyperEnergy, fireHyper, coreScale, hyperReach, HYPER_N, V_HYPER, V_HYPER_SPAN } from './planet/hyperFling';
import { createDropFrame, packFamily, pxPerUnitAt, pxAngleOf } from './planet/breakupFrame';
import useDropletField from './useDropletField';
import {
  createVisitors, createVisitorCtx, createVisitorOut, launchVisitor, stepVisitors, DETACH_OMEGA, EXO_PUFF, EXO_PUFF_S, VISIT_SURF_MAX,
  PIT_DEPTH_M,
} from './planet/visitorSim';
import { createVisitorFrame, packVisitors } from './planet/visitorFrame';
import useVisitorField from './useVisitorField';
import useHgBeads from './useHgBeads';
import { spawnFling, spawnSplash, stepBeads, FLING_N, SPLASH_N } from './planet/hgBeads';
import { CALORIS_DIR_BODY, stepOverlay } from './planet/slowNoon';
import { nebulaRotation } from './planet/nebulaSky';
import { canBakeNebula, bakeNebula } from './nebulaBake';
import { studioMeanCached } from './planet/aetherSky';

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

// Phase 5: release → a family (laid out at its release length), a provisional pull, and the budget solver (it lands before the first neck snaps).
function fireDrop(drop, omega, heatK) {
  const fam = drop.fam;
  fam.e = breakExcess(omega, drop.env.omegaTh);
  // the tongue is sized from the release ω too (author 2026-10-02): a swipe's short hold still throws the full chain
  fireFamily(fam, { maxBodies: drop.frame.caps.bodies, satellites: drop.frame.caps.satellites, gain: PLANET_TUNE.breakGain });
  fam.mu = muRef(drop.env.omegaTh);
  drop.solver = createMuSolver(fam, drop.env, returnTarget(heatK, PLANET_TUNE.dropDrift));
  drop.warned = false;
}

// Phase 6 (V4): release with the spin pinned and a fast pointer → a spray of small beads aimed into a disc. The gather
// headwind η is solved by the sliced solver before the hang ends.
function fireHyperDrop(drop, eH, heatK, camera, bufferW, bufferH, t) {
  const fam = drop.fam, env = drop.env;
  const rVis = camera.position.length() * Math.tan((camera.fov * Math.PI) / 360) * Math.min(1, bufferW / Math.max(bufferH, 1));
  drop.fires = (drop.fires + 1) | 0;
  const seed = (Math.imul(drop.fires, 2654435761) ^ Math.floor(t * 1000)) >>> 0 || 1;
  const target = returnTarget(heatK, PLANET_TUNE.dropDrift);
  fireHyper(fam, {
    N: drop.hyperN, eH, seed, omega: env.omega, pxPerUnit: env.pxPerUnit,
    orbitS: PLANET_TUNE.hyperOrbit, reach: hyperReach(rVis), target,
  });
  drop.solver = createMuSolver(fam, env, target);
  drop.warned = false;
}

// Dev rig: spin the body at w rad/s about its current axis (world Y from rest) as a fresh release. The beads launch
// at ω × p (breakupStep / fireHyper), so without this they would leave a still planet the solver saw spinning.
function rigSpin(env, body, w) {
  const l = Math.hypot(env.omega[0], env.omega[1], env.omega[2]);
  if (l > 1e-6) { env.omega[0] *= w / l; env.omega[1] *= w / l; env.omega[2] *= w / l; } else { env.omega[0] = 0; env.omega[1] = w; env.omega[2] = 0; }
  body.omega.set(env.omega[0], env.omega[1], env.omega[2]);
  body.sinceReleaseS = 0; // a fresh release: inertia first, recapture ramps in (mercuryBody)
}

// Dev rig (holdAt / breakNow have no drag point): stand in for a real swipe at its release. A swipe carries the
// grabbed point with the surface, so by release it sits at the disc's leading limb (spin × toward-camera); the
// rig aims there so its captures launch like real use. Writes drop.spinBody (the rig spins about world +Y from rest).
function rigTongueAxis(drop, env, camW) {
  const w = env.omega;
  if (Math.hypot(w[0], w[1], w[2]) > 1e-6) qRotateInv(env.q, w, drop.spinBody);
  else { drop.rigW[0] = 0; drop.rigW[1] = 1; drop.rigW[2] = 0; qRotateInv(env.q, drop.rigW, drop.spinBody); }
  qRotateInv(env.q, camW, drop.camBody);
  const s = drop.spinBody, c = drop.camBody, d = drop.rigDrag;
  d[0] = s[1] * c[2] - s[2] * c[1]; d[1] = s[2] * c[0] - s[0] * c[2]; d[2] = s[0] * c[1] - s[1] * c[0];
  tongueAxis(s, d, drop.fam.axisBody);
}

// Phase 5, once per frame (spec 2026-10-02): hold the tongues, fire on release, step the family, pack the
// field. Its own function so the frame loop's hot path stays small and a heap profile names it. Allocates
// nothing on the idle and hold paths; fire time and snap / merge events may.
// Gate 0 (natural-swipe validation): one release, after the fire decision. The HUD (?perf=1) reads PERF_INFO on a
// phone; in dev every release also logs and lands in window.__mercuryGate0 for percentiles. blockedBy names the first
// hyper condition missed, or, when the gate passed, why the release did not break the planet (fireBlockedBy).
function reportRelease(lr, drop) {
  const fam = drop.fam;
  lr.fired = lr.hyper ? 'hyper' : fam.phase === 'fired' && lr.phase0 !== 'fired' ? 'phase5' : '';
  // the hyper gate passed but nothing fired: say why the release did not break the planet at all
  if (lr.ok && !lr.hyper) lr.blockedBy = lr.phase0 === 'fired' ? 'family out' : fireBlockedBy(drop.st) || 'busy';
  lr.n += 1;
  PERF_INFO.relN = lr.n; PERF_INFO.relSpin = lr.omega; PERF_INFO.relPtr = lr.ptrOmega;
  PERF_INFO.relHyper = lr.hyper; PERF_INFO.relBlocked = lr.blockedBy; PERF_INFO.relFired = lr.fired;
  if (import.meta.env.DEV) {
    const row = { releaseSpin: +lr.omega.toFixed(3), pointerSpeed: +lr.ptrOmega.toFixed(2), hyperTriggered: lr.hyper, fired: lr.fired || null, blockedBy: lr.blockedBy || null, eH: +lr.eH.toFixed(3) };
    (window.__mercuryGate0 ??= []).push(row);
    console.info('[mercury] release', row);
  }
}

function stepDrop(drop, { body, surf, camera, ds, calm, stepS, t, bufferW, bufferH }) {
  const fam = drop.fam;
  if (calm) {
    if (fam.phase !== 'idle') { Object.assign(fam, createFamily(fam.seed)); drop.solver = null; }
    drop.frame.visible = false;
    DEV_OVERRIDES.breakNow = null; DEV_OVERRIDES.hyperNow = null; // the rig is a no-op under reduced motion
    PERF_INFO.dropPrims = 0; PERF_INFO.dropAreaPx = 0; PERF_INFO.sigma = 0;
  } else {
    const env = drop.env;
    env.q[0] = body.q.x; env.q[1] = body.q.y; env.q[2] = body.q.z; env.q[3] = body.q.w;
    env.omega[0] = body.omega.x; env.omega[1] = body.omega.y; env.omega[2] = body.omega.z;
    env.gamma = PLANET_TUNE.dropDrag;
    env.kappa = PLANET_TUNE.dropCohesion;
    env.omegaTh = PLANET_TUNE.breakOmega;
    env.pxPerUnit = pxPerUnitAt(camera.position.length(), camera.fov, bufferH);
    if (ds.released) {
      const lr = drop.lastRelease;
      lr.omega = body.omega.length(); lr.ptrOmega = ds.releaseOmegaPtr; lr.eH = 0; lr.hyper = false; lr.phase0 = fam.phase;
      // Gate 0: every release says which hyper condition it met or missed (written in place; reported below)
      hyperGate({ omega: lr.omega, ptrOmega: lr.ptrOmega, nMax: drop.hyperN, target: returnTarget(body.heatK, PLANET_TUNE.dropDrift) }, lr);
    }
    const dropDt = stepS * (DEV_OVERRIDES.dropTimeScale ?? 1);
    let omega = body.omega.length();
    let holding = ds.dragging;
    if (DEV_OVERRIDES.holdOmega != null && fam.phase !== 'fired') { holding = true; omega = DEV_OVERRIDES.holdOmega; }
    if (DEV_OVERRIDES.breakNow != null) {
      const w = DEV_OVERRIDES.breakNow;
      DEV_OVERRIDES.breakNow = null;
      if (fam.phase !== 'fired' && body.tau >= 1) {
        // Dev rig: fire as if released at w rad/s about the current spin axis (world Y at rest), really spinning the body.
        rigSpin(env, body, w);
        omega = w;
        if (fam.phase === 'idle') {
          rigTongueAxis(drop, env, surf.cam);
          fam.L = breakExcess(w, env.omegaTh) * PLANET_TUNE.breakGain * TONGUE_MAX_R;
        }
        fam.phase = 'hold';
        fireDrop(drop, w, body.heatK);
      }
    }
    if (DEV_OVERRIDES.hyperNow != null) { // dev rig: bypasses canHyper (and its return-time gate) on purpose
      const eH = DEV_OVERRIDES.hyperNow;
      DEV_OVERRIDES.hyperNow = null;
      if (fam.phase !== 'fired' && body.tau >= 1 && drop.hyperN > 0) {
        rigSpin(env, body, MAX_OMEGA);
        omega = MAX_OMEGA;
        const lr = drop.lastRelease;
        lr.omega = MAX_OMEGA; lr.ptrOmega = V_HYPER + eH * V_HYPER_SPAN; lr.eH = eH; lr.hyper = true;
        fireHyperDrop(drop, eH, body.heatK, camera, bufferW, bufferH, t);
      }
    }
    if (fam.phase === 'idle' || fam.phase === 'hold') {
      const st = drop.st; // written in place: the idle and hold paths allocate nothing
      st.tau = body.tau; st.omega = omega; st.omegaTh = env.omegaTh; st.calm = calm; st.phase = fam.phase;
      st.released = ds.released; st.heatK = body.heatK; st.dragging = holding;
      if (canFire(st)) {
        const lr = drop.lastRelease;
        lr.eH = hyperEnergy(lr.ptrOmega);
        const target = returnTarget(body.heatK, PLANET_TUNE.dropDrift); // a scalar, and only on the fire frame
        lr.hyper = canHyper({ omega, ptrOmega: lr.ptrOmega, nMax: drop.hyperN, target });
        if (lr.hyper) fireHyperDrop(drop, lr.eH, body.heatK, camera, bufferW, bufferH, t);
        else fireDrop(drop, omega, body.heatK);
      } else if (canHold(st)) {
        if (fam.phase === 'idle') {
          fam.phase = 'hold';
          if (!surf.hasDragDir && DEV_OVERRIDES.holdOmega != null) rigTongueAxis(drop, env, surf.cam);
          else {
            qRotateInv(env.q, env.omega, drop.spinBody);
            tongueAxis(drop.spinBody, surf.hasDragDir ? surf.dragDirBody : null, fam.axisBody);
          }
        }
        holdTongue(fam, dropDt, breakExcess(omega, env.omegaTh), PLANET_TUNE.breakGain);
      } else if (fam.phase === 'hold') {
        holdTongue(fam, dropDt, 0, PLANET_TUNE.breakGain);
        if (fam.L < 1e-4) { fam.L = 0; fam.phase = 'idle'; }
      }
    }
    if (ds.released) reportRelease(drop.lastRelease, drop);
    if (fam.phase === 'fired') {
      const sv = drop.solver;
      if (sv && !sv.done) {
        // phase 5: due at the first neck snap; phase 6: due when the hang ends (η is unused before it, V4 §10.3)
        const due = fam.hyper ? fam.tHang - fam.t : nextSnapIn(fam);
        stepMuSolver(sv, solverBudget(sv, Math.max(1, Math.floor(due / dropDt))));
        // never let a drop fly on a provisional pull: this frame can advance the family by up to dropDt plus one
        // leftover DROP_DT substep (stepFamily's accumulator), so finish whenever the deadline is inside that
        if (!sv.done && due < dropDt + DROP_DT) finishMuSolver(sv);
        if (sv.done) {
          if (fam.hyper) fam.eta = sv.best; else fam.mu = sv.best;
          if (import.meta.env.DEV && !sv.landed && !drop.warned) {
            drop.warned = true;
            console.warn(fam.hyper
              ? `[mercury] hyper-fling: no headwind up to eta ${sv.best.toPrecision(3)} lands the swarm by the ${sv.target.toFixed(1)} s target (hyperOrbit ${PLANET_TUNE.hyperOrbit}); it may come home late`
              : `[mercury] breakup: no pull up to mu ${sv.best.toPrecision(3)} lands the drops by the ${sv.target.toFixed(1)} s target (dropDrag ${PLANET_TUNE.dropDrag}); they may come home late`);
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
  drop.coreScale = coreScale(fam); // phase 6: the planet's live size (1 unless a hyper family is out)
}

export default function MercuryPlanet({ isMobile = false, tier = 'full', calm = false, emitters = {}, strikes = null, overlay = false, activePhase = null, aetherClock = null, fades = null, onFps = null }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  // The drawing buffer's height in device px: the pops are sized from it (mercuryRoil.popZoom).
  const bufferH = useThree((s) => s.size.height * s.viewport.dpr);
  const bufferW = useThree((s) => s.size.width * s.viewport.dpr);
  const camDist = useStageCameraDist(isMobile);
  const drag = useMercuryDrag(gl.domElement);
  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  const init = useMemo(() => planetEphemerisUniforms(Date.now()), []);
  const target = useMemo(() => targetFromYaw(init.yaw), [init]);
  const body = useMemo(() => createBody(target), [target]);
  // The exosphere's state (MercuryExosphere reads it every frame; written here, allocation-free).
  const exo = useMemo(() => ({ B: init.tailB, L: tailLength(init.tailB), coverage: 0, time: 0, boxDirty: true, coreR: R_SCENE }), [init]);
  const m4 = useMemo(() => new THREE.Matrix4(), []);

  // The crust's memory (scarMap.js): a CPU buffer uploaded as RGBA8. Neutral = no scars.
  const scar = useMemo(() => createScarMap(), []);
  const scarTex = useMemo(() => {
    // A is glaze data (0 on unmarked texels), not opacity: this texture must never be premultiplied.
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
  useEffect(() => { if (import.meta.env.DEV) window.__mercuryScar = scar; }, [scar]); // probes read the marks

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
      uCoreR: { value: R_SCENE },
      uHeatK: { value: 0 },
      uSubsolarT: { value: init.subsolarT },
      uEmitPos: { value: ORBIT_NODES.map(() => new THREE.Vector3()) },
      uEmitCol: { value: ORBIT_NODES.map(() => new THREE.Vector3()) },
      uSunGlint: { value: PLANET_TUNE.sunGlint },
      uEmitGain: { value: PLANET_TUNE.emitGain },
      uSkyT: { value: 0 },
      uSkyPhase: { value: new THREE.Vector4() },
      uSkyW: { value: new THREE.Vector4(1, 0, 0, 0) },
      uAetherGain: { value: PLANET_TUNE.aetherGain },
      uAetherSilver: { value: PLANET_TUNE.aetherSilver },
      uNeutralSky: { value: PLANET_TUNE.neutralSky },
      uStudioDome: { value: PLANET_TUNE.studioDome },
      uStudioLook: { value: new THREE.Vector4(PLANET_TUNE.studioCrisp, PLANET_TUNE.studioKey, PLANET_TUNE.studioSoftbox, PLANET_TUNE.studioFloor) },
      uStudioMean: { value: 0 },
      uNeutralNebula: { value: 0 },
      uNebulaRot: { value: new THREE.Matrix3() },
      uNebulaMap: { value: null },
      uScar: { value: scarTex },
      uRayGain: { value: PLANET_TUNE.rayGain },
      uRoilGain: { value: PLANET_TUNE.roilGain },
      uRoughLiquid: { value: PLANET_TUNE.roughLiquid },
      uMeniscus: { value: PLANET_TUNE.meniscus },
      uMeniscusW: { value: PLANET_TUNE.meniscusW },
      uOverlay: { value: 0 },
      uCaloris: { value: new THREE.Vector3(...CALORIS_DIR_BODY) },
      uPopZoom: { value: 1 },
      uSurfOn: { value: 0 },
      uImpDir: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3(0, 0, 1)) },
      uImpMode: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3()) },
      uImpWave: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3()) },
      uBulge: { value: new THREE.Vector4(0, 1, 0, 0) },
      uGlow: { value: new THREE.Vector4(0, 0, 1, 0) },
      uVisitOn: { value: 0 },
      uVisitDir: { value: Array.from({ length: VISIT_SURF_MAX }, () => new THREE.Vector4(0, 0, 1, 0)) },
      uVisitA: { value: Array.from({ length: VISIT_SURF_MAX }, () => new THREE.Vector4()) },
      uVisitB: { value: Array.from({ length: VISIT_SURF_MAX }, () => new THREE.Vector4()) },
      uMarksOn: { value: 0 },
    },
  }), [isMobile, init, body, scarTex, shader]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  // Neutral nebula (spec 2026-10-08): baked LAZILY on the first frame the switch is up (default 0 pays nothing), once per
  // renderer: keyed on gl only, so a calm/tier material rebuild re-links the cached map (useFrame) instead of re-baking.
  // Droplets / beads / visitors share the uniform objects by reference, so they see the same map. Without a half-float
  // target the switch stays on the studio.
  const nebula = useRef({ map: null, failed: false });
  useEffect(() => () => { nebula.current.map?.dispose(); nebula.current = { map: null, failed: false }; }, [gl]);

  // Dev-only console tuning rig (window.__mercuryTune). Zero prod footprint.
  useEffect(() => {
    if (import.meta.env.DEV) { registerTuningRig(); window.__mercuryPerf = PERF_INFO; }
  }, []);

  const emitRef = useRef(emitters);
  const skyW = useMemo(() => [1, 0, 0, 0], []);
  const nebRot = useMemo(() => new Array(9), []);
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
    marksLiquid: null,   // the liquid/crust side last frame: marks clear when it changes (matrix spec §9.6)
    glowT0: -Infinity,
    glowDirBody: [0, 0, 1],
    dragDirBody: [0, 0, 1],
    dragDirWorld: [0, 0, 1],
    hasDragDir: false,
    w: [0, 0, 0],
    b: [0, 0, 0],
    cam: [0, 0, 0],
    wakeArgs: { tS: 0, dragging: false, released: false, ptrOmega: 0, bodyOmega: 0, tau: 0 },
    frameOpts: { modeScale: 1, waveScale: 1 },
    dirsW: Array.from({ length: IMPULSE_SLOTS }, () => [0, 0, 1]),
  }), []);

  // Phase 5 state: the droplet family, its solver, the packed frame, the sim's view of the world.
  const drop = useMemo(() => {
    const d = {
      fam: createFamily(1), solver: null, warned: false,
      lastRelease: { omega: 0, ptrOmega: 0, eH: 0, hyper: false, ok: false, blockedBy: '', n: 0, phase0: 'idle', fired: '' }, // phase 6: every release, for Gate 0 and the HUD
      coreScale: 1, fires: 0, hyperN: Math.min(HYPER_N[tier] ?? 0, TIERS[tier].drop.bodies), // phase 6
      frame: createDropFrame(TIERS[tier].drop), spinBody: [0, 0, 0],
      camBody: [0, 0, 0], rigW: [0, 0, 0], rigDrag: [0, 0, 0], // the dev rig's stand-in drag point (rigTongueAxis)
      env: { q: [0, 0, 0, 1], omega: [0, 0, 0], gamma: 0, kappa: 0, vRef: DROP_V_REF, pxPerUnit: 1, omegaTh: 7.5, planetRadiusAt: null },
      view: { vp: new Float32Array(16), p00: 1, p11: 1, wPx: 1, hPx: 1 }, m: new THREE.Matrix4(),
      // canHold / canFire read their fields from this one object, written in place (no per-frame spread).
      st: { tau: 0, omega: 0, omegaTh: 0, calm: false, phase: 'idle', released: false, heatK: 0, dragging: false },
      // stepDrop's per-frame arguments, written in place.
      args: { body: null, surf: null, camera: null, ds: null, calm: false, stepS: 0, t: 0, bufferW: 1, bufferH: 1 },
    };
    // The planet's live surface (body modes + bulge) where a drop lands: the shader's shapeH, mirrored.
    d.env.planetRadiusAt = (dir) => R_SCENE * d.coreScale * (1 + shapeHeight(dir, surf.dirsW, surf.frame.mode, surf.bulge));
    return d;
  }, [tier, surf]);
  const field = useDropletField({ tier, isMobile, planetMaterial: material, caps: TIERS[tier].drop });
  useEffect(() => { if (import.meta.env.DEV) window.__mercuryDrop = drop; }, [drop]);

  // Visitors (spec 2026-10-03): the tapped element falls onto the planet and stays a while. Preallocated; idle is free.
  const vis = useMemo(() => ({
    buf: createVisitors(), ctx: createVisitorCtx(), out: createVisitorOut(), frame: createVisitorFrame(),
    view: { vp: new Float32Array(16), p00: 1, p11: 1, wPx: 1, hPx: 1 }, m: new THREE.Matrix4(),
    clock: 0, exoPuff: 0, rigDetach: false, shaderT: 0, // rigDetach: the dev rig spun the body last frame; shaderT: frozen under calm
  }), []);
  const visField = useVisitorField({ planetMaterial: material });
  useEffect(() => { if (import.meta.env.DEV) window.__mercuryVisitors = vis; }, [vis]);

  // Hg beads: the trickle, flings and splash bursts, carried by the active element. beadCtx is written in place per frame.
  const beads = useHgBeads({ tier, planetMaterial: material });
  const beadCtx = useMemo(() => ({ phase: 'fluid', coreR: R_SCENE, calm: false, liquid: true, boil: 0, rateScale: 1, lastFam: 'idle', dirW: [0, 0, 0], omega: [0, 0, 0] }), []);

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

  // Pop size from the screen: on mount, on resize / DPR change, on a camera re-fit, and for each new material;
  // never per frame.
  // The pop lattice re-forms only here, so a pop never jumps mid-life except on a resize.
  useLayoutEffect(() => {
    material.uniforms.uPopZoom.value = popZoom(subsolarPxArc(isMobile ? 'mobile' : 'desktop', bufferH, camDist));
  }, [material, bufferH, isMobile, camDist]);

  // A new material starts from the mount-time ephemeris; refresh it on the very next frame.
  const nextEphemeris = useRef(0);
  useLayoutEffect(() => { nextEphemeris.current = 0; }, [material]);
  // Neutral has no gas flow to count frames, so the planet does.
  const fpsFrames = useRef(0);
  const fpsTime = useRef(0);
  useFrame(({ clock }, delta) => {
    if (onFps) {
      fpsFrames.current++;
      fpsTime.current += delta;
      if (fpsTime.current >= 1) {
        onFps(Math.round(fpsFrames.current / fpsTime.current));
        fpsFrames.current = 0;
        fpsTime.current = 0;
      }
    }
    const u = material.uniforms;
    const t = clock.elapsedTime;
    u.uTime.value = t;
    u.uExposure.value = PLANET_TUNE.exposure;
    u.uRelief.value = PLANET_TUNE.relief;
    u.uNightFloor.value = PLANET_TUNE.nightFloor;
    u.uSunGlint.value = PLANET_TUNE.sunGlint;
    u.uEmitGain.value = PLANET_TUNE.emitGain;
    u.uAetherGain.value = PLANET_TUNE.aetherGain;
    u.uAetherSilver.value = PLANET_TUNE.aetherSilver;
    u.uNeutralSky.value = PLANET_TUNE.neutralSky;
    u.uStudioDome.value = PLANET_TUNE.studioDome;
    u.uStudioLook.value.set(PLANET_TUNE.studioCrisp, PLANET_TUNE.studioKey, PLANET_TUNE.studioSoftbox, PLANET_TUNE.studioFloor);
    u.uStudioMean.value = studioMeanCached(PLANET_TUNE.studioCrisp, PLANET_TUNE.studioKey, PLANET_TUNE.studioSoftbox, PLANET_TUNE.studioFloor, PLANET_TUNE.studioDome);
    const want = Math.min(Math.max(PLANET_TUNE.neutralNebula, 0), 1);
    const neb = nebula.current;
    if (want > 0 && !neb.map && !neb.failed) {
      if (canBakeNebula(gl)) neb.map = bakeNebula(gl); // first frame the switch is up: one bake per renderer
      else { neb.failed = true; console.warn('[mercury] no half-float render target: neutral nebula off, studio only'); }
    }
    u.uNebulaMap.value = neb.map ? neb.map.texture : null; // re-links after a material rebuild
    u.uNeutralNebula.value = neb.map ? want : 0;
    u.uRayGain.value = PLANET_TUNE.rayGain;
    u.uRoilGain.value = PLANET_TUNE.roilGain;
    u.uRoughLiquid.value = PLANET_TUNE.roughLiquid;
    u.uMeniscus.value = PLANET_TUNE.meniscus;
    u.uMeniscusW.value = PLANET_TUNE.meniscusW;
    u.uOverlay.value = stepOverlay(u.uOverlay.value, overlay ? 1 : 0, delta, calm);
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
    exo.coverage = Math.min(1, boilCoverage(body.tau, body.heatK, u.uSubsolarT.value) + vis.exoPuff);
    vis.exoPuff *= Math.exp(-stepS / EXO_PUFF_S);
    if (!calm) exo.time += stepS; // the streamers hold still under reduced motion
    PERF_INFO.coverage = exo.coverage;

    // --- Phase 3: strikes, wake, scars, the bead ---
    const precession = orbitPrecessionAngle(t);
    surf.cam[0] = camera.position.x; surf.cam[1] = camera.position.y; surf.cam[2] = camera.position.z;

    const queue = strikes?.current;
    let scarDirty = false;
    // Visitors: a strike launches the element; its touchdown (on a later frame) is what reaches the surface.
    const vc = vis.ctx;
    const visScale = DEV_OVERRIDES.visitTimeScale ?? 1;
    vis.clock += stepS * visScale;
    vc.tS = vis.clock; vc.dt = stepS * visScale; vc.calm = calm;
    vc.tau = body.tau; vc.heatK = body.heatK; vc.subsolarT = u.uSubsolarT.value; vc.tempOverrideK = DEV_OVERRIDES.visitTempK;
    vc.q[0] = body.q.x; vc.q[1] = body.q.y; vc.q[2] = body.q.z; vc.q[3] = body.q.w;
    vc.omega[0] = body.omega.x; vc.omega[1] = body.omega.y; vc.omega[2] = body.omega.z;
    vc.cam[0] = surf.cam[0]; vc.cam[1] = surf.cam[1]; vc.cam[2] = surf.cam[2];
    vc.coreR = R_SCENE * drop.coreScale;
    // a hard release flings the residents off (every hyper pins the spin at MAX_OMEGA, past DETACH_OMEGA)
    // The dev rig spins the body inside stepDrop (below), so its fling lands next frame, on the spun ω.
    const rigFling = DEV_OVERRIDES.breakNow != null || DEV_OVERRIDES.hyperNow != null;
    vc.detach = (ds.released && body.omega.length() > DETACH_OMEGA) || vis.rigDetach;
    vis.rigDetach = false;
    const devQ = DEV_OVERRIDES.strikeQueue;
    while ((queue && queue.length > 0) || devQ.length > 0) {
      const phase = queue && queue.length > 0 ? queue.shift() : devQ.shift();
      const node = ORBIT_NODES.find((n) => n.phase === phase);
      if (!node) continue;
      const p = nodeWorldPosition(node.angle, precession);
      vc.nodePos[0] = p[0]; vc.nodePos[1] = p[1]; vc.nodePos[2] = p[2];
      launchVisitor(vis.buf, phase, vc);
    }
    stepVisitors(vis.buf, vc, vis.out);
    for (let k = 0; k < vis.out.nImpacts; k++) {
      const ev = vis.out.impacts[k];
      if (ev.kind === 'crater') {
        stampCrater(scar, ev.dirBody, surf.seed++);
        scarDirty = true;
      } else if (calm) {
        surf.glowT0 = t; // reduced motion: the touchdown brightens the point instead of ringing
        surf.glowDirBody[0] = ev.dirBody[0]; surf.glowDirBody[1] = ev.dirBody[1]; surf.glowDirBody[2] = ev.dirBody[2];
      } else if (ev.impulse === 'ring') {
        // frozen Hg rings, frost and melt pools included (plan P-5)
        addImpulse(surf.impulses, { dirBody: ev.dirBody, tS: t, mode: IMPACT_MODE_AMP.ring, wave: IMPACT_WAVE_AMP.ring, kind: 'ring' });
      } else if (ev.impulse) {
        const a = VISITOR_IMPACT[ev.impulse];
        addImpulse(surf.impulses, { dirBody: ev.dirBody, tS: t, mode: a.mode, wave: a.wave, kind: ev.impulse });
        bodyToWorld(ev.dirBody, body.q, beadCtx.dirW);
        // calm spawns no bursts (author 2026-10-05, Option A): a touchdown only brightens the point
        spawnSplash(beads.sim, beadCtx.dirW, R_SCENE * drop.coreScale, SPLASH_N);
        if (ev.phase === 'thermal' && ev.tempK > HG_BOIL_K) vis.exoPuff = EXO_PUFF;
        if (ev.kind === 'strip') vis.exoPuff = EXO_PUFF; // a gust strips vapour off boiling Hg into the exosphere
      }
    }
    // Persistent marks (frost, glaze, pit): stamped even under reduced motion; a mark is not motion.
    // Q-6: a stamp belongs to one side of the state crossing; one that outlived its side is dropped, never stamped on the wrong state.
    const liquidNow = body.tau >= LIQUID_TAU;
    for (let k = 0; k < vis.out.nStamps; k++) {
      const st = vis.out.stamps[k];
      if (st.crust === liquidNow) continue;
      if (st.kind === 'frost') stampFrost(scar, st.dirBody, st.radius, st.seed);
      else if (st.kind === 'quench') stampQuench(scar, st.dirBody, st.radius, st.seed);
      else if (st.kind === 'glaze') stampGlaze(scar, st.dirBody, st.radius);
      else stampPit(scar, st.dirBody, st.radius, PIT_DEPTH_M);
      scarDirty = true;
    }

    if ((ds.dragging || ds.released) && ds.aimed && pickSphereDir(ds.ndc, camera, R_SCENE * drop.coreScale, surf.w)) {
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
    // Marks last until the planet changes state (spec R3, §9.6): crust -> liquid melts the rinds and glaze,
    // liquid -> crust buries the frozen-Hg frost and glaze.
    if (crossMarks(scar, surf.marksLiquid, liquidNow)) scarDirty = true;
    surf.marksLiquid = liquidNow;
    surf.scarClock += Math.min(delta, MAX_FRAME_DT_S);
    if (surf.scarClock >= SCAR_TICK_S) {
      if (matureScars(scar, surf.scarClock)) scarDirty = true;
      // frozen-Hg frost and glaze go where the Hg under them has melted (the shader already hides them there; this frees the bytes)
      // only while liquid: on crust every mark sits on ≥ ~390 K rock and would be erased on the next tick (spec §9.6)
      if (liquidNow && healMelted(scar, vc.q, SUN_DIR_WORLD, vc.subsolarT, body.heatK)) scarDirty = true;
      surf.scarClock = 0;
    }
    if (scarDirty) scarTex.needsUpdate = true;
    u.uMarksOn.value = scar.marksLive ? 1 : 0;

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
    // A fresh fling (any path: release, hyper, dev rig) throws Hg beads off the spin equator.
    if (drop.fam.phase === 'fired' && beadCtx.lastFam !== 'fired') { // stepDrop resets the family under calm, so a fling can't fire there
      beadCtx.omega[0] = body.omega.x; beadCtx.omega[1] = body.omega.y; beadCtx.omega[2] = body.omega.z;
      spawnFling(beads.sim, beadCtx.omega, R_SCENE * drop.coreScale, FLING_N);
    }
    beadCtx.lastFam = drop.fam.phase;
    // the rig really spun the body: fling next frame on that ω (a refused rig, or one under calm, flings nothing)
    if (rigFling && !calm && body.omega.length() > DETACH_OMEGA) vis.rigDetach = true;
    u.uCoreR.value = R_SCENE * drop.coreScale;
    exo.coreR = R_SCENE * drop.coreScale;
    field.upload(drop.frame, t);
    // Visitors' bodies and surface slots (after stepDrop: the core size is this frame's).
    if (vis.buf.live > 0) {
      vis.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      vis.view.vp.set(vis.m.elements);
      vis.view.p00 = camera.projectionMatrix.elements[0];
      vis.view.p11 = camera.projectionMatrix.elements[5];
      vis.view.wPx = bufferW;
      vis.view.hPx = bufferH;
    }
    packVisitors(vis.buf, vc, vis.view, vis.frame);
    if (!calm) vis.shaderT = t; // reduced motion holds the steam churn and gust shimmer still
    visField.upload(vis.frame, vis.shaderT, pxAngleOf(camera.fov, bufferH));
    for (let j = 0; j < VISIT_SURF_MAX; j++) {
      u.uVisitDir.value[j].fromArray(vis.frame.surfDir, 4 * j);
      u.uVisitA.value[j].fromArray(vis.frame.surfA, 4 * j);
      u.uVisitB.value[j].fromArray(vis.frame.surfB, 4 * j);
    }
    u.uVisitOn.value = vis.frame.nSurf > 0 ? 1 : 0;
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

    // The mirror sky (aetherSky.js) on the gas's own clock, weighted by the element fades; quiet in neutral.
    if (aetherClock) {
      tickAetherClock(aetherClock, t, delta);
      u.uSkyT.value = aetherClock.t;
      const m = nebulaRotation(aetherClock.t, nebRot);
      u.uNebulaRot.value.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
      u.uSkyPhase.value.set(aetherClock.phase.fluid, aetherClock.phase.thermal, aetherClock.phase.earth, aetherClock.phase.air);
    }
    skyWeights(fades, skyW);
    u.uSkyW.value.set(skyW[0], skyW[1], skyW[2], skyW[3]);

    beadCtx.phase = activePhase;
    beadCtx.coreR = R_SCENE * drop.coreScale;
    beadCtx.calm = calm;
    beadCtx.liquid = body.tau >= LIQUID_TAU;
    beadCtx.boil = exo.coverage;
    beadCtx.rateScale = TIERS[tier].beadRate;
    stepBeads(beads.sim, stepS, beadCtx);
    beads.upload(gl, beadCtx.coreR);
  });

  return (
    <>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      <mesh ref={field.meshRef} geometry={field.geometry} material={field.material} renderOrder={field.renderOrder} frustumCulled={false} visible={false} />
      <mesh ref={visField.meshRef} geometry={visField.geometry} material={visField.material} renderOrder={visField.renderOrder} frustumCulled={false} visible={false} />
      <MercuryExosphere exo={exo} tier={tier} />
      <points geometry={beads.geometry} material={beads.material} renderOrder={beads.renderOrder} frustumCulled={false} />
    </>
  );
}

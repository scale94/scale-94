import { Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import useStageCameraDist from './useStageCameraDist';
import * as THREE from 'three';

import { TUNE } from './mercuryTuning';
import ParticleFlow    from '../fluid/ParticleFlow';
import ThermalFlow     from '../thermal/ThermalFlow';
import SedimentFlow    from '../earth/SedimentFlow';
import AtmosphericFlow from '../air/AtmosphericFlow';
import MercurySphere   from './MercurySphere';
import MercuryPlanet   from './MercuryPlanet';
import MercuryPerfHud from './MercuryPerfHud';
import { TIERS, pickTier, perfHudOn } from './planet/planetQuality';
import { CAMERA_DIST, CAMERA_FOV_DEG } from './planet/planetLook';
import { gasCounts } from './planet/gasStreak';
import usePhaseTransition from './usePhaseTransition';
import useCalm from './useCalm';
import { createAetherClock, configureAetherClock } from './planet/aetherClock';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const GHOST_DENSITY = isMobile ? 150 : 300;
const SEARCH = typeof window !== 'undefined' ? window.location.search : '';
const TIER = pickTier({ isMobile, search: SEARCH });
const PERF_HUD = import.meta.env.DEV && perfHudOn(SEARCH);

// Keeps the four element handles fully in frame at any canvas size (spec: stage layout §2).
// Writes the camera only when the fitted distance changes; FOV is untouched.
function StageCameraFit({ isMobile }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const dist = useStageCameraDist(isMobile);
  useLayoutEffect(() => {
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, dist, invalidate]);
  return null;
}

export default function MercuryCanvas({
  params,
  onPhaseChange = null,
  onFps = null,
  overlay = false,
}) {
  const {
    activePhase,
    pendingPhase,
    phaseOpacities,
    phaseCondense,
    sphereState,
    triggerTransition,
  } = usePhaseTransition('fluid');

  const calm = useCalm();
  // One time base for the gas and the mirror sky (mirror-sky spec §1). Configured every render, ticked per frame.
  const [aetherClock] = useState(createAetherClock);
  configureAetherClock(aetherClock, { speed: params.speed ?? 0.1, orbitalSpeed: params.orbitalSpeed ?? 1.2, calm });
  const dpr = [1, TIERS[TIER].dprMax];

  const handleNodeTap = useCallback((phase) => {
    triggerTransition(phase);
    onPhaseChange?.(phase);
  }, [triggerTransition, onPhaseChange]);

  // Element strikes for the planet (MercuryPlanet drains this every frame and launches a visitor per strike).
  // The press fires once per pointerdown; onNodeTap fires on both pointerdown and click.
  const strikesRef = useRef([]);
  const handleElementFired = useCallback((phase) => {
    if (strikesRef.current.length < 8) strikesRef.current.push(phase);
  }, []);

  // Gas counts (mirror-sky spec §3e): fog = the old (base) count; the tier multiplier feeds the filaments.
  // Fire: body = the old body count, embers = the old ember count × the multiplier. Ghosts: GHOST_DENSITY, ×1.
  const gasBase = params.density ?? (isMobile ? 600 : 1200);
  const gasFor = (phase) => phase === activePhase
    ? gasCounts(gasBase, TIERS[TIER].gasDensity, phase === 'thermal')
    : gasCounts(GHOST_DENSITY, 1, phase === 'thermal');

  // Active phase capped at 0.45 — additive blending accumulates fast, the planet (MercuryPlanet) must remain legible
  const opacityFor = (phase) =>
    Math.min(phase === activePhase ? 0.45 : 0.12, phaseOpacities[phase]);

  // Condensation: bite applied HERE, once — shaders receive the final value.
  const condenseFor = (phase) => phaseCondense[phase] * TUNE.condenseBite;

  return (
    <Canvas
      camera={{ position: [0, 0, isMobile ? CAMERA_DIST.mobile : CAMERA_DIST.desktop], fov: isMobile ? CAMERA_FOV_DEG.mobile : CAMERA_FOV_DEG.desktop }}
      dpr={dpr}
      gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: '#000' }}
      onCreated={(state) => { if (import.meta.env.DEV) window.__mercury = state; }}
    >
      <Suspense fallback={null}>
        <StageCameraFit isMobile={isMobile} />
        {/* NormalBlending: prevents additive accumulation to white in multi-system canvas */}
        {/* No transmission-glass boundary meshes here: drei's transmission-glass material renders the
            whole scene into its own FBO every frame even while hidden (8 extra renders per frame). */}
        <ParticleFlow
          isMobile={isMobile}
          aetherClock={aetherClock}
          speed={params.speed}
          curlAmp={params.curlAmp ?? 0.02}
          tubeRadius={params.tubeRadius ?? 0.32}
          chromatic={params.chromatic ?? 0}
          density={gasFor('fluid').n}
          fogCount={gasFor('fluid').fog}
          opacityMultiplier={opacityFor('fluid')}
          blending={THREE.NormalBlending}
          premultiplied
          onFps={activePhase === 'fluid' ? onFps : null}
          condense={condenseFor('fluid')}
          condenseSizeBite={TUNE.condenseSizeBite}
          planetWindow={1}
        />

        <ThermalFlow
          isMobile={isMobile}
          aetherClock={aetherClock}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.4}
          flameWidth={params.flameWidth ?? 0.85}
          density={gasFor('thermal').n}
          fogCount={gasFor('thermal').fog}
          opacityMultiplier={opacityFor('thermal')}
          blending={THREE.NormalBlending}
          premultiplied
          onFps={activePhase === 'thermal' ? onFps : null}
          condense={condenseFor('thermal')}
          condenseSizeBite={TUNE.condenseSizeBite}
          planetWindow={1}
        />

        <SedimentFlow
          isMobile={isMobile}
          aetherClock={aetherClock}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.25}
          eruptStrength={params.eruptStrength ?? 0.8}
          density={gasFor('earth').n}
          fogCount={gasFor('earth').fog}
          opacityMultiplier={opacityFor('earth')}
          blending={THREE.NormalBlending}
          premultiplied
          onFps={activePhase === 'earth' ? onFps : null}
          condense={condenseFor('earth')}
          condenseSizeBite={TUNE.condenseSizeBite}
          planetWindow={1}
        />

        <AtmosphericFlow
          isMobile={isMobile}
          aetherClock={aetherClock}
          orbitalSpeed={params.orbitalSpeed ?? 1.2}
          turbulence={params.turbulence ?? 0.18}
          spread={params.spread ?? 1.0}
          density={gasFor('air').n}
          fogCount={gasFor('air').fog}
          opacityMultiplier={opacityFor('air')}
          blending={THREE.NormalBlending}
          premultiplied
          onFps={activePhase === 'air' ? onFps : null}
          condense={condenseFor('air')}
          condenseSizeBite={TUNE.condenseSizeBite}
          planetWindow={1}
        />

        <MercuryPlanet
          isMobile={isMobile}
          tier={TIER}
          calm={calm}
          strikes={strikesRef}
          emitters={{
            fluid: opacityFor('fluid'),
            thermal: opacityFor('thermal'),
            earth: opacityFor('earth'),
            air: opacityFor('air'),
          }}
          overlay={overlay}
          activePhase={activePhase}
          aetherClock={aetherClock}
          pendingPhase={pendingPhase}
          skyOpacities={phaseOpacities}
        />
        <MercurySphere
          activePhase={activePhase}
          pendingPhase={pendingPhase}
          sphereState={sphereState}
          onNodeTap={handleNodeTap}
          onElementFired={handleElementFired}
          isMobile={isMobile}
        />
        {PERF_HUD && <MercuryPerfHud tier={TIER} calm={calm} />}

        {/* No bloom in Mercury mode — four simultaneous particle systems would blow out.
            The planet (MercuryPlanet) shader reads fine unpostprocessed. */}
      </Suspense>
    </Canvas>
  );
}

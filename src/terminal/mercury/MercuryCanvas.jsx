import { Suspense, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
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
import usePhaseTransition from './usePhaseTransition';
import useCalm from './useCalm';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const GHOST_DENSITY = isMobile ? 150 : 300;
const SEARCH = typeof window !== 'undefined' ? window.location.search : '';
const TIER = pickTier({ isMobile, search: SEARCH });
const PERF_HUD = import.meta.env.DEV && perfHudOn(SEARCH);

export default function MercuryCanvas({
  params,
  onPhaseChange = null,
  onFps = null,
  onElementFired = null,
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
  const dpr = [1, TIERS[TIER].dprMax];

  const handleNodeTap = useCallback((phase) => {
    triggerTransition(phase);
    onPhaseChange?.(phase);
  }, [triggerTransition, onPhaseChange]);

  // Element strikes for the planet (MercuryPlanet drains this every frame).
  // onElementFired fires once per press; onNodeTap fires on both pointerdown and click.
  const strikesRef = useRef([]);
  const handleElementFired = useCallback((phase, x, y) => {
    if (strikesRef.current.length < 8) strikesRef.current.push(phase);
    onElementFired?.(phase, x, y);
  }, [onElementFired]);

  const densityFor = (phase) =>
    phase === activePhase ? (params.density ?? (isMobile ? 600 : 1200)) : GHOST_DENSITY;

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
        {/* NormalBlending: prevents additive accumulation to white in multi-system canvas */}
        {/* No transmission-glass boundary meshes here: drei's transmission-glass material renders the
            whole scene into its own FBO every frame even while hidden (8 extra renders per frame). */}
        <ParticleFlow
          isMobile={isMobile}
          speed={params.speed}
          curlAmp={params.curlAmp ?? 0.02}
          tubeRadius={params.tubeRadius ?? 0.32}
          chromatic={params.chromatic ?? 0}
          density={densityFor('fluid')}
          opacityMultiplier={opacityFor('fluid')}
          blending={THREE.NormalBlending}
          onFps={activePhase === 'fluid' ? onFps : null}
          condense={condenseFor('fluid')}
          condenseSizeBite={TUNE.condenseSizeBite}
          planetWindow={1}
        />

        <ThermalFlow
          isMobile={isMobile}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.4}
          flameWidth={params.flameWidth ?? 0.85}
          density={densityFor('thermal')}
          opacityMultiplier={opacityFor('thermal')}
          blending={THREE.NormalBlending}
          onFps={activePhase === 'thermal' ? onFps : null}
          condense={condenseFor('thermal')}
          condenseSizeBite={TUNE.condenseSizeBite}
          planetWindow={1}
        />

        <SedimentFlow
          isMobile={isMobile}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.25}
          eruptStrength={params.eruptStrength ?? 0.8}
          density={densityFor('earth')}
          opacityMultiplier={opacityFor('earth')}
          blending={THREE.NormalBlending}
          onFps={activePhase === 'earth' ? onFps : null}
          condense={condenseFor('earth')}
          condenseSizeBite={TUNE.condenseSizeBite}
          planetWindow={1}
        />

        <AtmosphericFlow
          isMobile={isMobile}
          orbitalSpeed={params.orbitalSpeed ?? 1.2}
          turbulence={params.turbulence ?? 0.18}
          spread={params.spread ?? 1.0}
          density={densityFor('air')}
          opacityMultiplier={opacityFor('air')}
          blending={THREE.NormalBlending}
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

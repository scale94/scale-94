import { Suspense, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

import ParticleFlow    from '../fluid/ParticleFlow';
import GlassKnot       from '../fluid/GlassKnot';
import ThermalFlow     from '../thermal/ThermalFlow';
import GlassHearth     from '../thermal/GlassHearth';
import SedimentFlow    from '../earth/SedimentFlow';
import CrystalGeode    from '../earth/CrystalGeode';
import AtmosphericFlow from '../air/AtmosphericFlow';
import AtmoShell       from '../air/AtmoShell';
import MercurySphere   from './MercurySphere';
import MercuryEnvironment from './MercuryEnvironment';
import usePhaseTransition from './usePhaseTransition';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const GHOST_DENSITY = isMobile ? 150 : 300;

export default function MercuryCanvas({
  params,
  sargScore = 1.0,
  onPhaseChange = null,
  onFps = null,
  onElementFired = null,
}) {
  const {
    activePhase,
    pendingPhase,
    phaseOpacities,
    sphereState,
    triggerTransition,
  } = usePhaseTransition('fluid');

  const controlsRef = useRef();
  const idleTimer = useRef(null);
  const dpr = isMobile ? [1, 1.5] : [1, 2];

  const handleNodeTap = useCallback((phase) => {
    triggerTransition(phase);
    onPhaseChange?.(phase);
  }, [triggerTransition, onPhaseChange]);

  const handleInteractionStart = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, []);

  const handleInteractionEnd = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = true;
    }, 3000);
  }, []);

  const densityFor = (phase) =>
    phase === activePhase ? (params.density ?? (isMobile ? 600 : 1200)) : GHOST_DENSITY;

  // Active phase capped at 0.45 — additive blending accumulates fast, sphere must remain legible
  const opacityFor = (phase) =>
    Math.min(phase === activePhase ? 0.45 : 0.12, phaseOpacities[phase]);

  return (
    <Canvas
      camera={{ position: isMobile ? [0, 0, 6] : [0, 0, 5], fov: isMobile ? 48 : 42 }}
      dpr={dpr}
      gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: '#000' }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.12} color="#0a0a12" />
        <pointLight position={[3, 3, 3]}  intensity={1.5} color="#c8c8d8" />
        <pointLight position={[-2, -2, 1]} intensity={0.6} color="#1a1a2e" />
        <MercuryEnvironment
          activePhase={activePhase}
          pendingPhase={pendingPhase}
          sphereState={sphereState}
          isMobile={isMobile}
        />

        {/* NormalBlending: prevents additive accumulation to white in multi-system canvas */}
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
        />
        {/* Boundary geometries hidden — the Mercury sphere is the visual anchor */}
        <GlassKnot isMobile={isMobile} visible={false} />

        <ThermalFlow
          isMobile={isMobile}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.4}
          flameWidth={params.flameWidth ?? 0.85}
          density={densityFor('thermal')}
          opacityMultiplier={opacityFor('thermal')}
          blending={THREE.NormalBlending}
          onFps={activePhase === 'thermal' ? onFps : null}
        />
        <GlassHearth isMobile={isMobile} visible={false} />

        <SedimentFlow
          isMobile={isMobile}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.25}
          eruptStrength={params.eruptStrength ?? 0.8}
          density={densityFor('earth')}
          opacityMultiplier={opacityFor('earth')}
          blending={THREE.NormalBlending}
          onFps={activePhase === 'earth' ? onFps : null}
        />
        <CrystalGeode isMobile={isMobile} visible={false} />

        <AtmosphericFlow
          isMobile={isMobile}
          orbitalSpeed={params.orbitalSpeed ?? 1.2}
          turbulence={params.turbulence ?? 0.18}
          spread={params.spread ?? 1.0}
          density={densityFor('air')}
          opacityMultiplier={opacityFor('air')}
          blending={THREE.NormalBlending}
          onFps={activePhase === 'air' ? onFps : null}
        />
        <AtmoShell isMobile={isMobile} visible={false} />

        <MercurySphere
          activePhase={activePhase}
          pendingPhase={pendingPhase}
          sphereState={sphereState}
          onNodeTap={handleNodeTap}
          onElementFired={onElementFired}
          sargScore={sargScore}
          isMobile={isMobile}
        />

        <OrbitControls
          ref={controlsRef}
          autoRotate
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.05}
          minDistance={2.5}
          maxDistance={7}
          onStart={handleInteractionStart}
          onEnd={handleInteractionEnd}
        />

        {/* No bloom in Mercury mode — four simultaneous particle systems would blow out.
            The sphere's physical material reads fine unpostprocessed. */}
      </Suspense>
    </Canvas>
  );
}

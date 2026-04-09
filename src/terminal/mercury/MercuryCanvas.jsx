import { Suspense, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

import ParticleFlow    from '../fluid/ParticleFlow';
import GlassKnot       from '../fluid/GlassKnot';
import ThermalFlow     from '../thermal/ThermalFlow';
import GlassHearth     from '../thermal/GlassHearth';
import SedimentFlow    from '../earth/SedimentFlow';
import CrystalGeode    from '../earth/CrystalGeode';
import AtmosphericFlow from '../air/AtmosphericFlow';
import AtmoShell       from '../air/AtmoShell';
import MercurySphere   from './MercurySphere';
import usePhaseTransition from './usePhaseTransition';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
const GHOST_DENSITY = isMobile ? 1000 : 2500;

export default function MercuryCanvas({
  params,
  sargScore = 1.0,
  onPhaseChange = null,
  onFps = null,
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
    phase === activePhase ? (params.density ?? (isMobile ? 4000 : 10000)) : GHOST_DENSITY;

  return (
    <Canvas
      camera={{ position: isMobile ? [0, 0, 5] : [1.5, 1.5, 3.5], fov: isMobile ? 50 : 46 }}
      dpr={dpr}
      gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: '#000' }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.12} color="#0a0a12" />
        <pointLight position={[3, 3, 3]}  intensity={1.5} color="#c8c8d8" />
        <pointLight position={[-2, -2, 1]} intensity={0.6} color="#1a1a2e" />
        <Environment preset="night" />

        <ParticleFlow
          isMobile={isMobile}
          speed={params.speed}
          curlAmp={params.curlAmp ?? 0.02}
          tubeRadius={params.tubeRadius ?? 0.32}
          chromatic={params.chromatic ?? 0}
          density={densityFor('fluid')}
          opacityMultiplier={phaseOpacities.fluid}
          onFps={activePhase === 'fluid' ? onFps : null}
        />
        <GlassKnot isMobile={isMobile} visible={activePhase === 'fluid'} />

        <ThermalFlow
          isMobile={isMobile}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.4}
          flameWidth={params.flameWidth ?? 0.85}
          density={densityFor('thermal')}
          opacityMultiplier={phaseOpacities.thermal}
          onFps={activePhase === 'thermal' ? onFps : null}
        />
        <GlassHearth isMobile={isMobile} visible={activePhase === 'thermal'} />

        <SedimentFlow
          isMobile={isMobile}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.25}
          eruptStrength={params.eruptStrength ?? 0.8}
          density={densityFor('earth')}
          opacityMultiplier={phaseOpacities.earth}
          onFps={activePhase === 'earth' ? onFps : null}
        />
        <CrystalGeode isMobile={isMobile} visible={activePhase === 'earth'} />

        <AtmosphericFlow
          isMobile={isMobile}
          orbitalSpeed={params.orbitalSpeed ?? 1.2}
          turbulence={params.turbulence ?? 0.18}
          spread={params.spread ?? 1.0}
          density={densityFor('air')}
          opacityMultiplier={phaseOpacities.air}
          onFps={activePhase === 'air' ? onFps : null}
        />
        <AtmoShell isMobile={isMobile} visible={activePhase === 'air'} />

        <MercurySphere
          activePhase={activePhase}
          pendingPhase={pendingPhase}
          sphereState={sphereState}
          onNodeTap={handleNodeTap}
          sargScore={sargScore}
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

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            intensity={isMobile ? 0.8 : 1.4}
            mipmapBlur={!isMobile}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

import { useRef, useCallback } from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import GlassKnot from './GlassKnot';
import ParticleFlow from './ParticleFlow';

export default function FluidScene({
  isMobile = false,
  speed = 0.08,
  curlAmp = 0.02,
  tubeRadius = 0.32,
  chromatic = 0.0,
  density = null,
  onFps = null,
}) {
  const controlsRef = useRef();
  const idleTimer = useRef(null);

  const handleInteractionEnd = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = true;
    }, 3000);
  }, []);

  const handleInteractionStart = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, []);

  return (
    <>
      <color attach="background" args={['#000308']} />

      {/* Deep-ocean underlight — bioluminescent source */}
      <pointLight position={[0, -2, 0]}    intensity={1.2} color="#0a1f5c" distance={6}  decay={2} />
      {/* Faint surface scatter */}
      <pointLight position={[2,  2,  1.5]} intensity={0.5} color="#1a3a6e" distance={8}  decay={2} />
      {/* Subtle cold rim from behind */}
      <pointLight position={[-3, 0, -2]}   intensity={0.3} color="#0d2a4a" distance={7}  decay={2} />
      <ambientLight intensity={0.08} color="#060d1f" />

      <Environment preset="night" />

      <GlassKnot isMobile={isMobile} />
      <ParticleFlow
        isMobile={isMobile}
        speed={speed}
        curlAmp={curlAmp}
        tubeRadius={tubeRadius}
        chromatic={chromatic}
        density={density}
        onFps={onFps}
      />

      <OrbitControls
        ref={controlsRef}
        autoRotate
        autoRotateSpeed={0.4}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={6}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.12}
          luminanceSmoothing={0.9}
          intensity={isMobile ? 0.8 : 1.6}
          mipmapBlur={!isMobile}
        />
      </EffectComposer>
    </>
  );
}

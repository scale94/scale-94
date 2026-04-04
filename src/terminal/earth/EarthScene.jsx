import { useRef, useCallback } from 'react';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import CrystalGeode from './CrystalGeode';
import SedimentFlow from './SedimentFlow';

export default function EarthScene({
  isMobile      = false,
  speed         = 0.08,
  turbulence    = 0.25,
  eruptStrength = 0.8,
  density       = null,
  onFps         = null,
}) {
  const controlsRef = useRef();
  const idleTimer   = useRef(null);

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

  return (
    <>
      <color attach="background" args={['#040200']} />

      {/* Deep magma source — punchy, drives the sediment glow */}
      <pointLight position={[0, -2.2, 0]}   intensity={4.0}  color="#6a2800" distance={5}   decay={2} />
      {/* Warm sunlight filtering through crystal faces */}
      <pointLight position={[2,  3,   1.5]} intensity={0.9}  color="#d49030" distance={10}  decay={2} />
      {/* Cool mineral backlight — catches crystal edges */}
      <pointLight position={[-2.5, 0.5, -2]} intensity={0.4} color="#403020" distance={7}   decay={2} />
      {/* Low front fill — reveals sediment stratification layers */}
      <pointLight position={[0,   0,   3.5]} intensity={0.3} color="#8a5020" distance={6}   decay={2} />
      <ambientLight intensity={0.08} color="#1a0e06" />

      <Environment preset="forest" />

      <CrystalGeode isMobile={isMobile} />
      <SedimentFlow
        isMobile={isMobile}
        speed={speed}
        turbulence={turbulence}
        eruptStrength={eruptStrength}
        density={density}
        onFps={onFps}
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

      {/* Subtle bloom — mineral shimmer, not fire. Surface chalk particles catch it most. */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.20}
          luminanceSmoothing={0.92}
          intensity={isMobile ? 0.5 : 1.0}
          mipmapBlur={!isMobile}
        />
      </EffectComposer>
    </>
  );
}

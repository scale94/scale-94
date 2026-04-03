import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import FluidScene from '../fluid/FluidScene';

// Detect mobile once at module level (avoids re-check every render)
const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function FluidTab() {
  const dpr = useMemo(() => isMobile ? [1, 1.5] : [1, 2], []);

  return (
    <div
      className="w-full rounded-sm overflow-hidden"
      style={{
        // Desktop: subtract header (~140px). Mobile: also subtract bottom nav (56px).
        height: isMobile ? 'calc(100vh - 196px)' : 'calc(100vh - 140px)',
        background: '#000000',
        touchAction: 'none', // prevent pull-to-refresh / swipe-back from fighting OrbitControls
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        dpr={dpr}
        gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <FluidScene isMobile={isMobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}

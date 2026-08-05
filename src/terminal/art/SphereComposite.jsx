// SphereComposite.jsx — real bloom for the sphere.
//
// Sits ABOVE the 2D canvas, takes its output as a texture on a fullscreen quad,
// and runs bright-extract bloom (always) plus vignette (immersive only). The 2D
// draw loop is not restructured: this is a post-process, not a port.
//
// Three things here are load-bearing:
//
// 1. pointer-events:none on the wrapper. This overlay completely covers the 2D
//    canvas, which is where every hover, click, resonance, fusion and drag is
//    hit-tested. If it ever accepts pointer events the sphere still renders
//    perfectly and every interaction dies silently.
//
// 2. ONE CanvasTexture, created once and marked needsUpdate each frame. A new
//    texture per frame would allocate and re-upload a full GPU texture 60x a
//    second and leak until GC.
//
// 3. frameloop="never" plus advance() called from the tail of ArtTab's draw
//    loop. r3f's own rAF loop is independent of ArtTab's, so with the default
//    frameloop the composite shows whichever 2D frame happened to finish last —
//    a one-frame lag that gets worse under load. Driving it from the 2D loop
//    guarantees we composite the frame that was just drawn.

import { useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { compositeDpr, COMPOSITE_STYLE, BLOOM, VIGNETTE } from './artComposite';

// The fullscreen quad. An orthographic camera in r3f is sized in pixels, so a
// plane matching the viewport in pixels fills it exactly with no camera maths.
function SourceQuad({ sourceRef }) {
  const size = useThree(s => s.size);

  const texture = useMemo(() => {
    const el = sourceRef.current;
    if (!el) return null;
    const t = new THREE.CanvasTexture(el);
    t.minFilter = THREE.LinearFilter;      // no mipmaps: the quad is 1:1
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;   // the 2D canvas is sRGB
    return t;
  }, [sourceRef]);

  useEffect(() => () => texture?.dispose(), [texture]);

  // Re-upload the 2D canvas each rendered frame. This is the whole cost of the
  // composite, and it is measured rather than assumed — see the step-2 plan.
  useFrame(() => { if (texture) texture.needsUpdate = true; });

  if (!texture) return null;

  // toneMapped={false} presents the 2D colours unchanged; depth is off because
  // there is exactly one object and nothing to sort against.
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[size.width, size.height]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// Hands r3f's advance() out to ArtTab. Must live inside <Canvas> to read the store.
function AdvanceBridge({ onAdvanceReady }) {
  const advance = useThree(s => s.advance);
  useEffect(() => {
    onAdvanceReady?.(advance);
    return () => onAdvanceReady?.(null);
  }, [advance, onAdvanceReady]);
  return null;
}

export default function SphereComposite({ sourceRef, immersive, onAdvanceReady }) {
  const dpr = useRef(compositeDpr(typeof window !== 'undefined' ? window.devicePixelRatio : 1)).current;

  return (
    <div style={COMPOSITE_STYLE} aria-hidden="true">
      <Canvas
        frameloop="never"
        dpr={dpr}
        orthographic
        camera={{ position: [0, 0, 1], near: 0.1, far: 10 }}
        gl={{
          alpha: false,
          antialias: false,
          // Called out in the spec's own traps: a wrong premultipliedAlpha
          // produces an identical GL call log with visibly different output,
          // which is why this migration is gated on pixels and not call logs.
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
        }}
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <AdvanceBridge onAdvanceReady={onAdvanceReady} />
        <SourceQuad sourceRef={sourceRef} />
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={BLOOM.luminanceThreshold}
            luminanceSmoothing={BLOOM.luminanceSmoothing}
            intensity={BLOOM.intensity}
            mipmapBlur={BLOOM.mipmapBlur}
            radius={BLOOM.radius}
          />
          {immersive
            ? <Vignette offset={VIGNETTE.offset} darkness={VIGNETTE.darkness} eskil={false} />
            : null}
        </EffectComposer>
      </Canvas>
    </div>
  );
}

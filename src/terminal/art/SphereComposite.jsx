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

// Keep the GL layer exactly the size of the 2D canvas.
//
// r3f sizes its renderer by measuring its own container with a ResizeObserver,
// and on this page that measurement gets stuck: several observers already run,
// one of them resizes the 2D canvas, and the browser drops notifications under
// the resulting feedback ("ResizeObserver loop completed with undelivered
// notifications"). The GL buffer stayed at the 14x6 the container had during
// first layout. Not a frameloop artefact — identical under frameloop="always".
//
// Resizing the renderer directly was the first fix and it fights r3f: calling
// setSize() on the store re-renders the subtree, which changes <Canvas>'s
// `children`, which re-runs its layout effect, which re-applies the STALE
// measurement — so the buffer oscillated between the right size and 14x6.
//
// So drive r3f's own path instead. Size the wrapper (the element r3f measures)
// to the 2D canvas in pixels, then fire a window resize, which is what
// react-use-measure listens to — undebounced, so it re-measures synchronously.
// The correct size then flows to the renderer, the store, the camera and the
// EffectComposer's render targets together, with nothing to fight.
function SizeSync({ sourceRef, wrapRef }) {
  const gl = useThree(s => s.gl);
  const tick = useRef(0);

  useFrame(() => {
    const el = sourceRef.current, wrap = wrapRef.current;
    if (!el || !wrap) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (w <= 0 || h <= 0) return;

    // Compare against the REAL drawing buffer, not against what we last asked
    // for. A single dispatch is not enough — the first one can land before r3f
    // has attached its observer and is then never retried, which left the
    // renderer at 14x6 while the wrapper was correctly 1446x580. Retrying until
    // the renderer actually agrees makes this self-healing.
    const ratio = gl.getPixelRatio();
    if (gl.domElement.width === Math.round(w * ratio)
     && gl.domElement.height === Math.round(h * ratio)) { tick.current = 0; return; }

    if (wrap.style.width !== `${w}px` || wrap.style.height !== `${h}px`) {
      wrap.style.width = `${w}px`;
      wrap.style.height = `${h}px`;
    }
    // Throttle: a resize event is page-wide and a few other canvases listen.
    if (tick.current++ % 10 === 0) window.dispatchEvent(new Event('resize'));
  });

  return null;
}

// Hands r3f's advance() out to ArtTab. Must live inside <Canvas> to read the store.
//
// KNOWN LIMITATION, recorded rather than worked around: the deterministic
// capture harness (scripts/determinism.mjs) replaces requestAnimationFrame with
// a manual pump, and under it this GL layer never renders — useFrame does not
// run and the composite stays blank. frameloop="demand" + invalidate() was tried
// as a fix, on the theory that demand-mode schedules through rAF and would
// therefore be pumpable; it behaves identically, so the cause is deeper in r3f's
// loop than the frameloop mode. Both modes work correctly in a real browser.
//
// Consequence: the harness still gates the 2D layer, which is what step 2 needs,
// but it is blind to the GL layer. That is fine here and NOT fine from step 3,
// where real content moves into GL. Resolving it is a prerequisite for step 3.
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
  const wrapRef = useRef(null);

  return (
    // data-art-composite marks this subtree as the GL layer. From step 2 the
    // container holds two canvases of identical size, and capture tooling has
    // to tell them apart without calling getContext() — probing with
    // getContext('2d') permanently claims an uninitialised canvas as 2D and
    // stops r3f ever getting a WebGL context on it.
    <div ref={wrapRef} style={COMPOSITE_STYLE} aria-hidden="true" data-art-composite="">
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
        style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
        onCreated={({ gl }) => {
          // pointer-events:none on the wrapper is NOT enough. The property is
          // inherited, but this canvas computes `auto`, which re-enables hits on
          // it and puts it in front of the 2D canvas for elementFromPoint — so
          // every hover, click, resonance, fusion and drag lands on the overlay
          // and dies, while the sphere still renders perfectly.
          //
          // This was invisible until the sizing bug above was fixed: at 14x6 the
          // overlay did not cover the centre of the sphere, so hit-testing
          // happened to still work. Two bugs, one masking the other.
          gl.domElement.style.pointerEvents = 'none';
        }}
      >
        <AdvanceBridge onAdvanceReady={onAdvanceReady} />
        <SizeSync sourceRef={sourceRef} wrapRef={wrapRef} />
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

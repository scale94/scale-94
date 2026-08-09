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
import {
  COLOR_GLSL, BACKGROUND_GLSL, backgroundUniforms, syncBackgroundUniforms,
} from './SphereBackground';
import { createEdgeLayer, syncEdgeLayer } from './SphereEdges';

// The composite pass. An orthographic camera in r3f is sized in pixels, so a
// plane matching the viewport in pixels fills it exactly with no camera maths.
//
// This composites in ONE shader: the GL background beneath, the 2D canvas over
// it, blended in sRGB, converted to linear on the way out. See
// SphereBackground.js for why it cannot be two blended quads.
//
// From step 4 the background is no longer *evaluated* here — it is rendered
// into an offscreen target by the backdrop pass below and sampled as a texture.
// The blend is unchanged: still sRGB, still one conversion at the very end.
const COMPOSITE_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uSource;
  uniform sampler2D uBackdrop;
  varying vec2 vUv;
  ${COLOR_GLSL}

  void main() {
    // uSource carries NoColorSpace, so this is the canvas's raw sRGB bytes with
    // a real alpha channel — not decoded, because the blend below has to happen
    // in the same space the 2D canvas composited in.
    vec4 src = texture2D(uSource, vUv);
    // uBackdrop is the offscreen target, also NoColorSpace: raw sRGB bytes, not
    // decoded on the way in. Both quads carry PlaneGeometry uvs against an
    // unflipped ortho camera, so vUv addresses the same texel in both.
    vec3 bg = texture2D(uBackdrop, vUv).rgb;

    // Source-over in sRGB, exactly as the 2D clear did. src.rgb is straight
    // (un-premultiplied) alpha, which is what a canvas upload yields.
    vec3 srgb = mix(bg, src.rgb, src.a);

    // Hand the pipeline linear working-space colour and full alpha — the same
    // thing the opaque meshBasicMaterial wrote in step 2, so bloom is unchanged.
    gl_FragColor = vec4(srgbToLinear(srgb), 1.0);
  }
`;

// ── The backdrop pass ───────────────────────────────────────────────────────
//
// Step 4 needs the edges as instanced line geometry, which cannot be evaluated
// inside a fullscreen fragment shader. So the backdrop moves off the screen
// pass and into an offscreen target that the edge pass will later draw over.
// This commit builds that pipeline and migrates NOTHING, so a parity failure
// here has exactly one candidate cause.
//
// The target is RGBA8 / UnsignedByte / NoColorSpace with no depth and no
// stencil. NoColorSpace is load-bearing on BOTH sides: tagging the texture
// SRGBColorSpace gives it an SRGB8_ALPHA8 internal format, so the hardware
// would encode on write and decode on sample, and the composite below would
// stop happening in sRGB — which is precisely the bug step 3 spent a rewrite
// fixing, and it scored 1.285 against a threshold of 4.
const BACKDROP_FRAG = /* glsl */`
  precision highp float;
  uniform vec2 uResolution;
  varying vec2 vUv;
  ${BACKGROUND_GLSL}

  void main() {
    // sRGB, unconverted. A raw ShaderMaterial's fragment output is not touched
    // by three's output colour-space chunk, and the target is NoColorSpace, so
    // what sphereBackground() computes is what lands in the byte buffer.
    gl_FragColor = vec4(sphereBackground(vUv, uResolution), 1.0);
  }
`;

// Built imperatively, NOT as an r3f <mesh>. Everything in r3f's scene graph is
// what the EffectComposer draws to the screen — a backdrop mesh in the tree
// would render into the target *and* be painted over the screen quad.
function createBackdrop() {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,      // no mipmaps: sampled 1:1
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;

  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    ...backgroundUniforms(),
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: COMPOSITE_VERT,
    fragmentShader: BACKDROP_FRAG,
    depthTest: false,
    depthWrite: false,
    transparent: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  const scene = new THREE.Scene();
  scene.add(mesh);

  // The sphere's base edges, drawn INTO this target on top of the backdrop and
  // therefore still beneath the 2D canvas. Added after the quad, and its
  // material is `transparent`, so three's own opaque-then-transparent ordering
  // draws it second whatever the render order says. See SphereEdges.js.
  const edges = createEdgeLayer();
  scene.add(edges.mesh);

  // The clip-space quad convention three uses for its own full-screen passes.
  // The edge mesh ignores it — it writes gl_Position directly — which is
  // deliberate: the CPU projects, so the camera has no part in the geometry.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    target, scene, camera, uniforms, edges,
    dispose() {
      geometry.dispose();
      material.dispose();
      edges.dispose();
      target.dispose();
    },
  };
}

function BackdropPass({ backdrop, stateRef, edgeStateRef }) {
  const gl = useThree(s => s.gl);
  const size = useThree(s => s.size);

  // Negative priority, deliberately. In r3f a priority ABOVE zero disables the
  // automatic render loop, and <EffectComposer> already claims that; a negative
  // one only orders this callback earlier inside the same frame. It must run
  // before SourceQuad (0) and the composer (1).
  useFrame(() => {
    const { target, scene, camera, uniforms, edges } = backdrop;

    // The drawing buffer is the ground truth the screen pass samples against,
    // and it is in DEVICE px. SizeSync does not own it — it is a self-healing
    // retry loop that nudges r3f into re-measuring and early-returns in several
    // paths — so the target is reconciled here, every frame, against the canvas
    // itself.
    const w = gl.domElement.width, h = gl.domElement.height;
    if (w <= 0 || h <= 0) return;
    if (target.width !== w || target.height !== h) target.setSize(w, h);

    // uResolution, by contrast, is CSS px: sphereBackground() does all its
    // maths in the space the 2D draw loop published (uSphereR, ghost xy, the
    // flash grid step). Feeding it the device-px buffer size would rescale
    // every layer.
    uniforms.uResolution.value.set(size.width, size.height);
    syncBackgroundUniforms(uniforms, stateRef?.current);
    // The edge layer carries its OWN resolution, published by the draw loop
    // with the coordinates it projected. It must not read `size` here: see the
    // note on createEdgeState().
    syncEdgeLayer(edges, edgeStateRef?.current);

    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
  }, -1);

  return null;
}

function SourceQuad({ sourceRef, backdropTexture }) {
  const size = useThree(s => s.size);
  const matRef = useRef(null);

  const texture = useMemo(() => {
    const el = sourceRef.current;
    if (!el) return null;
    const t = new THREE.CanvasTexture(el);
    t.minFilter = THREE.LinearFilter;      // no mipmaps: the quad is 1:1
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    // NoColorSpace, NOT SRGBColorSpace: tagging it sRGB makes the sampler
    // decode to linear, and the composite must run in sRGB. The conversion
    // happens once, on the finished pixel, in the shader.
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }, [sourceRef]);

  const uniforms = useMemo(() => ({
    uSource: { value: null },
    uBackdrop: { value: null },
  }), []);

  useEffect(() => () => texture?.dispose(), [texture]);

  // Re-upload the 2D canvas each rendered frame. This is the whole cost of the
  // composite, and it is measured rather than assumed — see the step-2 plan.
  useFrame(() => {
    if (texture) texture.needsUpdate = true;
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uSource.value = texture;
    // The target's JS texture object survives setSize(), so this is stable.
    m.uniforms.uBackdrop.value = backdropTexture;
  });

  if (!texture) return null;

  // Opaque and unblended: the shader has already resolved the 2D canvas
  // against the background, so there is no blend state to get wrong. Depth is
  // off because this is the only object in the scene.
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[size.width, size.height]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={COMPOSITE_VERT}
        fragmentShader={COMPOSITE_FRAG}
        depthTest={false}
        depthWrite={false}
        transparent={false}
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
// This used to carry a "the harness cannot drive this layer" limitation. It was
// not an r3f limitation: the capture shim froze performance.now() from page
// load, and React's scheduler compares that against a yield deadline, so a
// concurrent render never committed and <Canvas> never mounted its children —
// no onCreated, no useFrame, a blank GL layer that still looked plausible.
// scripts/determinism.mjs now boots real and virtualises afterwards. Fixed.
function AdvanceBridge({ onAdvanceReady }) {
  const advance = useThree(s => s.advance);
  useEffect(() => {
    onAdvanceReady?.(advance);
    return () => onAdvanceReady?.(null);
  }, [advance, onAdvanceReady]);
  return null;
}

export default function SphereComposite({ sourceRef, immersive, onAdvanceReady, bgStateRef, edgeGLRef }) {
  const dpr = useRef(compositeDpr(typeof window !== 'undefined' ? window.devicePixelRatio : 1)).current;
  const wrapRef = useRef(null);

  // Owned out here so both passes see the same object and it outlives neither.
  const backdrop = useMemo(() => createBackdrop(), []);
  useEffect(() => () => backdrop.dispose(), [backdrop]);

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
        <BackdropPass backdrop={backdrop} stateRef={bgStateRef} edgeStateRef={edgeGLRef} />
        <SourceQuad sourceRef={sourceRef} backdropTexture={backdrop.target.texture} />
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

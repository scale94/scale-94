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
// 2. There is no longer a 2D source texture at all. This used to upload one
//    CanvasTexture per frame; the canvas it sampled was measured empty at
//    every pixel and the sample was deleted. See COMPOSITE_FRAG. The canvas
//    ELEMENT still exists — it is the pointer surface point 1 is about, and
//    SizeSync still measures it — it just carries no ink.
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

import { compositeDpr, coarsePointer, glBufferSettled, COMPOSITE_STYLE, BLOOM, VIGNETTE, KNEE } from './artComposite';
import {
  COLOR_GLSL, BACKGROUND_GLSL, backgroundUniforms, syncBackgroundUniforms,
  riftUniform, syncRiftUniform,
} from './SphereBackground';
import { createEdgeLayer, syncEdgeLayer, SRC_OVER_LAYER, ADDITIVE_LAYER } from './SphereEdges';
import { createTrail, renderTrailFade } from './SphereTrail';
import { KneeEffect } from './SphereKnee';
import { trailSurvival } from './artTrail';
import SphereStrimer from './SphereStrimer';

/**
 * How much of last frame's GL ink survives into this one.
 *
 * `m` is the erase alpha the 2D canvas used ON THIS FRAME — per-mode, 0.72
 * normal and 0.32 immersive — and it arrives on the same published object the
 * canvas painted with, `state.rift.a`. Reading it from there rather than
 * re-deriving it from an immersive flag is the whole point: the fade and the
 * `destination-out` fill are then provably the same number, and a mode change
 * cannot desynchronise them for a frame.
 *
 * Before the draw loop has published anything there is no honest value, so this
 * returns 0 — a WIPE, which makes the accumulator a pass-through for that
 * frame. Falling back to a constant instead would put a plausible, wrong
 * brightness on the first frames of every capture, and the parity threshold is
 * nowhere near tight enough to notice.
 */
function survivalFor(state) {
  const m = state?.rift?.a;
  return Number.isFinite(m) ? trailSurvival(m) : 0;
}

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
  uniform sampler2D uBackdrop;
  uniform vec3 uRift;         // the clear colour, sRGB 0-1
  varying vec2 vUv;
  ${COLOR_GLSL}

  void main() {
    // ── The 2-D source layer is GONE, and it was already empty ─────────────
    //
    // This used to sample a full-resolution CanvasTexture of ArtTab's 2-D
    // canvas and blend it over the accumulator with
    // mix(bg, src.rgb, src.a). That canvas carried the whole sphere once.
    // The WebGL migration moved every layer of it onto instance buffers and
    // the DOM label overlay, and what was left was a destination-out
    // fillRect erasing alpha on a surface nothing painted — so src.a was
    // zero at every pixel and the mix resolved to bg every time.
    //
    // MEASURED before removal, real Chrome with rAF running at 272 fps,
    // 1920x984 = 1,889,280 pixels read back at idle, mid-cascade and after:
    // maxAlpha 0, nonZeroAlphaPx 0, maxRGB 0 in all three.
    // scripts/_a5srcalpha.mjs is the probe.
    //
    // NOT AN OPTIMISATION WITH A LOOK COST: removing a mix whose weight is
    // provably 0 is bit-identical, which is why this is gated on artCompare
    // against the certified reference rather than on an opinion about frames.
    // What it buys is one canvas-to-GPU texture upload PER FRAME at full
    // resolution, which on a tile-based mobile GPU is not a rounding error.
    //
    // uBackdrop is the accumulator, also NoColorSpace: raw sRGB bytes, not
    // decoded on the way in. Both quads carry PlaneGeometry uvs against an
    // unflipped ortho camera, so vUv addresses the same texel in both.
    //
    // It holds PREMULTIPLIED GL ink with coverage in alpha, and NOT the clear
    // colour — see the note above BACKGROUND_GLSL. This is the one place the
    // rift base enters the pipeline, written fresh from this frame's published
    // tint, so the accumulator can never compound it.
    vec4 ink = texture2D(uBackdrop, vUv);
    vec3 srgb = ink.rgb + uRift * (1.0 - ink.a);

    // Hand the pipeline linear working-space colour and full alpha — the same
    // thing the opaque meshBasicMaterial wrote in step 2, so bloom is unchanged
    // for everything that was already inside the gamut.
    //
    // ── Why the conversion is CLAMPED, and what it cost to find out ────────
    //
    // srgbToLinear is only defined on [0,1]. Above 1 it is an EXTRAPOLATION,
    // and a violent one: the high branch is pow((c + 0.055) / 1.055, 2.4), so
    //
    //     c =  2  ->      4.9
    //     c = 10  ->    241
    //     c = 37  ->   5170
    //
    // While the accumulator was RGBA8 that branch was unreachable — the blend
    // unit clamped at 1.0, so nothing above the gamut ever arrived here. The
    // half-float switch made it reachable for the first time, and the measured
    // peak of 37.15x on a 4-node cascade therefore entered the bloom's
    // bright-extract at about FIVE THOUSAND times white.
    //
    // MEASURED, projector fired-cascade, same pinned world: a blob region that
    // reads mean 7.42 in the RGBA8 reference read 52.73 with the bloom on and
    // 7.12 with it off — and the bloom-off pixel counts above 128 and above 200
    // came back at EXACTLY the reference numbers, 395 and 23. So the ink never
    // moved. The halo was entirely the pyramid amplifying an extrapolation
    // nobody had chosen.
    //
    // Clamping the conversion at 1 and carrying the excess linearly keeps the
    // in-gamut path bit-identical to what shipped, and makes overbright enter
    // the post stack PROPORTIONALLY: 37x of ink becomes 37x of light, not
    // 5170x. That is what makes intensity and luminanceThreshold remain
    // independent, dial-able levers instead of two ends of a runaway.
    vec3 lin = srgbToLinear(min(srgb, vec3(1.0)))
             + max(srgb - vec3(1.0), vec3(0.0));
    gl_FragColor = vec4(lin, 1.0);
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
// That offscreen target is no longer this pass's own: since the trail commit it
// is the accumulator's current `write` buffer (SphereTrail.js), which the fade
// pass has already primed. Same format either way — RGBA16F / HalfFloat /
// NoColorSpace, no depth, no stencil. The float type is what gives the additive
// layer room to exceed 1.0 instead of saturating in the blend unit; see
// createTarget() in SphereTrail.js. NoColorSpace is load-bearing on BOTH
// sides: tagging the texture SRGBColorSpace gives it an SRGB8_ALPHA8 internal
// format, so the hardware would encode on write and decode on sample, and the
// composite below would stop happening in sRGB — which is precisely the bug
// step 3 spent a rewrite fixing, and it scored 1.285 against a threshold of 4.
const BACKDROP_FRAG = /* glsl */`
  precision highp float;
  uniform vec2 uResolution;
  varying vec2 vUv;
  ${BACKGROUND_GLSL}

  void main() {
    // sRGB, unconverted. A raw ShaderMaterial's fragment output is not touched
    // by three's output colour-space chunk, and the target is NoColorSpace, so
    // what sphereBackgroundInk() computes is what lands in the byte buffer.
    //
    // PREMULTIPLIED ink, coverage in alpha, rift base excluded — and blended
    // source-over into the accumulator rather than replacing it. Both halves of
    // that matter: emitting the composited colour would push the clear through
    // the feedback loop, and replacing would erase the fade's output before it
    // could carry anything.
    gl_FragColor = sphereBackgroundInk(vUv, uResolution);
  }
`;

// Built imperatively, NOT as an r3f <mesh>. Everything in r3f's scene graph is
// what the EffectComposer draws to the screen — a backdrop mesh in the tree
// would render into the target *and* be painted over the screen quad.
//
// It owns no render target of its own: it is rendered INTO the accumulator's
// write buffer. Keeping a second full-resolution RGBA8 buffer alive for a pass
// that no longer reads or writes it would be a megabyte of dead VRAM per frame
// of nothing.
function createBackdrop(edgeData, additiveData) {
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
    // This quad used to be `transparent: false`, and that single flag was what
    // held the accumulator shut: three renders a non-transparent NormalBlending
    // material with NoBlending, so the backdrop REPLACED every texel of the
    // target — RGB and alpha — after the fade and before the edges. Raising
    // `survival` while that was true changed nothing at all.
    transparent: true,
    // Source-over for a PREMULTIPLIED source: rgb is already scaled by its own
    // coverage, so One (not SrcAlpha) is the correct source factor. The alpha
    // channel gets its own pair because it is now load-bearing — it is what the
    // screen pass uses to let the rift show through — and the default
    // separate-alpha behaviour would square it.
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    toneMapped: false,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // Both meshes are transparent now, so three sorts them together and the
  // painter sort's primary key is renderOrder. Explicit on BOTH, because the
  // tiebreak below it is view-space z and both sit at the origin.
  mesh.renderOrder = 0;

  const scene = new THREE.Scene();
  scene.add(mesh);

  // The sphere's base edges, drawn into the same target on top of the backdrop
  // and therefore still beneath the 2D canvas. Added after the quad, and its
  // material is `transparent`, so three's own opaque-then-transparent ordering
  // draws it second whatever the render order says. See SphereEdges.js.
  //
  // `edgeData` (the draw loop's own published Float32Array, from
  // createEdgeState()) becomes the mesh's OWN buffer — see createEdgeLayer's
  // docstring — so syncEdgeLayer never copies it, it only flags the range
  // dirty.
  const edges = createEdgeLayer(edgeData, SRC_OVER_LAYER);
  scene.add(edges.mesh);

  // The additive line layer — the resonance edge, and next the prism chords.
  // A SECOND mesh because `lighter` is additive and the base edges are
  // source-over, and one material cannot carry two blends. Added after the edge
  // mesh, which is also the 2D draw order it reproduces: every edge and every
  // pulse ring first, then these. See ADDITIVE_LAYER in SphereEdges.js for how
  // its four blend factors follow from what this target holds.
  const additive = createEdgeLayer(additiveData, ADDITIVE_LAYER);
  scene.add(additive.mesh);

  // The clip-space quad convention three uses for its own full-screen passes.
  // The edge mesh ignores it — it writes gl_Position directly — which is
  // deliberate: the CPU projects, so the camera has no part in the geometry.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    scene, camera, uniforms, edges, additive,
    dispose() {
      geometry.dispose();
      material.dispose();
      edges.dispose();
      additive.dispose();
    },
  };
}

function BackdropPass({ backdrop, trail, stateRef, edgeStateRef, additiveStateRef }) {
  const gl = useThree(s => s.gl);
  const size = useThree(s => s.size);

  // Negative priority, deliberately. In r3f a priority ABOVE zero disables the
  // automatic render loop, and <EffectComposer> already claims that; a negative
  // one only orders this callback earlier inside the same frame. It must run
  // before SourceQuad (0) and the composer (1).
  useFrame(() => {
    const { scene, camera, uniforms, edges, additive } = backdrop;

    // The drawing buffer is the ground truth the screen pass samples against,
    // and it is in DEVICE px. SizeSync does not own it — it is a self-healing
    // retry loop that nudges r3f into re-measuring and early-returns in several
    // paths — so the targets are reconciled here, every frame, against the
    // canvas itself. setSize mutates in place and early-exits on a match.
    const w = gl.domElement.width, h = gl.domElement.height;
    if (w <= 0 || h <= 0) return;
    trail.setSize(w, h);

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
    // Same contract, same buffer layout, its own stream — see createBackdrop.
    syncEdgeLayer(additive, additiveStateRef?.current);

    // Last frame's accumulation becomes this frame's source, and the fade
    // stands in for the clear, so nothing may wipe the target mid-sequence.
    //
    // autoClear is ALREADY false here: @react-three/postprocessing sets
    // renderer.autoClear = false when the composer initialises and never
    // restores it. This save/restore is therefore defensive, not load-bearing —
    // it exists so the sequence stays correct if that ever changes. Do not
    // read it as the thing that makes accumulation possible.
    //
    // ── The three things that had to be true together ─────────────────────
    // 1. The fade carries `survival = 1 - m` from the SAME published tint the
    //    2D canvas erased with this frame — not a constant, not a re-derivation
    //    from the immersive flag. See survivalFor().
    // 2. The backdrop emits premultiplied INK with the rift base excluded, so
    //    the clear colour cannot compound. See BACKGROUND_GLSL.
    // 3. The backdrop BLENDS rather than replaces. It used to be
    //    `transparent: false`, and three renders that with NoBlending, so it
    //    overwrote every texel the fade had just written — which made raising
    //    survival alone a provable no-op.
    //
    // Miss any one and the render does not change; miss only (2) and it changes
    // in the direction every instrument here reads as "brighter".
    trail.swap();
    const autoClear = gl.autoClear;
    gl.autoClear = false;
    try {
      // leaves trail.write bound
      renderTrailFade(gl, trail, survivalFor(stateRef?.current));
      gl.render(scene, camera);
    } finally {
      gl.autoClear = autoClear;
      gl.setRenderTarget(null);
    }
  }, -1);

  return null;
}

// The screen pass. Named for the 2-D source canvas it used to sample; it no
// longer samples anything but the accumulator, because that canvas was measured
// empty at every pixel (see COMPOSITE_FRAG). The name is kept because this is
// still the pass that puts the composited frame on the screen, and renaming it
// churns the four files that talk about it for nothing.
function SourceQuad({ trail, stateRef }) {
  const size = useThree(s => s.size);
  const matRef = useRef(null);

  const uniforms = useMemo(() => ({
    uBackdrop: { value: null },
    // The rift base lives here, on the SCREEN pass, and nowhere else. It is the
    // clear colour rather than a layer, so it must be written fresh every frame
    // underneath the accumulated ink instead of being fed through the fade.
    uRift: riftUniform(),
  }), []);

  useFrame(() => {
    const m = matRef.current;
    if (!m) return;
    // Read every frame, NOT taken once as a prop: `write` alternates between
    // the two accumulation buffers, so the texture this samples changes each
    // frame even though neither target object is ever replaced (setSize mutates
    // in place). This useFrame has priority 0 and BackdropPass has -1, so the
    // swap has already happened and this is the buffer just drawn into.
    m.uniforms.uBackdrop.value = trail.write.texture;
    // Same ref, same frame, same object BackdropPass read its survival from —
    // this useFrame is priority 0 and that one is -1, so the tint under the ink
    // is always the tint the ink was faded with.
    syncRiftUniform(m.uniforms.uRift, stateRef?.current);
  });

  // Opaque and unblended: the shader has already resolved the accumulated ink
  // against the rift base, so there is no blend state to get wrong. Depth is
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
    //
    // "Agrees" is to within a device pixel, not exactly: three writes
    // `Math.floor(fractionalWidth * ratio)` and the only width readable here is
    // an integer `clientWidth`, so exact equality is unsatisfiable at half-pixel
    // products and the retry never stopped. See glBufferSettled.
    const ratio = gl.getPixelRatio();
    if (glBufferSettled(gl.domElement.width, gl.domElement.height, w, h, ratio)) {
      tick.current = 0;
      return;
    }

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

export default function SphereComposite({ sourceRef, immersive, onAdvanceReady, bgStateRef, edgeGLRef, addGLRef, strimerRef }) {
  // Taken once, at mount, and deliberately not reactive: r3f rebuilds every
  // render target in the composer when `dpr` changes, and a device does not
  // stop being a touch device mid-session. ArtTab's ResizeObserver reads the
  // SAME pair of helpers, so the two backing stores cannot disagree.
  const dpr = useRef(compositeDpr(
    typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    coarsePointer(),
  )).current;
  const wrapRef = useRef(null);

  // Owned out here so both passes see the same object and it outlives neither.
  // edgeGLRef.current is set synchronously in ArtTab's render body (see
  // createEdgeState() there), before this child renders, so its `.data` array
  // already exists the first time this factory runs.
  const backdrop = useMemo(
    () => createBackdrop(edgeGLRef?.current?.data, addGLRef?.current?.data),
    [edgeGLRef, addGLRef],
  );
  useEffect(() => () => backdrop.dispose(), [backdrop]);

  // The accumulator, owned out here for the same reason: BackdropPass renders
  // into it and SourceQuad samples it, and it must outlive neither.
  const trail = useMemo(() => createTrail(), []);
  useEffect(() => () => trail.dispose(), [trail]);

  // The tail shoulder. Built once and mounted with <primitive> rather than
  // re-created from props: <EffectComposer> rebuilds its whole pass list in a
  // layout effect keyed on `children`, so a new Effect instance per render
  // would tear down and rebuild the merged fragment pass every frame the
  // parent re-renders. The knee value is driven through the uniform instead.
  const knee = useMemo(() => new KneeEffect({ knee: KNEE.knee }), []);
  useEffect(() => () => knee.dispose(), [knee]);

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
        <BackdropPass backdrop={backdrop} trail={trail} stateRef={bgStateRef}
          edgeStateRef={edgeGLRef} additiveStateRef={addGLRef} />
        <SourceQuad trail={trail} stateRef={bgStateRef} />
        {/* The strimer. AFTER SourceQuad and BEFORE the composer: inside the
            composer's input so it gets Bloom and Knee, and outside the trail
            accumulator so it leaves zero residual. See SphereStrimer.jsx. */}
        <SphereStrimer strimerRef={strimerRef} />
        <EffectComposer disableNormalPass>
          <Bloom
            luminanceThreshold={BLOOM.luminanceThreshold}
            luminanceSmoothing={BLOOM.luminanceSmoothing}
            intensity={BLOOM.intensity}
            mipmapBlur={BLOOM.mipmapBlur}
            radius={BLOOM.radius}
            levels={BLOOM.levels}
          />
          {immersive
            ? <Vignette offset={VIGNETTE.offset} darkness={VIGNETTE.darkness} eskil={false} />
            : null}
          {/* LAST, and that is the design. The shoulder has to run after the
              bloom so the bright-extract sees true overbright, and after the
              vignette so the corners are darkened before they are compressed
              rather than after — compressing first and darkening second would
              spend the shoulder's range on pixels the vignette then throws
              away. See the KNEE block in artComposite.js. */}
          <primitive object={knee} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

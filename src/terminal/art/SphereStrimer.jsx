// SphereStrimer.jsx — the click-triggered wavefront, on the one layer in this
// pipeline that does not accumulate.
//
// ── WHY IT IS HERE AND NOT ON THE ADDITIVE EDGE MESH ──────────────────────
//
// BackdropPass renders the backdrop and BOTH edge meshes into `trail.write`,
// after renderTrailFade — so anything drawn there feeds back at
// survival = 1 - m. MEASURED: 0.21-0.24 normal, 0.48-0.59 immersive. The knee
// then compresses the decaying residual so it reads FLAT: a stack-3 head held
// 98 / 96 / 87% of peak for three frames after it stopped being drawn, where a
// stack-1 head fell 73 / 41 / 22%. On that layer, head brightness IS tail
// length in exhibit mode, and "zero lingering residual wash" is unreachable at
// any parameter.
//
// This mesh is in r3f's own scene graph, so it is NOT in that path at all.
// MEASURED on the same probe: lift fell 0.80 -> 0.020 (normal) and
// 0.78 -> 0.027 (immersive) on the single frame after the packet stopped —
// both at the simulation's own noise floor, both modes identical. That is the
// entire reason this file exists.
//
// Three things about the mount are load-bearing:
//   - It is INSIDE <EffectComposer>'s input, so the packet gets Bloom and then
//     Knee exactly as everything else does.
//   - That input is HalfFloatType (the @react-three/postprocessing 3.0.4
//     default), so gain above 1.0 survives to the bright-extract. MEASURED
//     peak 0.907 / 0.967 / 0.979 at gain 1 / 2.4 / 4.
//   - renderOrder 10 with depthTest off. SourceQuad is opaque at the default
//     renderOrder 0, and without an explicit order three's opaque-first sort
//     could place this either side of it.
//
// THE COST, ACCEPTED KNOWINGLY: this layer is over the 2D canvas, so a packet
// passes IN FRONT OF node glyphs rather than behind them.
//
// ── THE BUFFER HOLDS LINEAR COLOUR ────────────────────────────────────────
// SourceQuad emits srgbToLinear(min(srgb,1)) + max(srgb-1,0), so everything
// downstream is linear working space — unlike the additive edge mesh, which
// writes sRGB bytes into an sRGB-conceptual accumulator. The colours in the
// instance buffer are ALREADY LINEAR; artStrimer.hslToLinearRgb does that
// conversion once, on the CPU, at the write site.

import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { STRIMER_STRIDE, STRIMER_MAX_PACKETS } from './artStrimer';

const STRIMER_VERT = /* glsl */`
  attribute vec2  aHead;
  attribute vec2  aTail;
  attribute vec2  aStyle;    // x = width px, y = gain (LINEAR, may exceed 1)
  attribute vec3  aColor;    // the tail colour, LINEAR
  attribute float aProfile;  // 0 packet, 1 rail, 2 ping

  uniform vec2 uResolution;  // CSS px, matching the coordinates the loop wrote

  varying vec2  vP;
  varying vec2  vHead;
  varying vec2  vTail;
  varying float vWidth;
  varying float vGain;
  varying float vProfile;
  varying vec3  vColor;

  void main() {
    vec2 d = aTail - aHead;
    float L = length(d);
    // A PING has head == tail, so d is the zero vector. Falling back to a
    // fixed axis keeps dir finite; the fragment never reads it in that case
    // because h clamps to 0 and the distance becomes plain radial.
    vec2 dir = L > 1e-6 ? d / L : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    // Pad for the gaussian's reach. exp(-2(d/w)^2) drops below 1/255 at
    // d = 1.66w, the same reach the edge layer's GLOW_REACH uses; +1 covers
    // the antialiasing shoulder.
    float pad = aStyle.x * 1.75 + 1.0;

    // position.xy is PlaneGeometry(1,1), i.e. [-0.5, 0.5]. Map x along the
    // capsule from -pad to L+pad, and y across it from -pad to +pad.
    float s = (position.x + 0.5) * (L + 2.0 * pad) - pad;
    float t = position.y * 2.0 * pad;
    vec2 p = aHead + dir * s + nrm * t;

    vP = p; vHead = aHead; vTail = aTail;
    vWidth = aStyle.x; vGain = aStyle.y; vProfile = aProfile; vColor = aColor;

    // Clip space straight from CSS px. The CPU has already projected, so the
    // camera takes no part in this geometry — the same contract EDGE_VERT
    // keeps, and why the orthographic camera's existence is irrelevant here.
    gl_Position = vec4(p.x / uResolution.x * 2.0 - 1.0,
                       1.0 - p.y / uResolution.y * 2.0,
                       0.0, 1.0);
  }
`;

const STRIMER_FRAG = /* glsl */`
  precision highp float;

  varying vec2  vP;
  varying vec2  vHead;
  varying vec2  vTail;
  varying float vWidth;
  varying float vGain;
  varying float vProfile;
  varying vec3  vColor;

  void main() {
    if (vGain <= 0.0) discard;

    vec2 pa = vP - vHead, ba = vTail - vHead;
    // LOAD-BEARING, not defensive: a ping has ba = 0, and this is what turns
    // the capsule into a disc instead of a division by zero. h clamps to 0 and
    // d becomes the plain radial distance from the centre.
    float bb = max(dot(ba, ba), 1e-6);
    float h = clamp(dot(pa, ba) / bb, 0.0, 1.0);   // 0 at the head, 1 at the tail
    float d = length(pa - ba * h);

    // The same exp(-2(d/w)^2) the edge shader's glow uses, so the two read as
    // one family of light rather than two.
    float w = max(vWidth, 1e-3);
    float cross = exp(-2.0 * (d / w) * (d / w));

    // Branching is safe here: vProfile is constant across an instance, so a
    // warp never diverges on it, and nothing below reads a derivative. (The
    // edge shader has to use mix() instead precisely because it does.)
    float along = vProfile < 0.5 ? pow(1.0 - h, 2.5) : 1.0;

    // WHITE AT THE HEAD, and this is forced rather than a taste call: the knee
    // is a max-channel Reinhard, so it scales all three channels by one factor
    // and can never whiten a saturated colour. A cyan head at (0, 2.4, 2.4)
    // exits as (0, 0.927, 0.927) — bright cyan, never white.
    vec3 col = vProfile < 0.5
      ? mix(vColor, vec3(1.0), pow(1.0 - h, 6.0))
      : (vProfile < 1.5 ? vColor : vec3(1.0));

    // Alpha is written 0 and the material takes Zero/One for it. The screen
    // pass wrote full alpha and the vignette and knee read it; an additive
    // layer that also accumulated alpha would quietly change what they see.
    gl_FragColor = vec4(col * (vGain * along * cross), 0.0);
  }
`;

export default function SphereStrimer({ strimerRef }) {
  const size = useThree(s => s.size);
  const meshRef = useRef(null);

  // Built once. `data` is the draw loop's own Float32Array and becomes the
  // InterleavedBuffer's backing store, so the sync below never copies — it
  // only flags the written range dirty. Reallocating it would silently unbind
  // the writer from the thing the GPU reads.
  const { geometry, material, buffer } = useMemo(() => {
    const data = strimerRef?.current?.data
      ?? new Float32Array(STRIMER_MAX_PACKETS * 2 * STRIMER_STRIDE);
    const buf = new THREE.InstancedInterleavedBuffer(data, STRIMER_STRIDE, 1);
    buf.setUsage(THREE.DynamicDrawUsage);

    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.attributes.position = quad.attributes.position;
    quad.dispose();
    geo.setAttribute('aHead', new THREE.InterleavedBufferAttribute(buf, 2, 0));
    geo.setAttribute('aTail', new THREE.InterleavedBufferAttribute(buf, 2, 2));
    geo.setAttribute('aStyle', new THREE.InterleavedBufferAttribute(buf, 2, 4));
    geo.setAttribute('aColor', new THREE.InterleavedBufferAttribute(buf, 3, 6));
    geo.setAttribute('aProfile', new THREE.InterleavedBufferAttribute(buf, 1, 9));
    geo.instanceCount = 0;
    // The quad is written in clip space from uResolution, so three's own
    // bounding sphere is meaningless and would cull the whole mesh.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uResolution: { value: new THREE.Vector2(1, 1) } },
      vertexShader: STRIMER_VERT,
      fragmentShader: STRIMER_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      toneMapped: false,
      side: THREE.DoubleSide,
    });

    return { geometry: geo, material: mat, buffer: buf };
  }, [strimerRef]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame(() => {
    const st = strimerRef?.current;
    if (!st) return;
    const n = Math.min(st.instances, st.cap * 2);
    geometry.instanceCount = n;
    // addUpdateRange + needsUpdate, exactly as syncEdgeLayer does it. three
    // 0.183 replaced the old `updateRange = {offset, count}` property, and
    // setting that instead uploads nothing while everything else looks fine.
    if (n > 0) {
      buffer.addUpdateRange(0, n * STRIMER_STRIDE);
      buffer.needsUpdate = true;
    }
    // Skip the draw entirely when the layer is idle, as the edge layers do.
    if (meshRef.current) meshRef.current.visible = n > 0;
    // CSS px, published WITH the coordinates by the draw loop rather than
    // measured here — r3f's own `size` comes from a ResizeObserver documented
    // in SphereComposite as getting stuck on this page, and a stale resolution
    // rescales absolute pixel coordinates about the origin.
    material.uniforms.uResolution.value.set(
      st.w || size.width, st.h || size.height);
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={10}
      geometry={geometry} material={material} />
  );
}

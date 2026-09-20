// _s2layer.mjs — THROWAWAY. Does the non-accumulating layer actually work?
//
// The author chose the r3f-scene-graph layer on _s1wake's numbers, and I said
// I would probe it before promising it. Four things have to be true and none
// of them is true by inspection:
//
//   1. A mesh added to r3f's tree AFTER <SourceQuad> renders at all, and lands
//      INSIDE the composer's input rather than over the finished frame.
//   2. It can exceed 1.0 there. The composer's buffer is HalfFloatType (the
//      @react-three/postprocessing 3.0.4 default, verified in dist), so the
//      headroom should exist — but "should" is how the last two sessions went
//      wrong, and if it clips at 1.0 the whole choice is void.
//   3. The residual after it stops is ZERO frames, in BOTH modes. That is the
//      entire reason this layer was chosen over the certified additive one.
//   4. Drawn as a SEGMENT rather than a disc, it reads as a continuous crack
//      instead of the bead necklace _s1wake photographed.
//
// It also measures the cost the author accepted going in: this layer is over
// the 2D canvas, so the packet passes IN FRONT OF the node glyphs. That is
// visible in the frames, and it is his call whether it reads as wrong.
//
// ── TWO PATCHED FILES, ONE RESTORE ────────────────────────────────────────
// PATCHES TRACKED SOURCE: src/terminal/views/ArtTab.jsx (publishes the chosen
// edge's live endpoints, exactly as _s1wake's patch does) and
// src/terminal/art/SphereComposite.jsx (mounts the probe mesh). Both restore
// in one `finally`. A hard kill beats it. RUN `git status` AFTER THIS; the
// revert is `git checkout -- src/terminal/views/ArtTab.jsx
// src/terminal/art/SphereComposite.jsx` and nothing in either patch is worth
// keeping. NEVER run this during a capture.
//
// ── WHY A CAPSULE IN A FULLSCREEN FRAGMENT AND NOT THE EDGE MESH ─────────
// Reusing createEdgeLayer here would be the elegant move and it is the wrong
// probe: that material's encoding CANNOT express ink above 1.0 (see _s1wake's
// header), so it could not test claim 2 at all, and its ink is authored in
// sRGB while this buffer holds LINEAR working-space colour — a mismatch worth
// discovering deliberately rather than inheriting. A capsule evaluated in one
// fullscreen fragment writes linear floats directly, tests every claim, and
// throws away cleanly.
//
// Usage:  node scripts/_s2layer.mjs [--normal|--imm]

import { readFile, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { launch } from './cdp.mjs';
import { decodePng } from './_png.mjs';

const ART = 'src/terminal/views/ArtTab.jsx';
const CMP = 'src/terminal/art/SphereComposite.jsx';
const OUT = 'lookbook/layer';
const URL = 'http://localhost:5174/';

const ONLY_NORMAL = process.argv.includes('--normal');
const ONLY_IMM    = process.argv.includes('--imm');
const MODES = ONLY_IMM ? ['imm'] : ONLY_NORMAL ? ['normal'] : ['normal', 'imm'];

// Gains in LINEAR working space, which is the space the composer buffer holds.
// 1.0 is nominal white; 2.4 is the author's stated target for blowing out the
// bloom; 4.0 overshoots it so the knee's behaviour is bracketed rather than
// sampled at one point.
const GAINS = [1, 2.4, 4];

const TRANSIT_MS = 100;
const SHOT_FRAMES = 12;
// Packet length as a fraction of the edge. _s1wake measured the per-frame
// stride at 41px on a 249px edge — 17% — and a packet shorter than the stride
// is what produced the beads. This is that number.
const PACKET = 0.17;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const SPHERE = `[...document.querySelectorAll('canvas')]
  .filter(c => c.offsetParent && !c.closest('[data-art-composite]'))
  .sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]`;
const SPHERE_READY = `(() => { const c = ${SPHERE}; return !!c && c.getBoundingClientRect().width > 800; })()`;
const clickByText = (p, f = 'i') => `(() => { const re = new RegExp(${JSON.stringify(p)}, ${JSON.stringify(f)});
  const b = [...document.querySelectorAll('button')].find(e => re.test(e.innerText || ''));
  if (!b) return false; b.click(); return true; })()`;
const CLICK_IMMERSIVE = `(() => {
  const b = [...document.querySelectorAll('button')].find(e =>
    /immersive/i.test((e.innerText || '') + ' ' + (e.title || '')
      + ' ' + (e.getAttribute('aria-label') || '')));
  if (!b) return false; b.click(); return true; })()`;

// ── Patch 1: ArtTab publishes the edge and its live endpoints ─────────────
// Identical in intent to _s1wake's, minus the drawing: this probe draws
// nowhere near the additive mesh. Same reason the patch chooses the edge
// rather than the rig — `proj` is rebuilt every frame and no hook exposes it.
const ART_ANCHOR = '      const _pcen = nodeCensusRef.current;';
const ART_PATCH = `      // ── PROBE (_s2layer.mjs, throwaway) — publish only, draw nothing ─
      if (window.__strimer) {
        const _sp = window.__strimer;
        if (_sp.aId == null && es) {
          let _bl = -1;
          for (const _e of es) {
            const _i = nodes.findIndex(n => n.id === _e.aId);
            const _j = nodes.findIndex(n => n.id === _e.bId);
            if (_i < 0 || _j < 0) continue;
            const _p = proj[_i], _q = proj[_j];
            if (!_p || !_q || _p.depth < 0 || _q.depth < 0) continue;
            const _L = Math.hypot(_q.sx - _p.sx, _q.sy - _p.sy);
            if (_L > _bl) { _bl = _L; _sp.aId = _e.aId; _sp.bId = _e.bId; }
          }
          _sp.len = _bl;
        }
        const _ia = _sp.aId == null ? -1 : nodes.findIndex(n => n.id === _sp.aId);
        const _ib = _sp.bId == null ? -1 : nodes.findIndex(n => n.id === _sp.bId);
        const _pa = _ia >= 0 ? proj[_ia] : null;
        const _pb = _ib >= 0 ? proj[_ib] : null;
        _sp.u = (performance.now() - _sp.t0) / _sp.ms;
        if (_pa && _pb) {
          _sp.ax = _pa.sx; _sp.ay = _pa.sy; _sp.bx = _pb.sx; _sp.by = _pb.sy;
        }
      }
`;

// ── Patch 2: the probe mesh, in r3f's scene graph ─────────────────────────
//
// renderOrder 10 and depthTest off: <SourceQuad> is opaque at the default
// renderOrder 0, so without an explicit order three's opaque-first sort could
// put this either side of it. The buffer it adds into is the composer's
// input, which is LINEAR working space and HalfFloat — so the shader writes
// linear floats directly and `uGain` above 1.0 is the thing being tested.
//
// Blending is One/One with the ALPHA channel left alone (Zero/One): the
// screen pass wrote full alpha and the composer's later passes read it, so an
// additive layer that also accumulated alpha would quietly change what the
// vignette and the knee see.
const CMP_ANCHOR = '        <SourceQuad sourceRef={sourceRef} trail={trail} stateRef={bgStateRef} />';
const CMP_MOUNT = `        <StrimerProbe />
`;
const CMP_DEF_ANCHOR = 'function SourceQuad({ sourceRef, trail, stateRef }) {';
const CMP_DEF = `// ── PROBE (_s2layer.mjs, throwaway — see that file's header) ──────────────
const STRIMER_FRAG = /* glsl */\`
  precision highp float;
  uniform vec2  uRes;    // CSS px, matching the plane's own size
  uniform vec2  uHead;   // packet head, CSS px, y-down
  uniform vec2  uTail;   // packet tail end, CSS px, y-down
  uniform float uGain;   // LINEAR peak; 0 disables the layer entirely
  uniform float uW;      // cross-section half-width in px
  uniform vec3  uNeon;   // the saturated tail colour, LINEAR
  varying vec2 vUv;

  void main() {
    if (uGain <= 0.0) discard;
    // PlaneGeometry uv is y-UP; every coordinate the draw loop publishes is
    // y-down canvas space. Flipping here rather than at the call site keeps
    // the uniforms in the one space the rest of this project speaks.
    vec2 p = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);

    vec2 pa = p - uHead, ba = uTail - uHead;
    float bb = max(dot(ba, ba), 1e-6);
    // h = 0 at the head, 1 at the tail end. Clamped, so the capsule gets
    // round caps rather than an infinite cylinder.
    float h = clamp(dot(pa, ba) / bb, 0.0, 1.0);
    float d = length(pa - ba * h);

    // Gaussian cross-section, the same exp(-2(d/w)^2) the edge shader's glow
    // uses, so the two read as the same family of light.
    float cross = exp(-2.0 * (d / max(uW, 1e-3)) * (d / max(uW, 1e-3)));
    // Aggressive falloff behind the head: the brief asks for a dense compact
    // packet, not a linear streak.
    float along = pow(1.0 - h, 2.5);
    // White at the head, neon behind it. This is forced, not a taste call:
    // the knee scales all three channels equally, so it can never whiten a
    // saturated colour — a white-hot head has to be authored white.
    vec3 col = mix(uNeon, vec3(1.0), pow(1.0 - h, 6.0));

    gl_FragColor = vec4(col * (uGain * along * cross), 0.0);
  }
\`;

function StrimerProbe() {
  const size = useThree(s => s.size);
  const matRef = useRef(null);
  const uniforms = useMemo(() => ({
    uRes:  { value: new THREE.Vector2(1, 1) },
    uHead: { value: new THREE.Vector2() },
    uTail: { value: new THREE.Vector2() },
    uGain: { value: 0 },
    uW:    { value: 3 },
    uNeon: { value: new THREE.Vector3(0.05, 0.8, 1.0) },
  }), []);

  useFrame(() => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uRes.value.set(size.width, size.height);
    const sp = typeof window !== 'undefined' ? window.__strimer : null;
    const live = sp && sp.ax != null && sp.u >= 0 && sp.u < 1;
    m.uniforms.uGain.value = live ? sp.gain : 0;
    if (!live) return;
    const hx = sp.ax + (sp.bx - sp.ax) * sp.u;
    const hy = sp.ay + (sp.by - sp.ay) * sp.u;
    const L = Math.hypot(sp.bx - sp.ax, sp.by - sp.ay) * (sp.packet ?? 0.17);
    const dx = sp.bx - sp.ax, dy = sp.by - sp.ay;
    const n = Math.max(Math.hypot(dx, dy), 1e-6);
    m.uniforms.uHead.value.set(hx, hy);
    m.uniforms.uTail.value.set(hx - dx / n * L, hy - dy / n * L);
    m.uniforms.uW.value = sp.w ?? 3;
  });

  return (
    <mesh frustumCulled={false} renderOrder={10}>
      <planeGeometry args={[size.width, size.height]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={COMPOSITE_VERT}
        fragmentShader={STRIMER_FRAG}
        depthTest={false}
        depthWrite={false}
        transparent
        blending={THREE.CustomBlending}
        blendSrc={THREE.OneFactor}
        blendDst={THREE.OneFactor}
        blendSrcAlpha={THREE.ZeroFactor}
        blendDstAlpha={THREE.OneFactor}
        toneMapped={false}
      />
    </mesh>
  );
}

`;

// ── Sampling, identical in method to _s1wake ──────────────────────────────
// The screenshot spans the WINDOW and the endpoints are in CANVAS px, so the
// canvas rect is read from the page rather than fitted afterwards. _s1wake's
// first run lost a whole pass to exactly that.
function profileAlong(png, ax, ay, bx, by, dpr, off, n = 80) {
  const { width, height, data } = png;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = Math.round((off.left + ax + (bx - ax) * t) * dpr);
    const y = Math.round((off.top + ay + (by - ay) * t) * dpr);
    let best = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const px = x + dx, py = y + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const o = (py * width + px) * 4;
        const l = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
        if (l > best) best = l;
      }
    }
    out[i] = best;
  }
  return out;
}

const RAMP = ' .:-=+*#%@';
const ascii = (p, bp) => p.map((v, i) => {
  const d = Math.max(0, v - (bp[i] ?? 0));
  return RAMP[Math.min(RAMP.length - 1, Math.round(d * (RAMP.length - 1) / 0.6))];
}).join('');

function describe(profile, baseline, frac = 0.25) {
  let pi = 0;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] - (baseline[i] ?? 0) > profile[pi] - (baseline[pi] ?? 0)) pi = i;
  }
  const lift = profile[pi] - (baseline[pi] ?? 0);
  let i = pi;
  while (i > 0 && (profile[i - 1] - (baseline[i - 1] ?? 0)) > lift * frac) i--;
  let j = pi;
  while (j < profile.length - 1 && (profile[j + 1] - (baseline[j + 1] ?? 0)) > lift * frac) j++;
  return {
    at: +(pi / (profile.length - 1)).toFixed(3),
    peak: +profile[pi].toFixed(4),
    lift: +lift.toFixed(4),
    // The SPAN of the packet, both sides of the peak, as a fraction of the
    // edge. This is the bead-vs-crack number: a disc gave ~0.01, a packet
    // that reads as a crack has to be near PACKET.
    span: +((j - i) / (profile.length - 1)).toFixed(3),
  };
}

// ── Run ────────────────────────────────────────────────────────────────────
const artOrig = await readFile(ART, 'utf8');
const cmpOrig = await readFile(CMP, 'utf8');
if (!artOrig.includes(ART_ANCHOR)) throw new Error('ArtTab anchor missing');
if (!cmpOrig.includes(CMP_ANCHOR)) throw new Error('SphereComposite mount anchor missing');
if (!cmpOrig.includes(CMP_DEF_ANCHOR)) throw new Error('SphereComposite def anchor missing');
if (artOrig.includes('__strimer') || cmpOrig.includes('__strimer')) {
  throw new Error('already patched — check git status');
}

mkdirSync(OUT, { recursive: true });
const report = { transitMs: TRANSIT_MS, packet: PACKET, runs: [] };

try {
  await writeFile(ART, artOrig.replace(ART_ANCHOR, ART_PATCH + ART_ANCHOR), 'utf8');
  await writeFile(CMP, cmpOrig
    .replace(CMP_DEF_ANCHOR, CMP_DEF + CMP_DEF_ANCHOR)
    .replace(CMP_ANCHOR, CMP_ANCHOR + '\n' + CMP_MOUNT.trimEnd()), 'utf8');
  console.log('patched', ART, 'and', CMP);

  for (const mode of MODES) {
    for (const gain of GAINS) {
      const tag = `${mode}-g${String(gain).replace('.', 'p')}`;
      const page = await launch({ url: URL, width: 1520, height: 900, dpr: 1, deterministic: true });
      try {
        await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
        await sleep(2500);
        if (!await page.eval(clickByText('/CHAOS'))) throw new Error('no /CHAOS nav button');
        await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
        await sleep(4000);
        await page.eval('window.__virtualize()');
        await sleep(150);
        await page.eval('window.__reseed(); window.__artHarnessReset();');
        await page.pump(240);
        await page.pump(30);

        if (mode === 'imm') {
          if (!await page.eval(CLICK_IMMERSIVE)) throw new Error('no immersive toggle');
          await page.screenshot({ path: `${OUT}/_settle-${tag}.png` });
          await sleep(400);
          await page.pump(1);
          await page.pump(749);
        } else {
          await page.pump(750);
        }

        const basePath = `${OUT}/${tag}-base.png`;
        await page.screenshot({ path: basePath });

        await page.eval(`window.__strimer = { aId: null, bId: null,`
          + ` t0: performance.now(), ms: ${TRANSIT_MS}, gain: ${gain},`
          + ` packet: ${PACKET}, w: 3 };`);

        const shots = [];
        for (let f = 0; f <= SHOT_FRAMES; f++) {
          await page.pump(1);
          const path = `${OUT}/${tag}-f${String(f).padStart(2, '0')}.png`;
          await page.screenshot({ path });
          const sp = JSON.parse(await page.eval(
            'JSON.stringify((({u,ax,ay,bx,by,aId,bId,len}) =>'
            + ' ({u,ax,ay,bx,by,aId,bId,len}))(window.__strimer))'));
          shots.push({ f, path, ...sp, u: +Number(sp.u).toFixed(4) });
        }

        const res = JSON.parse(await page.eval(
          'JSON.stringify((() => { const e = window.__artEdgeState();'
          + ' const c = ' + SPHERE + '; const r = c.getBoundingClientRect();'
          + ' return { innerW: window.innerWidth, left: r.left, top: r.top }; })())'));

        const errs = await page.consoleErrors();
        report.runs.push({ mode, gain, basePath, res, shots, errs: errs.slice(0, 3) });
        console.log(`${tag}: edge ${shots[0].aId}->${shots[0].bId}`
          + ` len ${Number(shots[0].len).toFixed(0)}px`
          + (errs.length ? `  CONSOLE ERRORS: ${errs.length}` : ''));
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await writeFile(ART, artOrig, 'utf8');
  await writeFile(CMP, cmpOrig, 'utf8');
  console.log('restored both files — run `git status` to confirm');
}

for (const run of report.runs) {
  const first = run.shots[0];
  const base = decodePng(await readFile(run.basePath));
  const dpr = base.width / run.res.innerW;
  const off = { left: run.res.left, top: run.res.top };
  run.dpr = dpr;
  const b = profileAlong(base, first.ax, first.ay, first.bx, first.by, dpr, off);
  for (const s of run.shots) {
    const png = decodePng(await readFile(s.path));
    const p = profileAlong(png, s.ax, s.ay, s.bx, s.by, dpr, off);
    Object.assign(s, describe(p, b));
    s.ascii = ascii(p, b);
  }
}

await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));

console.log('\n── THE NON-ACCUMULATING LAYER ─────────────────────────────');
console.log('u    packet position; >=1 means the shader DISCARDS, nothing drawn');
console.log('span width of the packet as a fraction of the edge (target '
  + PACKET + '; a disc gave ~0.01)');
console.log('THE ROWS AT u >= 1 ARE CLAIM 3: lift there must be ~0 in BOTH modes.');
for (const run of report.runs) {
  console.log(`\n${run.mode} gain=${run.gain}  (edge `
    + `${Number(run.shots[0].len).toFixed(0)}px, canvas `
    + `+${run.res.left.toFixed(0)},+${run.res.top.toFixed(0)})`
    + (run.errs?.length ? `  ERRORS: ${JSON.stringify(run.errs)}` : ''));
  console.log('   f  u       lift    peak     at   span');
  for (const s of run.shots) {
    console.log(`  ${String(s.f).padStart(2)}  ${String(s.u).padStart(6)}  `
      + `${String(s.lift).padStart(6)}  ${String(s.peak).padStart(6)}  `
      + `${String(s.at).padStart(5)}  ${String(s.span).padStart(5)}  |${s.ascii}|`);
  }
}
console.log('\nFrames in ' + OUT + ' — LOOK AT THEM, especially where the packet');
console.log('crosses a node: this layer is OVER the 2D canvas by construction.');

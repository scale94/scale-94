// _a15mesh.mjs — does any BASE EDGE terminate where no node disc is drawn?
//
// THIS EXISTS BECAUSE _a13prism.mjs AND _a12ortho.mjs SHARE A BLIND SPOT, and
// it is mine. Both took "where the nodes are" FROM THE BASE EDGE ENDPOINTS
// themselves, on the stated assumption that every base edge runs centre to
// centre. If an edge terminates in empty space, that phantom point is admitted
// into the reference set and every check against it passes vacuously. Neither
// instrument could ever have detected the defect it was pointed at.
//
// THE INDEPENDENT REFERENCE. Node discs are written into the SAME buffer with
// a NEGATIVE width (the sign is the disc/segment discriminator -- see
// SphereEdges.js's header), at instance index >= `discStart`. Their centres
// are produced by the node draw loop, not the edge loop, so they are a genuinely
// separate record of where a node is BEING DRAWN. An edge endpoint with no disc
// at it is an edge drawn to a node that is not on screen.
//
// Both loops read the same `proj[]`, so a match should be EXACT, not close.
//
// WHY A DISC CAN BE MISSING WHILE ITS EDGES ARE NOT. Two candidates, both
// visible in the source:
//   - `ArtTab.jsx` node loop: `const col = NODE_COLORS[n.id] ?? dynColorMap.get(n.id);
//     if (!col) continue;` -- the EDGE loop computes colA/colB the same way and
//     does NOT skip on them.
//   - every disc write is guarded by `eg.count < MAX_EDGES`, and discs are
//     written AFTER the edges, so a full buffer drops discs first.
// This script does not assume either; it reports the counts that tell them apart.
//
//   node scripts/_a15mesh.mjs [W] [H] [DPR] [PORT] [BRIDGES]
import { launch } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { decodePng } from './_png.mjs';

const W       = Number(process.argv[2] ?? 1520);
const H       = Number(process.argv[3] ?? 900);
const DPR     = Number(process.argv[4] ?? 1);
const PORT    = Number(process.argv[5] ?? 5173);
const BRIDGES = Number(process.argv[6] ?? 4);      // the reported state: 44 edges, 4 orthogonal
const URL     = `http://localhost:${PORT}/`;
const OUT     = 'lookbook/mesh';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SPHERE = '[...document.querySelectorAll("canvas")]' +
  '.filter(c => c.offsetParent && !c.closest("[data-art-composite]"))' +
  '.sort((a,b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]';
const SPHERE_READY = '(() => { const c = ' + SPHERE + '; return !!c && c.getBoundingClientRect().width > 700; })()';
const SPHERE_RECT = '(() => { const c = ' + SPHERE + '; const r = c.getBoundingClientRect();' +
  ' return { x: r.x, y: r.y, w: r.width, h: r.height }; })()';
const clickText = (t) => '(() => { const b = [...document.querySelectorAll("button")]' +
  '.find(e => (e.innerText || "").indexOf(' + JSON.stringify(t) + ') >= 0);' +
  ' if (!b) return false; b.click(); return true; })()';

// ax 0, ay 1, bx 2, by 3, packedAlpha 13, width 14, flags 15.
// unpackAlphas: a0 = packed%256, a1 = (packed/256)%256, a2 = packed/65536, /255.
const STATE_EXPR = `(() => {
  const s = window.__artEdgeState ? window.__artEdgeState() : null;
  if (!s) return JSON.stringify({ hook: false });
  const ST = s.stride, D = s.instances;
  const lines = [], discs = [];
  for (let i = 0; i < s.count; i++) {
    const o = i * ST;
    const w = D[o + 14];
    const p = D[o + 13];
    const a0 = Math.floor(p % 256) / 255;
    const a2 = Math.floor(p / 65536) / 255;
    if (w > 0) lines.push([D[o], D[o+1], D[o+2], D[o+3], w, a0, a2, D[o+15]]);
    else       discs.push([D[o], D[o+1], -w, a0, Math.floor((p / 256) % 256) / 255, a2, i]);
  }
  // The ADDITIVE stream too: prism chords, analogy filaments, chimera
  // fringes. Everything up to particleStart -- a particle streak's endpoints
  // are particle positions and are NOT supposed to be nodes.
  const A = s.additive, AI = A.instances;
  const addLines = [];
  const stop = A.particleStart > 0 ? A.particleStart : A.count;
  for (let i = 0; i < stop; i++) {
    const o = i * ST;
    if (AI[o + 14] <= 0) continue;
    addLines.push([AI[o], AI[o+1], AI[o+2], AI[o+3], AI[o+14], AI[o+15]]);
  }
  return JSON.stringify({ hook: true, w: s.w, h: s.h,
    count: s.count, discStart: s.discStart, worldCount: s.worldCount,
    rings: s.rings, lines, discs,
    addCount: A.count, addParticleStart: A.particleStart, addDropped: A.dropped, addLines });
})()`;

const HUD = '(() => { const e = [...document.querySelectorAll("*")]' +
  '.find(n => n.children.length === 0 && /\\d+ nodes/.test(n.textContent || ""));' +
  ' return e ? e.textContent.trim() : ""; })()';

const page = await launch({ url: URL, width: W, height: H, dpr: DPR, deterministic: true });
try {
  await page.waitFor('document.querySelectorAll("canvas").length > 0', { label: 'boot canvas' });
  await sleep(2200);
  if (!await page.eval(clickText('/CHAOS'))) throw new Error('no /CHAOS nav button');
  await page.waitFor(SPHERE_READY, { label: 'sphere', timeoutMs: 40000 });
  await sleep(3500);
  await page.eval('window.__virtualize && window.__virtualize()');
  await sleep(150);
  await page.eval('window.__reseed && window.__reseed(); window.__artHarnessReset && window.__artHarnessReset();');
  await page.pump(240);

  const rect = JSON.parse(await page.eval('JSON.stringify(' + SPHERE_RECT + ')'));

  // Forge orthogonal bridges through the REAL right-click path, as the
  // reported screenshot had (44 edges / 4 orthogonal). _a12ortho.mjs's note
  // applies: __artSetOrthogonal only re-flags existing edges and cannot
  // choose a target, so only the real forge reproduces the reported state.
  let forged = 0;
  const step = 26;
  outer:
  for (let y = rect.y + 40; y < rect.y + rect.h - 40; y += step) {
    for (let x = rect.x + 40; x < rect.x + rect.w - 40; x += step) {
      if (forged >= BRIDGES) break outer;
      const before = JSON.parse(await page.eval(STATE_EXPR)).lines.length;
      await page.rightClick(x, y);
      await sleep(110);
      await page.pump(3);
      const afterN = JSON.parse(await page.eval(STATE_EXPR)).lines.length;
      if (afterN > before) forged++;
    }
  }
  await page.pump(30);
  await page.mouse('mouseMoved', rect.x + 6, rect.y + 6);   // cursor off every node
  await page.pump(3);

  const s = JSON.parse(await page.eval(STATE_EXPR));
  if (!s.hook) throw new Error('__artEdgeState missing');
  const hud = await page.eval(HUD);

  mkdirSync(OUT, { recursive: true });
  const shotPlain = await page.screenshot();
  writeFileSync(`${OUT}/mesh.png`, shotPlain);

  console.log(`HUD: ${hud}`);
  console.log(`forged ${forged} bridge(s) via right-click`);
  console.log(`buffer ${s.w}x${s.h}  count ${s.count}  discStart ${s.discStart}`
    + `  worldCount ${s.worldCount}  rings ${s.rings}`);
  console.log(`lines (width > 0): ${s.lines.length}   discs (width < 0): ${s.discs.length}`);

  // Distinct disc CENTRES -- halo and core share one, so 31 nodes give ~31.
  const centres = [];
  // ALL THREE STOPS, not just a0.
  //
  // a0 is the CENTRE stop, and for a node core that is `lensStops().center` --
  // deliberately the most transparent of the three (LENS_CENTER_K), because
  // the core is a radial ramp with a transparent middle. Reading a0 alone and
  // calling it "the node's alpha" understates every core in the scene, and a
  // first pass here reported 0.024 as if it were the node's visibility. The
  // halo's a0 is its real flat alpha; the core's peak is at its RIM.
  for (const [x, y, r, a0, a1, a2] of s.discs) {
    const peak = Math.max(a0, a1, a2);
    let hit = null;
    for (const c of centres) if (Math.hypot(c.x - x, c.y - y) < 1.0) { hit = c; break; }
    if (hit) { hit.n++; hit.maxR = Math.max(hit.maxR, r); hit.maxA = Math.max(hit.maxA, peak); }
    else centres.push({ x, y, n: 1, maxR: r, maxA: peak });
  }
  console.log(`distinct disc centres: ${centres.length}  (the app reports 31 nodes)`);

  // THE TEST. Every line endpoint must have a disc on it.
  const near = (x, y) => {
    let best = null, bd = Infinity;
    for (const c of centres) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
    return { best, d: bd };
  };
  const TOL = 1.0;    // both loops read the same proj[]; a match should be exact
  const orphanEnd = new Map();
  for (const [ax, ay, bx, by, w] of s.lines) {
    for (const [x, y] of [[ax, ay], [bx, by]]) {
      const { d } = near(x, y);
      if (d <= TOL) continue;
      const k = Math.round(x) + ',' + Math.round(y);
      const e = orphanEnd.get(k);
      if (e) { e.n++; e.wMax = Math.max(e.wMax, w); }
      else orphanEnd.set(k, { x, y, n: 1, wMax: w, d });
    }
  }
  const orphans = [...orphanEnd.values()].sort((a, b) => b.n - a.n);

  console.log('');
  if (orphans.length) {
    console.log('LINE ENDPOINTS WITH NO NODE DISC ON THEM');
    console.log('  position            edges  widest  nearest disc');
    for (const o of orphans) {
      console.log(`  (${o.x.toFixed(1).padStart(7)},${o.y.toFixed(1).padStart(6)})  ${String(o.n).padStart(5)}`
        + `  ${o.wMax.toFixed(2).padStart(6)}  ${o.d.toFixed(1)}px away`);
    }
  }

  // ── THE ADDITIVE STREAM, CHAINED INTO POLYLINES ──────────────────────────
  //
  // A tessellated chord's INTERIOR joints are not nodes and must not count
  // against the layer. writePolyline guarantees segment i's (bx,by) IS segment
  // i+1's (ax,ay) as the identical float, so runs chain exactly -- no
  // tolerance, no guessing. Only a run's two ENDS are termini.
  const runs = [];
  let cur = null;
  for (const [ax, ay, bx, by, w, fl] of s.addLines) {
    if (cur && cur.ex === ax && cur.ey === ay && cur.fl === fl) {
      cur.ex = bx; cur.ey = by; cur.n++;
    } else {
      if (cur) runs.push(cur);
      cur = { sx: ax, sy: ay, ex: bx, ey: by, n: 1, fl, w };
    }
  }
  if (cur) runs.push(cur);

  const addOrphan = new Map();
  for (const r of runs) {
    for (const [x, y] of [[r.sx, r.sy], [r.ex, r.ey]]) {
      const { d } = near(x, y);
      if (d <= TOL) continue;
      // NO sphere-centre exemption. It used to skip `(w/2, h/2)` as "the prism
      // spoke hub" -- which WAS the reported phantom vertex: the star spokes
      // ran to a point where no node is drawn, and this line certified it.
      // The spokes radiate from the clicked node since 2026-09-23, so every
      // additive run must now end on a disc, with no exceptions.
      const k = Math.round(x) + ',' + Math.round(y);
      const e = addOrphan.get(k);
      if (e) e.n++; else addOrphan.set(k, { x, y, n: 1, fl: r.fl, d });
    }
  }
  const addOrphans = [...addOrphan.values()].sort((a, b) => b.n - a.n);
  console.log('');
  console.log(`additive stream: count ${s.addCount}, particleStart ${s.addParticleStart},`
    + ` dropped ${s.addDropped} -> ${s.addLines.length} line instances in ${runs.length} polyline run(s)`);
  if (addOrphans.length) {
    console.log('ADDITIVE POLYLINE ENDS WITH NO NODE DISC ON THEM');
    for (const o of addOrphans.slice(0, 12)) {
      console.log(`  (${o.x.toFixed(1).padStart(7)},${o.y.toFixed(1).padStart(6)})  runs ${String(o.n).padStart(4)}`
        + `  flags ${o.fl}  nearest disc ${o.d.toFixed(1)}px`);
    }
  } else {
    console.log('every additive polyline run ends on a drawn disc or the sphere centre.');
  }

  // ── ORTHO BRIDGE ENDPOINTS vs THE DISCS THEY LAND ON ─────────────────────
  //
  // isOrtho is bit 7 of the flags' glow byte (floor(flags / 65536) >= 128),
  // the same decode _a12ortho.mjs uses. The bridge's SHADOW is drawn with
  // `shadowAlpha = mix(fuseCos * 0.6, 1.0, vIsOrtho)` -- SphereEdges.js's
  // SHADOW_SRC_OVER, "Ortho: always 1.0 (fully opaque)". That is a constant,
  // with NO depth term, on a 6-14px glow. This prints what the node disc
  // underneath it is drawn at, so the two can be compared directly.
  const orthoLines = s.lines.filter(l => Math.floor(l[7] / 65536) >= 128);
  console.log('');
  console.log(`ORTHO BRIDGES: ${orthoLines.length} instance(s). Bridge glow alpha is a CONSTANT 1.0.`);
  console.log('  endpoint             disc peak alpha  disc maxR   ortho stroke alpha');
  const seen = new Set();
  for (const l of orthoLines) {
    for (const [x, y, ea] of [[l[0], l[1], l[5]], [l[2], l[3], l[6]]]) {
      const k = Math.round(x) + ',' + Math.round(y);
      if (seen.has(k)) continue;
      seen.add(k);
      const { best, d } = near(x, y);
      if (!best) { console.log(`  (${x.toFixed(1)},${y.toFixed(1)})  NO DISC (${d.toFixed(1)}px)`); continue; }
      console.log(`  (${x.toFixed(1).padStart(7)},${y.toFixed(1).padStart(6)})`
        + `  ${best.maxA.toFixed(3).padStart(12)}  ${best.maxR.toFixed(1).padStart(8)}px`
        + `  ${ea.toFixed(3).padStart(10)}`);
    }
  }
  const allA = centres.map(c => c.maxA).sort((a, b) => a - b);
  console.log(`  disc alpha across all ${centres.length} nodes: min ${allA[0].toFixed(3)},`
    + ` median ${allA[Math.floor(allA.length / 2)].toFixed(3)}, max ${allA[allA.length - 1].toFixed(3)}`);

  // The dimmest discs that DO exist -- the other way a node goes invisible.
  const byAlpha = [...centres].sort((a, b) => a.maxA - b.maxA).slice(0, 5);
  console.log('');
  console.log('FIVE FAINTEST NODES, by PEAK stop of any disc they draw (alpha quantised to 1/255)');
  for (const c of byAlpha) {
    console.log(`  (${c.x.toFixed(1).padStart(7)},${c.y.toFixed(1).padStart(6)})`
      + `  peakAlpha ${c.maxA.toFixed(3)}  maxR ${c.maxR.toFixed(1)}px  instances ${c.n}`);
  }

  // ── WHAT THE EYE ACTUALLY GETS ───────────────────────────────────────────
  //
  // Alpha algebra is not the answer here and nearly became one: the glow peak
  // is `shadowAlpha * a * ...` (SphereEdges.js:1465), so the ortho shadow's
  // constant 1.0 is only ONE factor and `a` still carries depth. What settles
  // it is the rendered pixels. Peak/mean luminance in a 22x22 patch centred on
  // each ortho endpoint, and on the brightest node in the scene for scale.
  {
    const img = decodePng(shotPlain);
    const lum = (x, y) => {
      const o = (y * img.width + x) * 4;
      return 0.2126 * img.data[o] + 0.7152 * img.data[o + 1] + 0.0722 * img.data[o + 2];
    };
    const patch = (bx, by) => {
      const px = rect.x + bx * (rect.w / s.w), py = rect.y + by * (rect.h / s.h);
      let peak = 0, sum = 0, n = 0;
      for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
        const x = Math.round(px + dx), y = Math.round(py + dy);
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
        const v = lum(x, y); peak = Math.max(peak, v); sum += v; n++;
      }
      return { peak, mean: sum / n };
    };
    // A point on the bridge, 25% of the way in from the faint end: the wire
    // itself, away from the node it lands on.
    console.log('');
    console.log('RENDERED LUMINANCE — the bridge vs the node it lands on');
    console.log('  endpoint                discAlpha   node patch peak/mean   wire@25% peak/mean');
    for (const l of orthoLines) {
      for (const [x, y, ox, oy] of [[l[0], l[1], l[2], l[3]], [l[2], l[3], l[0], l[1]]]) {
        const { best } = near(x, y);
        if (!best || best.maxA > 0.20) continue;         // only the faint ends
        const nd = patch(x, y);
        const wr = patch(x + (ox - x) * 0.25, y + (oy - y) * 0.25);
        console.log(`  (${x.toFixed(1).padStart(7)},${y.toFixed(1).padStart(6)})`
          + `  ${best.maxA.toFixed(3).padStart(9)}`
          + `  ${nd.peak.toFixed(1).padStart(8)} / ${nd.mean.toFixed(1).padStart(6)}`
          + `     ${wr.peak.toFixed(1).padStart(7)} / ${wr.mean.toFixed(1).padStart(6)}`);
      }
    }
    const bright = [...centres].sort((a, b) => b.maxA - a.maxA)[0];
    const bp = patch(bright.x, bright.y);
    console.log(`  brightest node in scene, alpha ${bright.maxA.toFixed(3)}:`
      + ` patch peak ${bp.peak.toFixed(1)} / mean ${bp.mean.toFixed(1)}`);
  }

  // ── ANNOTATED FRAME ──────────────────────────────────────────────────────
  //
  // The numbers above say every line end has a disc. This draws the MEASURED
  // disc centres straight onto the live page so the claim can be checked by
  // eye instead of taken on trust: if a convergence the eye reads as a vertex
  // has no ring on it, it is not a terminus at all.
  const ringJs = '(() => {'
    + ' const c = ' + SPHERE + ';'
    + ' const r = c.getBoundingClientRect();'
    + ' let ov = document.getElementById("__ovl");'
    + ' if (!ov) { ov = document.createElement("canvas"); ov.id = "__ovl";'
    + '   document.body.appendChild(ov); }'
    + ' ov.width = Math.round(r.width); ov.height = Math.round(r.height);'
    + ' ov.style.cssText = "position:absolute;pointer-events:none;z-index:9999;left:"'
    + '   + (r.x + window.scrollX) + "px;top:" + (r.y + window.scrollY) + "px;width:"'
    + '   + r.width + "px;height:" + r.height + "px";'
    + ' const g = ov.getContext("2d");'
    + ' g.clearRect(0, 0, ov.width, ov.height);'
    + ' const pts = ' + JSON.stringify(centres.map(c => [+c.x.toFixed(2), +c.y.toFixed(2)])) + ';'
    + ' const kx = r.width / ' + s.w + ', ky = r.height / ' + s.h + ';'
    + ' g.strokeStyle = "#00ff66"; g.lineWidth = 1.5;'
    + ' for (const [x, y] of pts) {'
    + '   g.beginPath(); g.arc(x * kx, y * ky, 13, 0, 6.2832); g.stroke(); }'
    + ' return pts.length; })()';
  const rings = await page.eval(ringJs);
  writeFileSync(`${OUT}/mesh-annotated.png`, await page.screenshot());
  console.log('');
  console.log(`annotated frame written with ${rings} measured disc centres ringed:`);
  console.log(`  ${OUT}/mesh-annotated.png`);

  console.log('');
  if (orphans.length || addOrphans.length) {
    const three = orphans.filter(o => o.n >= 3);
    console.log(`VERDICT: ${orphans.length} line endpoint(s) have NO node disc drawn on them`
      + (three.length ? `, ${three.length} of them shared by 3+ edges` : ''));
    console.log('measured against the DISC stream, which the edge loop does not write.');
    console.log('Edges are being drawn to nodes that are not being rendered.');
    process.exitCode = 1;
  } else {
    console.log(`VERDICT: all ${s.lines.length * 2} line endpoints land on a drawn disc`);
    console.log(`within ${TOL}px, measured against an INDEPENDENT reference.`);
    console.log('No edge terminates in empty space.');
  }
} finally {
  await page.close();
}

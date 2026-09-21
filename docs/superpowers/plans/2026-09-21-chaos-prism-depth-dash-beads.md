# CHAOS prism depth, root taper and dash beads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the prism fan a depth-obeying object that converges cleanly onto node discs, and turn the orthogonal bridges' hard dash chips into antialiased luminous beads.

**Architecture:** One new mechanism — per-segment alpha on an already-tessellated polyline — serves both the depth cue and the root taper, because `edgeFrag` already interpolates a three-stop alpha along every segment and the chord is already 24 instances. The two shader changes share one signed-distance-to-dash value: it antialiases the core cut and feeds the bead's gaussian.

**Tech Stack:** JavaScript (ES modules), React, three.js, raw GLSL in template strings, vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-21-chaos-prism-depth-dash-beads-design.md`

## Global Constraints

- **`EDGE_STRIDE` STAYS 18.** No task may widen the instance layout.
- **Do not merge. Do not push.** Verification approval is not push consent.
- **Never run vitest with `-u` / `--update`.**
- Each task commits **only its own named files**. Never `git add -A`.
- **The bloom dial is off limits**: `BLOOM.intensity`, `BLOOM.levels`, `BLOOM.luminanceThreshold`, `KNEE.knee`. If a measurement says bloom moved, report the numbers; do not turn a dial.
- **Never edit tracked source while an `artBaseline` / `artCompare` capture is running.** Vite HMRs the edit into the page and corrupts the set; the tell is two different `gitCommit` stamps across manifests.
- **Never `git checkout -- <file>` to undo a temporary patch.** It restores to the last *commit*, not to pre-patch bytes. Hold original bytes in memory (see `scripts/_a9lens.mjs`).
- Test idiom, from `artNodes.test.js`'s own header: **every expectation is the LITERAL arithmetic, never a call to the function under test.** A test that recomputes its expectation with the implementation proves only determinism.
- **Vacuous-test rule.** This project has been bitten three times by a test that passed with the mechanism deleted. Every task below that adds a law has a **liveness assertion** — a case whose expected value is only reachable if the mechanism is live. Each task's report must state that the mechanism was temporarily deleted and the named test was confirmed to FAIL.

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/terminal/art/SphereEdges.js` | instance encoding, `writePolyline`, GLSL | 1, 4, 5 |
| `src/terminal/art/artEdges.js` | edge/prism laws (pure) | 2, 3 |
| `src/terminal/art/artNodes.js` | node laws — **read only**, source of `depthCueAlpha` | — |
| `src/terminal/views/ArtTab.jsx` | the draw loop; prism block at 1729–1855 | 1, 2, 3 |
| `src/terminal/art/__tests__/artEdges.test.js` | tests for all of the above | 1, 2, 3, 4, 5 |
| `scripts/_a10dash.mjs` | same-build A/B ink measurement | 6 |

---

### Task 1: Per-segment alpha plumbing (provably a no-op)

**Files:**
- Modify: `src/terminal/art/SphereEdges.js:780-809` (`writePolyline`)
- Modify: `src/terminal/views/ArtTab.jsx:508-516` (scratch allocation)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: `packAlphas(a0, a1, a2)`, `createEdgeState(cap)`, `EDGE_STRIDE`, `EDGE_OFF` — all already exported from `SphereEdges.js`.
- Produces: `writePolyline(state, pts, m, rgb, alpha, width, flags, phase0 = 0, alphas = null)`. When `alphas` is a `Float32Array` of length ≥ `m`, it holds **per-POINT** alphas and segment `i` packs `packAlphas(alphas[i], (alphas[i] + alphas[i+1]) * 0.5, alphas[i+1])`. When `null`, behaviour is byte-identical to today. Tasks 2 and 3 fill this array.

- [ ] **Step 1: Write the failing tests**

Add to `src/terminal/art/__tests__/artEdges.test.js`, inside the existing `describe('writePolyline', ...)` block (it already defines `RGB` and `PTS` at its top):

```js
  it('with alphas = null packs the scalar alpha into all three stops', () => {
    const s = createEdgeState(16);
    writePolyline(s, PTS, 4, RGB, 0.5, 1.2, 0);
    // LITERAL arithmetic, not a call to packAlphas-under-test: 0.5*255 = 127.5
    // which Math.round takes to 128, in all three bytes.
    const expected = 128 + 128 * 256 + 128 * 65536;
    for (let i = 0; i < 3; i++) {
      expect(s.data[i * EDGE_STRIDE + EDGE_OFF.alphas]).toBe(expected);
    }
  });

  it('a CONSTANT alphas array reproduces the scalar path byte for byte', () => {
    const a = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const scalar = createEdgeState(16);
    const ramped = createEdgeState(16);
    writePolyline(scalar, PTS, 4, RGB, 0.5, 1.2, 0);
    writePolyline(ramped, PTS, 4, RGB, 0.5, 1.2, 0, 0, a);
    expect(ramped.count).toBe(scalar.count);
    for (let i = 0; i < scalar.count * EDGE_STRIDE; i++) {
      expect(ramped.data[i]).toBe(scalar.data[i]);
    }
  });

  // LIVENESS. The constant-array test above passes trivially if `alphas` is
  // ignored entirely -- that is exactly the vacuous shape that has bitten this
  // project three times. This case is only reachable if the ramp is live.
  it('ramps per point, sharing each joint stop between adjacent segments', () => {
    const s = createEdgeState(16);
    const a = new Float32Array([0.0, 0.25, 0.75, 1.0]);
    writePolyline(s, PTS, 4, RGB, 0.5, 1.2, 0, 0, a);

    // Segment 0: stops 0.0 / 0.125 / 0.25 -> bytes 0 / 32 / 64.
    //   round(0*255)=0, round(0.125*255)=round(31.875)=32, round(0.25*255)=round(63.75)=64
    expect(s.data[0 * EDGE_STRIDE + EDGE_OFF.alphas]).toBe(0 + 32 * 256 + 64 * 65536);
    // Segment 1: stops 0.25 / 0.5 / 0.75 -> 64 / 128 / 191.
    //   round(0.5*255)=round(127.5)=128, round(0.75*255)=round(191.25)=191
    expect(s.data[1 * EDGE_STRIDE + EDGE_OFF.alphas]).toBe(64 + 128 * 256 + 191 * 65536);
    // Segment 2: stops 0.75 / 0.875 / 1.0 -> 191 / 223 / 255.
    //   round(0.875*255)=round(223.125)=223
    expect(s.data[2 * EDGE_STRIDE + EDGE_OFF.alphas]).toBe(191 + 223 * 256 + 255 * 65536);

    // The joint property, stated directly: segment i's END stop is segment
    // i+1's START stop. Under `lighter` a mismatch beads at every joint.
    for (let i = 0; i + 1 < 3; i++) {
      const endI   = Math.floor(s.data[i * EDGE_STRIDE + EDGE_OFF.alphas] / 65536);
      const startJ = (s.data[(i + 1) * EDGE_STRIDE + EDGE_OFF.alphas]) % 256;
      expect(endI).toBe(startJ);
    }
  });

  it('the ramped path still writes the same geometry, width and flags', () => {
    const a = new Float32Array([0.1, 0.4, 0.6, 0.9]);
    const s = createEdgeState(16);
    writePolyline(s, PTS, 4, RGB, 0.5, 1.25, 7, 0, a);
    for (let i = 0; i < 3; i++) {
      const o = i * EDGE_STRIDE;
      expect(s.data[o + EDGE_OFF.ax]).toBe(PTS[i * 2]);
      expect(s.data[o + EDGE_OFF.by]).toBe(PTS[i * 2 + 3]);
      expect(s.data[o + EDGE_OFF.width]).toBe(1.25);
      expect(s.data[o + EDGE_OFF.flags]).toBe(7);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "ramps per point"
```

Expected: FAIL. The 9th argument is ignored today, so every segment carries `packAlphas(0.5,0.5,0.5)` and the first assertion reports the received value `128 + 128*256 + 128*65536` against the expected `0 + 32*256 + 64*65536`.

- [ ] **Step 3: Implement**

In `src/terminal/art/SphereEdges.js`, replace `writePolyline` (currently lines 780–809) with:

```js
export function writePolyline(state, pts, m, rgb, alpha, width, flags,
                              phase0 = 0, alphas = null) {
  const cap = edgeCapacity(state);
  const data = state.data;
  // Hoisted for the scalar path exactly as before -- ONE packAlphas call for
  // the whole polyline. The ramped path cannot hoist it and pays per segment,
  // which is the only reason this is a branch rather than an unconditional
  // rewrite: the prism writes ~74000 instances in its worst frame.
  const packed = alphas === null ? packAlphas(alpha, alpha, alpha) : 0;
  let written = 0;
  let phase = phase0;
  for (let i = 0; i + 1 < m; i++) {
    if (state.count >= cap) { state.dropped += (m - 1) - i; break; }
    const o = state.count * EDGE_STRIDE;
    data[o]     = pts[i * 2];
    data[o + 1] = pts[i * 2 + 1];
    data[o + 2] = pts[i * 2 + 2];
    data[o + 3] = pts[i * 2 + 3];
    data[o + 4]  = rgb[0]; data[o + 5]  = rgb[1]; data[o + 6]  = rgb[2];
    data[o + 7]  = rgb[0]; data[o + 8]  = rgb[1]; data[o + 9]  = rgb[2];
    data[o + 10] = rgb[0]; data[o + 11] = rgb[1]; data[o + 12] = rgb[2];
    // PER-POINT alphas. Segment i's END stop is segment i+1's START stop BY
    // CONSTRUCTION, so the ramp is C0 across every joint -- the same discipline
    // the dash phase uses, and for the same reason: under `lighter` a
    // discontinuity at a joint beads, and 24 of them read as a staircase.
    data[o + 13] = alphas === null
      ? packed
      : packAlphas(alphas[i], (alphas[i] + alphas[i + 1]) * 0.5, alphas[i + 1]);
    data[o + 14] = width;
    data[o + 15] = flags;
    data[o + 16] = phase;
    // Float 17 is the disc shadow colour. A segment has none, and the buffer is
    // reused frame to frame, so leaving it would hand the next instance to land
    // here a stale colour.
    data[o + 17] = 0;
    phase += Math.hypot(pts[i * 2 + 2] - pts[i * 2], pts[i * 2 + 3] - pts[i * 2 + 1]);
    state.count++;
    written++;
  }
  return written;
}
```

Update the JSDoc directly above it to document the 9th parameter, the per-point contract, and the C0 joint property.

- [ ] **Step 4: Add the scratch buffer**

In `src/terminal/views/ArtTab.jsx`, directly after the `prismRgbRef` block (currently lines 515–516), add:

```jsx
  // Per-point alpha for a tessellated chord: the depth cue (task 2) times the
  // root taper (task 3). One slot per POINT, so it is one longer than the
  // segment count. Allocated once for the same reason the point list is -- a
  // full-strength frame runs the prism inner loop ~74000 times.
  const prismAlphaRef = useRef(null);
  if (prismAlphaRef.current === null) prismAlphaRef.current = new Float32Array(CURVE_MAX_SEGMENTS + 1);
```

`CURVE_MAX_SEGMENTS` is already imported in this file (it sizes `prismPtsRef`). Do not add a second import.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js
```

Expected: PASS, all tests in the file.

- [ ] **Step 6: Prove the liveness test is not vacuous**

Temporarily change the implementation's alpha line to ignore the ramp:

```js
    data[o + 13] = packAlphas(alpha, alpha, alpha);
```

Run:

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "ramps per point"
```

Expected: **FAIL**. Then restore the correct line **by editing it back by hand** — not with `git checkout`, which would also discard Step 4. Re-run the full file and confirm PASS. **State in the task report that this was done and that the test failed.**

- [ ] **Step 7: Run the full suite and lint**

```bash
npx vitest run
```

Expected: all tests pass, file count 121 or higher, 0 failures.

```bash
npm run lint
```

Expected: `0 errors`. Warnings may be 146 or a little higher; errors must be 0. **Read the printed error COUNT** — a piped lint has masked a broken gate on this project before.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/art/SphereEdges.js src/terminal/views/ArtTab.jsx src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): per-segment alpha on a tessellated polyline"
```

---

### Task 2: Depth cue on the prism

**Files:**
- Modify: `src/terminal/art/artEdges.js` (append near the other `PRISM_*` helpers, after `prismControl`)
- Modify: `src/terminal/views/ArtTab.jsx:1729-1855` (the prism block)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: `writePolyline(..., alphas)` from Task 1; `depthCueAlpha(depth)` and `DEPTH_ALPHA_FLOOR` from `artNodes.js`.
- Produces: `prismChordCue(depthA, depthB, t) -> number`, the envelope multiplier at arc-length fraction `t` along a chord.

**Note on the new import:** `artEdges.js` currently has **zero** imports and `artNodes.js` also has zero. Adding `artEdges.js -> artNodes.js` is a single directed edge with no cycle. Do **not** copy the cue formula into `artEdges.js`; this file's own header records that it "already lost a task to two implementations of one dash pattern."

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `src/terminal/art/__tests__/artEdges.test.js`:

```js
describe('prismChordCue', () => {
  it('returns each end node OWN depth cue at t = 0 and t = 1', () => {
    // The whole point of the change: the chord's end must match the disc it
    // lands on. depthCueAlpha(d) = max(0.08, (d+1)*0.5).
    expect(prismChordCue(-1, 1, 0)).toBeCloseTo(0.08, 7);   // max(0.08, 0.0)
    expect(prismChordCue(-1, 1, 1)).toBeCloseTo(1.0,  7);   // max(0.08, 1.0)
    expect(prismChordCue(0.2, -0.4, 0)).toBeCloseTo(0.6, 7); // (0.2+1)*0.5
    expect(prismChordCue(0.2, -0.4, 1)).toBeCloseTo(0.3, 7); // (-0.4+1)*0.5
  });

  // LIVENESS. This value is reachable ONLY if the function interpolates the
  // CUES. Interpolating the DEPTHS first and cueing after gives
  // depthCueAlpha(0) = 0.5, because the 0.08 floor clamps one endpoint and a
  // clamp does not commute with a lerp. If someone "simplifies" this to
  // depthCueAlpha((dA+dB)/2) this test is what catches it.
  it('interpolates the CUES, not the depths -- 0.54 at the midpoint, never 0.50', () => {
    expect(prismChordCue(-1, 1, 0.5)).toBeCloseTo(0.54, 7);  // (0.08 + 1.0) / 2
    expect(prismChordCue(-1, 1, 0.5)).not.toBeCloseTo(0.5, 3);
  });

  it('is linear in t between the two cues', () => {
    // Literal arithmetic: cues are 0.08 and 1.0, so the value at t is
    // 0.08 + 0.92t.
    expect(prismChordCue(-1, 1, 0.25)).toBeCloseTo(0.31, 7);
    expect(prismChordCue(-1, 1, 0.75)).toBeCloseTo(0.77, 7);
  });

  it('never returns less than the floor either end can reach', () => {
    for (const t of [0, 0.3, 0.5, 0.9, 1]) {
      expect(prismChordCue(-1, -1, t)).toBeCloseTo(DEPTH_ALPHA_FLOOR, 7);
    }
  });
});
```

Add `prismChordCue` to the existing `from '../artEdges'` import list (line 13–28) and `DEPTH_ALPHA_FLOOR` to a new `import { DEPTH_ALPHA_FLOOR } from '../artNodes';` line.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "prismChordCue"
```

Expected: FAIL with `prismChordCue is not a function`.

- [ ] **Step 3: Implement**

At the top of `src/terminal/art/artEdges.js`, add the file's first import:

```js
// artEdges.js's only import. artNodes.js imports nothing, so this is a single
// directed edge and not a cycle. The cue law lives there because the NODE
// DISCS use it, and a chord's end has to agree with the disc it lands on --
// which is the entire point of prismChordCue. Copying the formula here would
// be the second implementation this file's header warns about.
import { depthCueAlpha } from './artNodes.js';
```

Then, after `prismControl`, add:

```js
/**
 * The prism envelope's depth multiplier at arc-length fraction `t` along a
 * chord running from a node at `depthA` to one at `depthB`.
 *
 * THE PRISM WAS THE ONLY LAYER ON THE SPHERE WITH NO DEPTH TERM. Base edges
 * fade on avgDepth, node discs on depthCueAlpha, analogy filaments on
 * avgDepth; the prism drew at full envelope alpha wherever its endpoints sat
 * in Z. So a chord whose destination was on the far side arrived at FULL
 * brightness onto a disc cued down toward its 0.08 floor -- energy delivered
 * where nothing visible was receiving it.
 *
 * TWO DECISIONS THAT WILL LOOK ARBITRARY:
 *
 * `t` is ARC LENGTH fraction, not the Bezier parameter. They differ on a bowed
 * chord, and arc length is the one that matches what the eye reads as distance
 * travelled.
 *
 * This interpolates the CUES, not the depths. depthCueAlpha clamps at
 * DEPTH_ALPHA_FLOOR, and a clamp does not commute with a lerp: for a chord
 * from depth -1 to depth +1, interpolating cues gives 0.54 at the midpoint
 * while cueing an interpolated depth gives 0.50. Interpolating the cues is
 * what guarantees each END equals the cue of the disc it lands on, exactly.
 */
export function prismChordCue(depthA, depthB, t) {
  const cA = depthCueAlpha(depthA);
  const cB = depthCueAlpha(depthB);
  return cA + (cB - cA) * t;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "prismChordCue"
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Wire it into the prism block**

In `src/terminal/views/ArtTab.jsx`:

Add `prismChordCue` to the existing `from '../art/artEdges'` import list (near line 99–103) and `depthCueAlpha` to the `artNodes` import list if it is not already there (it is used at line 1897, so it should be).

Replace the `chord` and `straight` helpers (currently lines 1757–1764) with:

```jsx
        // A polyline of `m` points, then the same for one straight segment.
        // The alphas the 2D code quantised with `.toFixed(3)` are quantised to
        // 1/255 by packAlphas instead, which is the coarser step and therefore
        // the dominant one -- the same call made for the resonance edge above.
        // Every prism width -- glow, core, polygon, spoke -- is a bare
        // screen-px constant; not one of them rides the projection. So
        // `ink` is applied HERE, once, instead of at the four call sites.
        //
        // `cueA`/`cueB` are the DEPTH CUES of the two endpoint nodes. The
        // per-point alpha is filled by arc length so the chord arrives at each
        // end matching the disc it lands on. Arc length is accumulated over the
        // SAME point list writePolyline walks, so the two cannot drift.
        const chord = (m, a, width, cueA, cueB) => {
          const al = prismAlphaRef.current;
          let total = 0;
          for (let i = 0; i + 1 < m; i++) {
            total += Math.hypot(pts[i * 2 + 2] - pts[i * 2],
                                pts[i * 2 + 3] - pts[i * 2 + 1]);
          }
          let s = 0;
          for (let i = 0; i < m; i++) {
            if (i > 0) {
              s += Math.hypot(pts[i * 2] - pts[i * 2 - 2],
                              pts[i * 2 + 1] - pts[i * 2 - 1]);
            }
            const t = total > 1e-6 ? s / total : 0;
            al[i] = a * (cueA + (cueB - cueA) * t);
          }
          return writePolyline(ag, pts, m, rgb, a, width * ink, PRISM_FLAGS, 0, al);
        };
        const straight = (x0, y0, x1, y1, a, width, cueA, cueB) => {
          pts[0] = x0; pts[1] = y0; pts[2] = x1; pts[3] = y1;
          const al = prismAlphaRef.current;
          al[0] = a * cueA; al[1] = a * cueB;
          return writePolyline(ag, pts, 2, rgb, a, width * ink, PRISM_FLAGS, 0, al);
        };
```

**Note on `cueA + (cueB - cueA) * t` being inlined here rather than calling `prismChordCue`:** the call site already holds the two cues (computed once per chord, not once per point), so calling `prismChordCue(depthA, depthB, t)` per point would re-run `depthCueAlpha` twice per point — up to 148,000 extra calls in a worst-case frame. Compute the cues once per pair with `prismChordCue` at `t = 0` and `t = 1`, which is exactly `depthCueAlpha` of each end, and lerp between them here. The law and the loop agree by construction because the lerp is the same expression.

Inside the pair loop, immediately after `const pA = effProj[a], pB = effProj[b];` (line 1793), add:

```jsx
              // The two ends' depth cues, once per PAIR -- not per spectral
              // line and not per point.
              const cueA = prismChordCue(pA.depth, pB.depth, 0);
              const cueB = prismChordCue(pA.depth, pB.depth, 1);
```

Change the two chord calls (lines 1818–1822) to pass them:

```jsx
                writeHsl(rgb, 0, hue, PRISM_SAT, PRISM_GLOW_LIT);
                chord(m, lAlpha * PRISM_GLOW_ALPHA_K, prismGlowWidth(k), cueA, cueB);
                // Sharp core pass
                writeHsl(rgb, 0, hue, PRISM_SAT, PRISM_CORE_LIT);
                chord(m, lAlpha, PRISM_CORE_W, cueA, cueB);
```

Change the polygon call (line 1837):

```jsx
              straight(p0.sx, p0.sy, p1.sx, p1.sy, polyA, PRISM_POLY_W,
                       depthCueAlpha(p0.depth), depthCueAlpha(p1.depth));
```

Change the spoke call (line 1848). A spoke runs from the sphere centre to a node; the centre sits at depth 0, so its cue is `depthCueAlpha(0)` = 0.5:

```jsx
            straight(cx, cy, ep.sx, ep.sy, alpha * PRISM_SPOKE_ALPHA_K, PRISM_SPOKE_W,
                     depthCueAlpha(0), depthCueAlpha(ep.depth));
```

- [ ] **Step 6: Run the full suite and lint**

```bash
npx vitest run
```

Expected: all pass.

```bash
npm run lint
```

Expected: `0 errors`.

- [ ] **Step 7: Verify in the browser**

Start the dev server with the launch config `scale94-dev-5173` (NOT `scale94-dev` — it passes `--port 5174` while `vite.config.js` sets `port: 5173, strictPort: true`, and that mismatch produces a page that throws unboundedly). Open `/chaos`.

**The browser pane suspends rAF while hidden.** If `__artEdgeState().additive.count` reads 0, front the tab before concluding anything.

Fire a prism (the terminal input is below the fold; a synthetic `mousedown`+`mouseup` pair on a node disc also works — see the session transcript for the exact recipe) and confirm by eye that chords running to the back of the sphere are now visibly dimmer at that end. Capture a screenshot for the task report.

- [ ] **Step 8: Prove the liveness test is not vacuous**

Temporarily change `prismChordCue` to `return depthCueAlpha(depthA + (depthB - depthA) * t);` and run:

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "interpolates the CUES"
```

Expected: **FAIL** (received 0.5, expected 0.54). Restore by hand. **State in the task report that this was done.**

- [ ] **Step 9: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/views/ArtTab.jsx src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): the prism was the only layer with no depth term"
```

---

### Task 3: Root taper on the wide pass

**Files:**
- Modify: `src/terminal/art/artEdges.js` (beside `prismChordCue`)
- Modify: `src/terminal/views/ArtTab.jsx` (the `chord` helper from Task 2)
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: the `chord(m, a, width, cueA, cueB)` helper from Task 2.
- Produces: `PRISM_ROOT_TAPER_PX` (number, 14) and `prismRootTaper(sFromA, totalLen) -> number` in `[0, 1]`. `chord` gains a 6th parameter `taper` (boolean).

- [ ] **Step 1: Write the failing tests**

```js
describe('prismRootTaper', () => {
  it('is 0 at each end and 1 beyond the taper length', () => {
    // totalLen 100 -> L = min(14, 100/3 = 33.33) = 14.
    expect(prismRootTaper(0,   100)).toBeCloseTo(0, 7);
    expect(prismRootTaper(100, 100)).toBeCloseTo(0, 7);
    expect(prismRootTaper(7,   100)).toBeCloseTo(0.5, 7);   // 7 / 14
    expect(prismRootTaper(14,  100)).toBeCloseTo(1, 7);     // 14 / 14
    expect(prismRootTaper(50,  100)).toBeCloseTo(1, 7);     // clamped
    expect(prismRootTaper(93,  100)).toBeCloseTo(0.5, 7);   // 7 from the B end
  });

  // LIVENESS for the /3 clamp. On a 20px chord the clamp makes L = 6.67, so
  // the MIDPOINT is at full alpha. Without the clamp L stays 14 and the
  // midpoint would be 10/14 = 0.714 -- a chord that never reaches full
  // strength anywhere, which is the bug the clamp exists to prevent.
  it('clamps the taper length to a third of the chord, so short chords still reach 1', () => {
    expect(prismRootTaper(10, 20)).toBeCloseTo(1, 7);
    expect(prismRootTaper(10, 20)).not.toBeCloseTo(0.714, 2);
    // and it still tapers: 3.335 is half of L = 20/3.
    expect(prismRootTaper(20 / 6, 20)).toBeCloseTo(0.5, 7);
  });

  it('returns 1 for a degenerate chord instead of dividing by zero', () => {
    expect(prismRootTaper(0, 0)).toBe(1);
    expect(Number.isFinite(prismRootTaper(0, 0))).toBe(true);
  });

  it('is symmetric about the midpoint', () => {
    for (const s of [0, 3, 7, 14, 30]) {
      expect(prismRootTaper(s, 100)).toBeCloseTo(prismRootTaper(100 - s, 100), 7);
    }
  });

  it('PRISM_ROOT_TAPER_PX matches the base edge taper it was chosen to echo', () => {
    expect(PRISM_ROOT_TAPER_PX).toBe(14);
    expect(PRISM_ROOT_TAPER_PX).toBe(EDGE_TAPER_PX);
  });
});
```

Add `prismRootTaper`, `PRISM_ROOT_TAPER_PX` and `EDGE_TAPER_PX` to the `from '../artEdges'` import list.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "prismRootTaper"
```

Expected: FAIL with `prismRootTaper is not a function`.

- [ ] **Step 3: Implement**

In `src/terminal/art/artEdges.js`, beside `prismChordCue`:

```js
/** Where the prism's wide pass reaches full strength, in px of arc length from
 *  each end. Matches EDGE_TAPER_PX deliberately: the base edges' glow taper and
 *  this one are the same gesture on two layers, and a reader who finds two
 *  different numbers will reasonably assume one of them was tuned. */
export const PRISM_ROOT_TAPER_PX = 14;

/**
 * The wide pass's alpha multiplier at arc length `sFromA` along a chord of
 * total length `totalLen`. Linear from 0 at each end to 1 at
 * PRISM_ROOT_TAPER_PX in, flat in the middle.
 *
 * WHY ONLY THE WIDE PASS. In an eleven-node effect, 140 strokes terminate on
 * ONE node centre (10 pairs x 7 spectral lines x 2 passes) on an ADDITIVE
 * layer. Measured live: 60 stroke endpoints inside a single 2x2px cell against
 * a mean of 5.3 per occupied cell. The node disc behind that is 14-20px wide
 * and it was being swallowed. The wide pass carries ~56% of the root ink
 * (glow 0.4 x ~3.8px against core 1.0 x 1.2px), so tapering it removes that
 * share while the 1.2px core still lands on the exact node origin -- which is
 * the author's ruling, and the same one made for the base edges last session.
 *
 * DO NOT reuse the shipped EDGE_TAPER_PX shader taper for this. That one
 * multiplies the GLOW term, and the prism packs glow = 0: its "glow" is a
 * literal second stroke, not a shader shoulder. The shader taper cannot fire
 * on this layer at all.
 *
 * `totalLen / 3` IS A GUARD, NOT A TASTE KNOB. Without it, a chord shorter
 * than 2 x PRISM_ROOT_TAPER_PX tapers from both ends and never reaches full
 * alpha anywhere -- a 20px chord would peak at 10/14 = 0.714 in its middle.
 */
export function prismRootTaper(sFromA, totalLen) {
  if (!(totalLen > 1e-6)) return 1;
  const L = Math.min(PRISM_ROOT_TAPER_PX, totalLen / 3);
  if (!(L > 1e-6)) return 1;
  const d = Math.min(sFromA, totalLen - sFromA);
  return Math.min(1, d / L);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "prismRootTaper"
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Wire it into the wide pass only**

In `src/terminal/views/ArtTab.jsx`, add a 6th parameter to the `chord` helper written in Task 2 and apply the taper inside the per-point loop:

```jsx
        const chord = (m, a, width, cueA, cueB, taper) => {
          const al = prismAlphaRef.current;
          let total = 0;
          for (let i = 0; i + 1 < m; i++) {
            total += Math.hypot(pts[i * 2 + 2] - pts[i * 2],
                                pts[i * 2 + 3] - pts[i * 2 + 1]);
          }
          let s = 0;
          for (let i = 0; i < m; i++) {
            if (i > 0) {
              s += Math.hypot(pts[i * 2] - pts[i * 2 - 2],
                              pts[i * 2 + 1] - pts[i * 2 - 1]);
            }
            const t = total > 1e-6 ? s / total : 0;
            const cue = cueA + (cueB - cueA) * t;
            al[i] = a * cue * (taper ? prismRootTaper(s, total) : 1);
          }
          return writePolyline(ag, pts, m, rgb, a, width * ink, PRISM_FLAGS, 0, al);
        };
```

Update the two chord calls so that **only the wide pass tapers**:

```jsx
                // Wide glow pass -- TAPERED at the root. See prismRootTaper:
                // 140 of these terminate on one node centre and the disc was
                // being swallowed.
                writeHsl(rgb, 0, hue, PRISM_SAT, PRISM_GLOW_LIT);
                chord(m, lAlpha * PRISM_GLOW_ALPHA_K, prismGlowWidth(k), cueA, cueB, true);
                // Sharp core pass -- NOT tapered. The thread lands on the exact
                // node origin, which is the author's ruling; 70 cores still
                // converge there and whether that needs its own attenuation is
                // a measured question, not this task's to answer.
                writeHsl(rgb, 0, hue, PRISM_SAT, PRISM_CORE_LIT);
                chord(m, lAlpha, PRISM_CORE_W, cueA, cueB, false);
```

Leave the polygon and spoke `straight` calls untaperd — they are single segments between structural points, not a converging bundle.

- [ ] **Step 6: Run the full suite and lint**

```bash
npx vitest run
```

Expected: all pass.

```bash
npm run lint
```

Expected: `0 errors`.

- [ ] **Step 7: Verify in the browser and MEASURE the remaining root**

With the dev server on 5173 and a prism firing, re-run the endpoint-density measurement from the spec's section 0 and report the new numbers beside the old ones (60 endpoints in the hot 2×2px cell, 5.3 mean). Endpoint COUNT will not change — the taper changes alpha, not geometry — so report **summed ink** (`alpha0 × width` over instances with an endpoint in the cell) before and after, and a screenshot of a node at the root of a live bundle.

**If the disc still blows to pure white, STOP and report it.** The next lever is a partial core attenuation and that is an author decision, explicitly out of scope here.

- [ ] **Step 8: Prove the liveness test is not vacuous**

Temporarily drop the clamp: `const L = PRISM_ROOT_TAPER_PX;`. Run:

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "clamps the taper length"
```

Expected: **FAIL** (received 0.714, expected 1). Restore by hand. **State in the task report that this was done.**

- [ ] **Step 9: Commit**

```bash
git add src/terminal/art/artEdges.js src/terminal/views/ArtTab.jsx src/terminal/art/__tests__/artEdges.test.js
git commit -m "fix(chaos): taper the prism wide pass so the dot survives its own bundle"
```

---

### Task 4: Dash antialiasing

**Files:**
- Modify: `src/terminal/art/SphereEdges.js` — `edgeFrag`, the `main()` top block at 1143–1152 and the dash line at 1272–1274; also **add `export` to the `edgeFrag` declaration at line 1107** so the tests can build it
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: GLSL locals `dashPos`, `dpxDash`, `sd`, `dashMask` available to Task 5. `sd` is the **signed** distance to the dash on-interval: positive inside a dash, negative in a gap.

- [ ] **Step 1: Write the failing tests**

GLSL cannot be unit tested here, so these are source-level regression locks. Add a new `describe` block:

```js
describe('edgeFrag dash antialiasing', () => {
  // edgeFrag is a FUNCTION -- `(shadow, composite) => glsl` -- compiled twice,
  // once per material, from one shared body. Build both and assert on each, so
  // a change that lands on only one material cannot pass.
  //
  // These lock properties a browser check cannot re-run on every commit. They
  // are NOT a substitute for looking: a shader that draws nothing produces no
  // GL error, and this project has shipped exactly that once.
  const FRAGS = [
    ['src-over', edgeFrag(SRC_OVER_LAYER.shadow, SRC_OVER_LAYER.composite)],
    ['additive', edgeFrag(ADDITIVE_LAYER.shadow, ADDITIVE_LAYER.composite)],
  ];

  it.each(FRAGS)('%s: no longer cuts the dash with a hard step()', (_name, FRAG) => {
    expect(FRAG).not.toContain('step(mod(dashPos');
  });

  it.each(FRAGS)('%s: box-filters the dash boundary in the shader\'s own idiom', (_name, FRAG) => {
    // clamp(x / px + 0.5, 0, 1) -- the form that integrates to the true width.
    // NOT smoothstep: this file's own comment records that a smoothstep
    // shoulder spreads a 1px line over 1.5px and reads as a one-sided
    // brightening the parity gate catches.
    expect(FRAG).toContain('clamp(sd / dpxDash + 0.5, 0.0, 1.0)');
    expect(FRAG).not.toContain('smoothstep(0.0, dpxDash');
  });

  it.each(FRAGS)('%s: guards the dash period against mod(x, 0.0)', (_name, FRAG) => {
    // Hoisting mod() out of `if (vDash.x > 0.0)` for the derivative means it
    // now runs on SOLID instances too, and the prism packs dashPeriod = 0.
    // mod(x, 0.0) is a divide by zero, and this file already documents that
    // mix(x, NaN, 0.0) is NaN rather than x -- a NaN here would escape into
    // the whole additive layer.
    expect(FRAG).toContain('max(vDash.x, 1e-3)');
  });

  it.each(FRAGS)('%s: takes the dash derivative before any branch', (_name, FRAG) => {
    const body   = FRAG.slice(FRAG.indexOf('void main()'));
    const deriv  = body.indexOf('dFdx(dashPos)');
    const branch = body.indexOf('if (vDash.x > 0.0)');
    expect(deriv).toBeGreaterThan(-1);
    expect(branch).toBeGreaterThan(-1);
    // Derivatives are undefined inside non-uniform control flow. This is the
    // same rule pxD and pxA already follow in the first two statements.
    expect(deriv).toBeLessThan(branch);
  });
});
```

**`edgeFrag` is currently module-private** (`const edgeFrag = (shadow, composite) => ...` at `SphereEdges.js:1107`). Export it — add `export` to that declaration and add `edgeFrag` to the test file's `from '../SphereEdges'` import list. It is shader source built at module load; exporting it has no runtime cost and no effect on `createEdgeLayer`, which keeps calling it exactly as it does today at line 1496.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "edgeFrag dash antialiasing"
```

Expected: FAIL — `step(mod(dashPos` is present today and none of the new tokens are.

- [ ] **Step 3: Implement — hoist the dash position**

In `edgeFrag`, the top of `main()` currently reads:

```glsl
    float pxD = max(length(vec2(dFdx(vD), dFdy(vD))), 1e-6);
    float pxA = max(length(vec2(dFdx(vAlong), dFdy(vAlong))), 1e-6);

    float t = vLen > 1e-6 ? clamp(vAlong / vLen, 0.0, 1.0) : 0.0;
```

The dash position needs `t`, `rMid` and `ang`, so move those three computations up here, keeping their comments and — critically — the `atan(0,0)` guard, which must travel with `ang` and not be left behind:

```glsl
    float pxD = max(length(vec2(dFdx(vD), dFdy(vD))), 1e-6);
    float pxA = max(length(vec2(dFdx(vAlong), dFdy(vAlong))), 1e-6);

    float t = vLen > 1e-6 ? clamp(vAlong / vLen, 0.0, 1.0) : 0.0;

    // Radius, angle and dash position are all hoisted HERE, above every
    // branch, because dFdx(dashPos) is taken in the next statement and
    // derivatives are undefined inside non-uniform control flow -- the same
    // rule pxD and pxA follow two lines up.
    //
    // The atan(0,0) guard travels WITH ang: atan is undefined at the exact
    // centre of every filled disc, and this file documents that the resulting
    // NaN survives mix() because the spec expands mix to x*(1-a)+y*a and
    // NaN*0 is NaN.
    float rG0 = length(vec2(vAlong, vD));
    float ang = mod(atan(vD, vAlong + step(rG0, 1e-6)) + 6.283185307179586,
                    6.283185307179586);
    float rMid = (vHalfW + vDisc.x) * 0.5;
    float dashPos = mix(vPhase + t * vLen, rMid * ang, vIsDisc);
    float dpxDash = max(length(vec2(dFdx(dashPos), dFdy(dashPos))), 1e-6);
```

Then delete the later duplicate definitions of `ang`, `rMid` and `dashPos` (currently at 1258–1273) and change the local `float r = rG;` / `float rG = length(...)` region so it reuses `rG0` rather than recomputing the same length. **`rG`, `r` and `rG0` must all be the same value** — this file's comment says "one r, not two that could drift". Keep one name.

- [ ] **Step 4: Implement — the antialiased cut**

Replace line 1274:

```glsl
    if (vDash.x > 0.0) core *= step(mod(dashPos, vDash.x), vDash.y);
```

with:

```glsl
    // THE DASH BOUNDARY, BOX-FILTERED. It was a hard step(): the sides and
    // caps of these lines were antialiased and the dash cut alone was not,
    // which is what read as stair-stepping on a rotating chord.
    //
    // P IS GUARDED AND THE GUARD IS LOAD-BEARING. mod() used to run only
    // inside the branch below; it now runs on every instance, including the
    // solid ones -- and the prism packs dashPeriod = 0. mod(x, 0.0) divides by
    // zero, and a NaN here would escape through the mix()/step() collapse into
    // the whole additive layer.
    //
    // `sd` is the SIGNED distance to the on-interval [0, D) of a period P:
    // positive inside a dash, negative in a gap. One value serves two jobs --
    // the cut here, and the bead's falloff below.
    //
    // Box filter, NOT smoothstep. A smoothstep shoulder spreads a 1px line
    // over 1.5px and the parity gate reads it as a one-sided brightening; this
    // form integrates to the true D/P duty and is ink-neutral by construction.
    // It also degrades correctly: as a chord rotates near edge-on and dpxDash
    // approaches P, the mask converges to a constant D/P grey instead of
    // aliasing against the pixel grid.
    float dashP = max(vDash.x, 1e-3);
    float dashD = vDash.y;
    float dashM = mod(dashPos, dashP);
    float sd = dashM < dashD
      ?  min(dashM, dashD - dashM)
      : -min(dashM - dashD, dashP - dashM);
    float dashMask = clamp(sd / dpxDash + 0.5, 0.0, 1.0);
    if (vDash.x > 0.0) core *= dashMask;
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js
```

Expected: PASS, whole file.

- [ ] **Step 6: Run the full suite and lint**

```bash
npx vitest run
```

Expected: all pass.

```bash
npm run lint
```

Expected: `0 errors`.

- [ ] **Step 7: Verify in the browser — this one CANNOT be signed off from tests**

The source locks in Step 1 prove tokens are present, not that the shader compiles or renders. A shader that draws nothing produces no GL error — this project shipped exactly that once.

On `/chaos` at 5173:
1. `read_console_messages` — confirm no shader compile/link error.
2. Confirm ortho bridges are still visible at all. If the sphere's dashed chords have vanished, the shader failed silently.
3. Screenshot a dashed chord and confirm the dash ends are soft, not stepped.
4. Rotate the sphere (drag) and confirm the dashes no longer crawl or vary in length near edge-on.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/art/SphereEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -m "fix(chaos): the dash cut was the one hard edge left in the shader"
```

---

### Task 5: Dash beads, orthogonal bridges only

**Files:**
- Modify: `src/terminal/art/SphereEdges.js` — `edgeFrag`, the glow distance at 1286
- Test: `src/terminal/art/__tests__/artEdges.test.js`

**Interfaces:**
- Consumes: `sd` and `dashMask` from Task 4.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

```js
describe('edgeFrag dash beads', () => {
  const FRAGS = [
    ['src-over', edgeFrag(SRC_OVER_LAYER.shadow, SRC_OVER_LAYER.composite)],
    ['additive', edgeFrag(ADDITIVE_LAYER.shadow, ADDITIVE_LAYER.composite)],
  ];

  it.each(FRAGS)('%s: feeds distance-to-dash into the glow, not a hard gate on it', (_name, FRAG) => {
    // A hard gate would cut the halo at the same boundary as the core and
    // produce a chopped halo, not a bead. The bead comes from extending the
    // EXISTING gaussian's distance argument.
    expect(FRAG).toContain('float dDash = max(0.0, -sd);');
    expect(FRAG).toContain('dDash * beadGate');
  });

  it.each(FRAGS)('%s: gates the bead on vIsOrtho, so the spectral ruling survives', (_name, FRAG) => {
    // The continuous halo across a dashed SPECTRAL bridge is an explicit
    // author ruling -- "the 1-2% atmospheric bridge visually grounds them".
    // It was made about spectral bridges at 1-2% alpha, not about ortho at
    // isOrtho opacity, so it stands where it was made.
    const gate = FRAG.slice(FRAG.indexOf('float beadGate'));
    expect(gate.slice(0, 120)).toContain('vIsOrtho');
  });

  it.each(FRAGS)('%s: gates the bead off discs, because pulse rings are dashed discs', (_name, FRAG) => {
    // edgeFrag has a whole rMid*ang branch for dashed discs. They are pulse
    // rings, not ortho bridges; without this gate a ring halo would be chopped
    // into arcs.
    const gate = FRAG.slice(FRAG.indexOf('float beadGate'));
    expect(gate.slice(0, 120)).toContain('1.0 - vIsDisc');
  });

  it.each(FRAGS)('%s: leaves the segment-end rounding intact', (_name, FRAG) => {
    // dOut still carries the past-the-end distance; the bead is a max() with
    // it, not a replacement. A blurred butt cap must still round off.
    expect(FRAG).toContain('max(-vAlong, vAlong - vLen)');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "edgeFrag dash beads"
```

Expected: FAIL — none of `dDash`, `beadGate` exist yet.

- [ ] **Step 3: Implement**

Replace line 1286:

```glsl
    float dOut = max(0.0, max(-vAlong, vAlong - vLen));
```

with:

```glsl
    // THE BEAD. The ortho bridges carried a real halo already -- orthoGlow is
    // 10 +/- 4px with the opaque isOrtho shadow colour -- but it was NOT gated
    // by the dash: glowSeg came from the segment distance alone, so a
    // continuous 6-14px haze ran the whole chord with hard chips of core
    // punched on top. That is what made them read as flat 2D overlays rather
    // than rays suspended in the volume.
    //
    // The fix is not a gate on the glow, which would chop the halo at the same
    // boundary as the core. It is to extend the distance the EXISTING gaussian
    // already integrates: zero inside a dash, growing through the gap, so each
    // dash gets its own blurred envelope and neighbouring halos overlap softly
    // -- which is what a blurred dashed line physically looks like, and the
    // same approximation this file already makes for segment ends.
    //
    // TWO GATES, BOTH LOAD-BEARING. vIsOrtho keeps the continuous haze on
    // dashed SPECTRAL bridges, which is an author ruling. (1.0 - vIsDisc)
    // keeps it off pulse rings, which are dashed DISCS and would otherwise
    // have their halos chopped into arcs.
    float dDash = max(0.0, -sd);
    float beadGate = vIsOrtho * step(0.001, vDash.x) * (1.0 - vIsDisc);
    float dOut = max(max(0.0, max(-vAlong, vAlong - vLen)), dDash * beadGate);
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/terminal/art/__tests__/artEdges.test.js -t "edgeFrag dash beads"
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Run the full suite and lint**

```bash
npx vitest run
```

Expected: all pass.

```bash
npm run lint
```

Expected: `0 errors`.

- [ ] **Step 6: Verify in the browser, and prove the two gates**

1. `read_console_messages` — no shader error.
2. Screenshot an ortho bridge: each dash should now have its own soft shoulder.
3. **Prove the ortho gate:** screenshot a dashed *spectral* bridge and confirm its halo is still continuous across its gaps. If spectral bridges also beaded, `vIsOrtho` is not doing its job.
4. **Prove the disc gate:** fire a node and screenshot a pulse ring. Its halo must be an unbroken annulus, not arcs.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/art/SphereEdges.js src/terminal/art/__tests__/artEdges.test.js
git commit -m "feat(chaos): give each ortho dash its own photon envelope"
```

---

### Task 6: Measure the bloom, then re-cut the reference

**Files:**
- Create: `scripts/_a10dash.mjs`
- Modify: none in `src/`

**Interfaces:**
- Consumes: the finished branch.
- Produces: measured ink/lit/hot deltas, and a re-cut parity reference.

- [ ] **Step 1: Write the instrument**

Model it on `scripts/_a9lens.mjs`, which does same-build A/B by patching a constant in tracked source, shooting, restoring and comparing at a matched frame index.

**Copy its restore discipline exactly: hold the ORIGINAL BYTES IN MEMORY and write them back.** Do not use `git checkout -- <file>` — it restores to the last commit, not to pre-patch bytes, and it destroyed an in-progress edit on this project last session. Assert `restored: YES/NO` and fail loudly on NO.

The A/B toggle is `beadGate`: patch it to a literal `0.0` for the control (continuous haze, today's behaviour) against the shipped value.

- [ ] **Step 2: Measure**

Report, for **both** normal and immersive mode, control vs shipped:

| metric | why |
|---|---|
| ink | total deposited light |
| lit | count of non-black px |
| ink / lit | mean brightness of lit px |
| hot (≥ 0.28) | px above the composer's `luminanceThreshold` |

Gating the ortho halo REMOVES light from the gaps, and ortho is the brightest halo family on the sphere, so `hot` is the number to watch.

**If bloom moved, bring the numbers to the author. Do not turn a dial.** `BLOOM.intensity`, `BLOOM.levels`, `BLOOM.luminanceThreshold` and `KNEE.knee` are off limits.

- [ ] **Step 3: Author looks**

Present the screenshots and the table. **Do not re-cut the reference before this.** A parity reference certifies whatever the sphere looks like at the moment it is taken; re-cutting before the author has ruled risks certifying a state they then change.

- [ ] **Step 4: Re-cut the reference, only after the ruling**

```bash
BASELINE_COMMIT=$(git rev-parse HEAD) node scripts/artBaseline.mjs --set <name>
```

**`BASELINE_COMMIT` MUST be set.** Unset, `artBaseline` stamps `gitCommit: null` and the reference is unattributable.

Then, per the lesson from the last branch: **Task 5 of that plan produced an unusable reference** because it compared sets pairwise without first running `node scripts/artNull.mjs --write <set>` once per set. Run `artNull --write` on every set you intend to quote, or every pair comes back `0/21 ADMISSIBLE, 21/21 no-null`.

- [ ] **Step 5: Commit**

```bash
git add scripts/_a10dash.mjs
git commit -m "test(chaos): measure what gating the ortho halo costs the bloom"
```

---

## Self-Review

**Spec coverage.** §1 plumbing → Task 1. §2 depth cue → Task 2. §3 root taper → Task 3. §4 dash AA → Task 4. §5 beads → Task 5. §7 bloom risk → Task 6. §8 testing discipline → Global Constraints plus a liveness step in Tasks 1, 2 and 3. §9 sequence → task order. §10 constraints → Global Constraints. §11 out-of-scope → no task touches the analogy filaments, the core pass, or the disc↔streak threshold.

**Gap found and closed:** the spec's §2 says the depth cue applies to "the polygon and spokes as well"; Task 2 Step 5 now names both call sites explicitly, including `depthCueAlpha(0)` for the spoke's centre end.

**Gap found and closed:** the spec did not say where the *arc length* for the taper comes from. Task 3 computes it in the `chord` helper over the same point list `writePolyline` walks, so the two cannot drift — rather than reading back `writePolyline`'s internal `phase`, which is written to float 16 and would couple the taper to the dash encoding.

**Type consistency.** `writePolyline(state, pts, m, rgb, alpha, width, flags, phase0, alphas)` is introduced in Task 1 and used with that exact arity in Tasks 2 and 3. `chord(m, a, width, cueA, cueB)` in Task 2 becomes `chord(m, a, width, cueA, cueB, taper)` in Task 3, and Task 3 restates the whole helper rather than describing a diff. `prismChordCue(depthA, depthB, t)` and `prismRootTaper(sFromA, totalLen)` are used exactly as defined. `sd` is defined in Task 4 and consumed in Task 5 under that name.

**One naming hazard flagged for the implementer:** Task 4 hoists `ang` and introduces `rG0`. The existing body defines `rG` and `r` as the same length. All three must end up as ONE name — this file's own comment insists on "one r, not two that could drift."

**Error caught during self-review, recorded because the plan text is where this project's defects keep originating.** The first draft of Tasks 4 and 5 asserted against a constant `EDGE_FRAG`. **No such export exists** — `EDGE_FRAG` appears only inside a comment at `SphereEdges.js:1547`. The fragment shader is a module-private factory, `const edgeFrag = (shadow, composite) => glsl` at line 1107, compiled twice from one shared body (`edgeFrag(spec.shadow, spec.composite)`, line 1496). Every one of those eight tests would have failed with `EDGE_FRAG is not defined` and an implementer reading the plan literally would have invented an export that duplicated the source. Both task blocks now build the real thing from `SRC_OVER_LAYER` / `ADDITIVE_LAYER` — which also makes the locks stronger, since they now run against **both** compiled materials rather than one assumed string.

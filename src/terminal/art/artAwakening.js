// artAwakening.js — Jury Awakening sequence + Bifurcation Conductor rendering
//
// Extracted from ArtTab draw loop for readability.
// All functions are pure draw helpers — they mutate canvas context and awakening state
// but don't touch React state.

import { NODE_COLORS } from './artGraph';
import {
  beaconPulse, beaconRadius, beaconAlpha,
  BEACON_WIDTH, BEACON_HUE_FALLBACK, BEACON_SAT, BEACON_LIT,
} from './artNodes';
import { emitNodeBurst } from './artParticles';

import { artRandom } from './artRandom.js';
// ── Jury Awakening state machine ─────────────────────────────────────────────
// Advances awakening phases and injects energy into nodes.
// Returns nothing — mutates aw (awakeningRef.current) and node energies in place.
export function stepAwakening(aw, nodes, frameCount, particles) {
  const elapsed = (performance.now() - aw.t0) / 1000;
  aw.breathPhase += 0.015;

  if (aw.phase === 0 && elapsed < 4.0) {
    // Phase 0: Genesis cascade — inject energy cluster by cluster
    const clusterOrder = ['eco', 'sync', 'phys', 'crypto', 'drk'];
    for (let ci = 0; ci < clusterOrder.length; ci++) {
      const clStart = ci * 0.7;
      if (elapsed >= clStart && elapsed < clStart + 1.0) {
        const t = (elapsed - clStart) / 1.0;
        const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        for (const n of nodes) {
          if (n.cluster === clusterOrder[ci]) {
            n.energy = Math.max(n.energy, easeT * 0.35);
          }
        }
      }
    }
    // Sparse genesis particles — every 10 frames, 15% chance per node
    if (frameCount % 10 === 0) {
      for (const n of nodes) {
        if (n.energy > 0.2 && artRandom() < 0.15) {
          const col = NODE_COLORS[n.id];
          emitNodeBurst(particles, n.x, n.y, n.z,
            col?.hue ?? 30, (col?.hue ?? 30 + 90) % 360, 1);
        }
      }
    }
  } else if (aw.phase === 0) {
    aw.phase = 1;
  }

  if (aw.phase === 1 && !aw.interacted) {
    const beaconNode = nodes[aw.beaconIdx % nodes.length];
    if (beaconNode) {
      const pulse = 0.3 + 0.3 * Math.sin(elapsed * 2.0);
      beaconNode.energy = Math.max(beaconNode.energy, pulse);
    }
    if (elapsed >= 8.0) aw.phase = 2;
  }

  // Phase 2 (auto-ignition) returns nodes to fire — caller handles audio/effects
  if (aw.phase === 2 && !aw.interacted) {
    const toFire = [];
    const ignitionStart = 8.0;
    const offsets = [0, 7, 15];
    for (let fi = 0; fi < offsets.length; fi++) {
      const n = nodes[(aw.beaconIdx + offsets[fi]) % nodes.length];
      if (n && elapsed >= ignitionStart + fi * 1.0 && !aw.autoFiredNodes.includes(n.id)) {
        aw.autoFiredNodes.push(n.id);
        n.energy = 0.85;
        toFire.push(n);
      }
    }
    if (aw.autoFiredNodes.length >= 3) aw.phase = 3;
    return toFire;
  }

  return [];
}

// ── Genesis glow — radial bloom from center during awakening phase 0 ────────
// The genesis glow moved to the GPU in step 3. Its phase gate, fade and radius
// now live in artBackground.js as the pure `genesisGlowState`, which is unit
// tested; SphereBackground.js draws it. Nothing draws it on the 2D canvas.

// ── Beacon ring — pulsing invitation during awakening phase 1 ────────────────
// ON THE GPU since step 5 task 5. This is now the GATE and the PARAMETERS, and
// it touches no context: ArtTab writes the annulus into the ADDITIVE stream,
// which is where `globalCompositeOperation = 'lighter'` went.
//
// nodeCount should be passed from NODES.length. Returns null when the
// phase/index gate rejects it, and the ring's parameters when it fires — the
// truthiness is the census signal it has always been, so a caller that only
// asks "did it draw?" reads the same as before.
//
// This ring fires for ONE node during ONE ~4s window (elapsed 4.1s-8.0s of a
// real boot), so a capture that missed it scores identical parity whether the
// layer ships or is deleted, and only the draw site can say which happened.
//
// `tSeconds` is injectable so the pulse is testable without a clock; the
// default is the wall clock the 2D version read.
export function beaconRingState(aw, nodeIdx, p, radius, renderCol, depthAlpha,
                                nodeCount, tSeconds = performance.now() * 0.001,
                                ink = 1) {
  if (aw.phase !== 1 || nodeIdx !== (aw.beaconIdx % (nodeCount || 31))) return null;

  const pulse = beaconPulse(tSeconds);
  return {
    cx: p.sx,
    cy: p.sy,
    // `ink` is item 5b's immersive ink scale, 1 everywhere else. `radius`
    // arrives already carrying it; these two terms are the ring's OWN
    // screen-px geometry and have to be told.
    radius: beaconRadius(radius, pulse, p.scale * ink),
    width: BEACON_WIDTH * p.scale * ink,
    // `?? 40` — a dynamic node with no registered hue falls back rather than
    // writing NaN into the buffer, which is what the hsla() string did too.
    hsl: {
      hue: renderCol.hue ?? BEACON_HUE_FALLBACK,
      sat: BEACON_SAT,
      lit: BEACON_LIT,
    },
    alpha: beaconAlpha(pulse, depthAlpha),
  };
}

// ── Bifurcation Conductor (right-edge whisker) ─────────────────────────────
//
// The last 2-D layer on this branch, and the one no capture state arms:
// `visible = dragging || peerPush`, and a capture does neither. Three of the
// four sub-layers therefore never draw in any reference image and the fourth
// draws at alpha 0.03 — outside the sphere's disc, where artInk's disc column
// cannot see it either. So the state is split out from the drawing FIRST, the
// way beaconRingState above it is, for three reasons:
//
//   1. `drawn` is what a capture's layer census counts. Counting at the draw
//      call rather than re-deriving the conditions afterwards keeps it to one
//      source of truth — the precedent nodeCensusRef sets in ArtTab.
//   2. The GL port consumes the same object the 2-D path does, so the two
//      cannot disagree about geometry, colour or alpha.
//   3. Every alpha and threshold is named once in CONDUCTOR below instead of
//      being restated at four draw sites.
//
// This is screen space, not sphere geometry: a fixed strip at the right edge.
// The GL edge layer writes gl_Position in clip space directly from CSS px
// against the same uResolution the 2-D loop uses, so these coordinates port
// across with no projection and no camera.

/** Every constant the conductor draws from, named once. */
export const CONDUCTOR = Object.freeze({
  MARGIN_X: 6,            // px in from the right edge
  TOP: 0.20,              // strip top as a fraction of canvas height
  HEIGHT: 0.60,           // strip height as a fraction of canvas height
  WIDTH: 1,               // px, both the track and the fill bar
  DOT_R: 1.5,
  DOT_R_DRAG: 3,
  GLOW_PAD: 1,            // the peer-push disc is this much wider than the thumb
  // Canvas shadowBlur is a gaussian of sigma = blur/2, and EDGE_FRAG's shoulder
  // is exp(-2(d/g)^2), i.e. sigma = g/2. Same law, so this number ports as-is.
  GLOW_BLUR: 4,
  PEER_PUSH_MIN: 0.0003,
  PEER_GLOW_GAIN: 40,
  PEER_GLOW_MAX: 0.1,
  MIN_FILL_H: 1,          // px; below this the fill bar is dropped, not stubbed
  HUE_HOT: 0, HUE_WARM: 30, HUE_COOL: 210,
  HUE_HOT_AT: 0.85, HUE_WARM_AT: 0.6,
  ALPHA_VISIBLE: 0.3,
  ALPHA_DORMANT: 0.03,
  ALPHA_TRACK: 0.05,
  ALPHA_FILL_DRAG: 0.1,
  ALPHA_FILL: 0.05,
  THUMB_SAT: 50, THUMB_LIT: 55,
  FILL_SAT: 40, FILL_LIT: 50,
  SHADOW_SAT: 70, SHADOW_LIT: 50,
  TRACK_RGB: Object.freeze([102, 102, 102]),  // '#666'
});

/**
 * Everything the conductor draws this frame, as data. Pure.
 *
 * A sub-layer that does not draw is `null` rather than a flagged object, so a
 * caller cannot render it by forgetting to check — and `drawn` counts what a
 * frame actually contained, which is the only thing that can tell "the layer is
 * faithful" apart from "the layer was never on screen".
 */
export function conductorState(collectiveState, dragging, w, h) {
  const C = CONDUCTOR;
  const stripX = w - C.MARGIN_X;
  const stripY = h * C.TOP;
  const stripH = h * C.HEIGHT;
  const cY = collectiveState.conductorY;

  const peerPush = collectiveState.collectiveR > C.PEER_PUSH_MIN;
  const visible = !!dragging || peerPush;

  const thumbY = stripY + stripH - (stripH * cY);
  const hue = cY > C.HUE_HOT_AT ? C.HUE_HOT : cY > C.HUE_WARM_AT ? C.HUE_WARM : C.HUE_COOL;
  const dotR = dragging ? C.DOT_R_DRAG : C.DOT_R;

  const thumb = {
    cx: stripX, cy: thumbY, r: dotR,
    hsl: { hue, sat: C.THUMB_SAT, lit: C.THUMB_LIT },
    alpha: visible ? C.ALPHA_VISIBLE : C.ALPHA_DORMANT,
  };

  let track = null;
  let fill = null;
  if (visible) {
    track = {
      x: stripX, y0: stripY, y1: stripY + stripH,
      rgb: C.TRACK_RGB, width: C.WIDTH, alpha: C.ALPHA_TRACK,
    };
    const fillH = stripH * cY;
    if (fillH > C.MIN_FILL_H) {
      fill = {
        x: stripX, y0: stripY + stripH, y1: stripY + stripH - fillH,
        hsl: { hue, sat: C.FILL_SAT, lit: C.FILL_LIT },
        width: C.WIDTH,
        alpha: dragging ? C.ALPHA_FILL_DRAG : C.ALPHA_FILL,
      };
    }
  }

  let glow = null;
  if (peerPush) {
    glow = {
      cx: stripX, cy: thumbY, r: dotR + C.GLOW_PAD,
      // ctx.fill() paints the disc in fillStyle and the blur in shadowColor.
      // They are DIFFERENT colours here, so the port needs both: a GL disc
      // carrying one colour for core and glow would drop the distinction.
      hsl: { hue, sat: C.THUMB_SAT, lit: C.THUMB_LIT },
      shadowHsl: { hue, sat: C.SHADOW_SAT, lit: C.SHADOW_LIT },
      blur: C.GLOW_BLUR,
      alpha: Math.min(C.PEER_GLOW_MAX, collectiveState.collectiveR * C.PEER_GLOW_GAIN),
    };
  }

  return {
    stripX, stripY, stripH, thumbY, hue, dotR, visible, peerPush,
    thumb, track, fill, glow,
    drawn: {
      thumb: 1,
      track: track ? 1 : 0,
      fill: fill ? 1 : 0,
      glow: glow ? 1 : 0,
    },
  };
}

/**
 * Render `conductorState` to the 2-D canvas.
 *
 * THE APP NO LONGER CALLS THIS. Step 7 moved the conductor onto the GPU and
 * ArtTab is down to two ctx. sites, neither of them a layer. It is kept, and
 * kept tested, because it is the ORACLE: the call sequence frozen in
 * artAwakening.test.js is a capture of the pre-refactor function, and it is the
 * only executable record of what this layer looked like in 2-D. Deleting it
 * would leave the GL port with nothing to be a port OF.
 *
 * If the layer's appearance is ever deliberately changed, change it here too
 * and re-freeze the golden — a silently diverging oracle is worse than none.
 */
export function drawConductor(ctx, collectiveState, dragging, w, h) {
  const s = conductorState(collectiveState, dragging, w, h);

  ctx.save();
  ctx.globalAlpha = s.thumb.alpha;
  ctx.fillStyle = `hsl(${s.thumb.hsl.hue}, ${s.thumb.hsl.sat}%, ${s.thumb.hsl.lit}%)`;
  ctx.beginPath();
  ctx.arc(s.thumb.cx, s.thumb.cy, s.thumb.r, 0, Math.PI * 2);
  ctx.fill();

  if (s.track) {
    ctx.globalAlpha = s.track.alpha;
    ctx.strokeStyle = '#666';
    ctx.lineWidth = s.track.width;
    ctx.beginPath();
    ctx.moveTo(s.track.x, s.track.y0);
    ctx.lineTo(s.track.x, s.track.y1);
    ctx.stroke();

    if (s.fill) {
      ctx.globalAlpha = s.fill.alpha;
      ctx.strokeStyle = `hsla(${s.fill.hsl.hue}, ${s.fill.hsl.sat}%, ${s.fill.hsl.lit}%, 1)`;
      ctx.lineWidth = s.fill.width;
      ctx.beginPath();
      ctx.moveTo(s.fill.x, s.fill.y0);
      ctx.lineTo(s.fill.x, s.fill.y1);
      ctx.stroke();
    }
  }

  if (s.glow) {
    ctx.globalAlpha = s.glow.alpha;
    ctx.shadowColor = `hsl(${s.glow.shadowHsl.hue}, ${s.glow.shadowHsl.sat}%, ${s.glow.shadowHsl.lit}%)`;
    ctx.shadowBlur = s.glow.blur;
    ctx.beginPath();
    ctx.arc(s.glow.cx, s.glow.cy, s.glow.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
  return s;
}

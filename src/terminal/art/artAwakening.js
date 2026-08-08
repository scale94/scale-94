// artAwakening.js — Jury Awakening sequence + Bifurcation Conductor rendering
//
// Extracted from ArtTab draw loop for readability.
// All functions are pure draw helpers — they mutate canvas context and awakening state
// but don't touch React state.

import { NODE_COLORS } from './artGraph';
import { emitNodeBurst } from './artParticles';

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
        if (n.energy > 0.2 && Math.random() < 0.15) {
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
// nodeCount should be passed from NODES.length
export function drawBeaconRing(ctx, aw, nodeIdx, p, radius, renderCol, depthAlpha, nodeCount) {
  if (aw.phase !== 1 || nodeIdx !== (aw.beaconIdx % (nodeCount || 31))) return;

  const beaconT = performance.now() * 0.001;
  const ringPulse = 0.3 + 0.5 * Math.pow(Math.sin(beaconT * 2.0), 2);
  const ringR = radius + (6 + ringPulse * 6) * p.scale;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = `hsla(${renderCol.hue ?? 40},70%,65%,${(ringPulse * 0.2 * depthAlpha).toFixed(3)})`;
  ctx.lineWidth = 1.5 * p.scale;
  ctx.stroke();
  ctx.restore();
}

// ── Bifurcation Conductor (right-edge whisker) ───────────────────────────────
export function drawConductor(ctx, collectiveState, dragging, w, h) {
  const stripX = w - 6;
  const stripY = h * 0.20;
  const stripH = h * 0.60;
  const cY = collectiveState.conductorY;

  const peerPush = collectiveState.collectiveR > 0.0003;
  const visible = dragging || peerPush;

  const thumbY = stripY + stripH - (stripH * cY);
  const hue = cY > 0.85 ? 0 : cY > 0.6 ? 30 : 210;
  const dotR = dragging ? 3 : 1.5;

  ctx.save();
  ctx.globalAlpha = visible ? 0.3 : 0.03;
  ctx.fillStyle = `hsl(${hue}, 50%, 55%)`;
  ctx.beginPath();
  ctx.arc(stripX, thumbY, dotR, 0, Math.PI * 2);
  ctx.fill();

  if (visible) {
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(stripX, stripY);
    ctx.lineTo(stripX, stripY + stripH);
    ctx.stroke();

    const fillH = stripH * cY;
    if (fillH > 1) {
      ctx.globalAlpha = dragging ? 0.1 : 0.05;
      ctx.strokeStyle = `hsla(${hue}, 40%, 50%, 1)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(stripX, stripY + stripH);
      ctx.lineTo(stripX, stripY + stripH - fillH);
      ctx.stroke();
    }
  }

  if (peerPush) {
    const ga = Math.min(0.1, collectiveState.collectiveR * 40);
    ctx.globalAlpha = ga;
    ctx.shadowColor = `hsl(${hue}, 70%, 50%)`;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(stripX, thumbY, dotR + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { loadWasm } from '../../wasm/wasmSingleton';
import {
  FEATURES, NODE_IDX, DIM_NAMES,
  cosineSim, topDrivers, analyzeFullEdge, extractParadoxes,
} from '../data/nodeFeatures';

// ── Collider Event Bus ───────────────────────────────────────────────────────
// Cross-tab coupling: emits chimera synthesis results so the Art tab sphere
// can absorb them as new nodes. Same pattern as ecocideBus.
export const colliderBus = {
  _listeners: [],
  _pending: [],        // buffered chimeras for tabs not yet mounted
  emit(data) {
    this._listeners.forEach(fn => fn(data));
    if (data.type === 'CHIMERA_SYNTHESIS') this._pending.push(data);
  },
  on(fn) {
    this._listeners.push(fn);
    // Flush any pending chimeras to the new listener
    if (this._pending.length) {
      const queue = [...this._pending];
      this._pending = [];
      queue.forEach(d => fn(d));
    }
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  },
};

// ── Domain library (mirrors the 16 domains in latent_collider.rs) ────────────
const DOMAINS = [
  { id: 0,  name: 'Post-Quantum Cryptography',   short: 'PQC',       hue: 280 },
  { id: 1,  name: 'Benthic Biocenosis',           short: 'BENTH',     hue: 190 },
  { id: 2,  name: 'Bouligand Helicoidal Armor',   short: 'BOULG',     hue: 30  },
  { id: 3,  name: 'Feigenbaum Universality',       short: 'FEIGEN',    hue: 0   },
  { id: 4,  name: 'Mycelial Network Topology',     short: 'MYCEL',     hue: 120 },
  { id: 5,  name: 'Transformer Attention Heads',   short: 'ATTN',      hue: 220 },
  { id: 6,  name: 'Thermodynamic Free Energy',     short: 'THERMO',    hue: 45  },
  { id: 7,  name: 'Surveillance Percolation',      short: 'PANOPT',    hue: 340 },
  { id: 8,  name: 'Twisted Bilayer Graphene',      short: 'GRAPHN',    hue: 170 },
  { id: 9,  name: 'Ostrom Commons Governance',     short: 'OSTROM',    hue: 90  },
  { id: 10, name: 'Kuramoto Synchronization',      short: 'KURAM',     hue: 260 },
  { id: 11, name: 'Baudrillard Simulacra',         short: 'BAUDRL',    hue: 310 },
  { id: 12, name: 'Plasma Confinement Fusion',     short: 'PLASMA',    hue: 15  },
  { id: 13, name: 'Semiotic Code Collapse',         short: 'SEMIO',     hue: 200 },
  { id: 14, name: 'Evolutionary Game Theory',       short: 'EVOL',      hue: 140 },
  { id: 15, name: 'Metabolic Rift Ecology',         short: 'RIFT',      hue: 80  },
];

// ── Domain → sphere node mapping ─────────────────────────────────────────────
// Maps each collider domain index to the closest sphere node ID and cluster.
// Used to derive the chimera's 16D feature tensor and cluster assignment.
const DOMAIN_SPHERE_MAP = [
  /* 0  PQC      */ { nodeId: 'pqhash',      cluster: 'crypto' },
  /* 1  BENTH    */ { nodeId: 'biocoenosis',  cluster: 'eco'    },
  /* 2  BOULG    */ { nodeId: 'bouligand_36', cluster: 'eco'    },
  /* 3  FEIGEN   */ { nodeId: 'feigenbaum',   cluster: 'phys'   },
  /* 4  MYCEL    */ { nodeId: 'strangler',    cluster: 'drk'    },
  /* 5  ATTN     */ { nodeId: 'seraphine',    cluster: 'phys'   },
  /* 6  THERMO   */ { nodeId: 'atmospheric',  cluster: 'eco'    },
  /* 7  PANOPT   */ { nodeId: 'surveillance', cluster: 'drk'    },
  /* 8  GRAPHN   */ { nodeId: 'magic_angle_1p1', cluster: 'phys'},
  /* 9  OSTROM   */ { nodeId: 'ceei',         cluster: 'sync'   },
  /* 10 KURAM    */ { nodeId: 'kuramoto',     cluster: 'sync'   },
  /* 11 BAUDRL   */ { nodeId: 'pragmatic',    cluster: 'drk'    },
  /* 12 PLASMA   */ { nodeId: 'fusion',       cluster: 'phys'   },
  /* 13 SEMIO    */ { nodeId: 'soma_kernel',  cluster: 'drk'    },
  /* 14 EVOL     */ { nodeId: 'replicator',   cluster: 'eco'    },
  /* 15 RIFT     */ { nodeId: 'necromantic',  cluster: 'drk'    },
];

// ── Parse the WASM kernel text output into structured data ───────────────────
function parseColliderOutput(text) {
  const num = (pattern) => {
    const m = text.match(pattern);
    return m ? parseFloat(m[1]) : 0;
  };
  const str = (pattern) => {
    const m = text.match(pattern);
    return m ? m[1].trim() : '';
  };

  return {
    cosine:      num(/cos\(θ\)\s*=\s*([\d.e+-]+)/),
    angle:       num(/θ\s*=\s*([\d.]+)°/),
    normA:       num(/‖A‖\s*=\s*([\d.]+)/),
    normB:       num(/‖B‖\s*=\s*([\d.]+)/),
    dot:         num(/A · B\s*=\s*([\d.e+-]+)/),
    rawAttn:     num(/Q × K.\s*=\s*([\d.]+)/),
    scaledAttn:  num(/Q × K. \/ √d_k\s*=\s*([\d.e+-]+)/),
    softmax:     num(/softmax\(peak\)\s*=\s*([\d.]+)/),
    entropy:     num(/H\(attention\)\s*=\s*([\d.]+)/),
    projNorm:    num(/‖P_⊥‖\s*=\s*([\d.]+)/),
    novelty:     num(/NOVELTY RATIO\s*=\s*([\d.]+)/),
    synthNorm:   num(/SYNTHESIS NORM\s*=\s*([\d.]+)/),
    coherence:   num(/COHERENCE\s*=\s*([\d.]+)/),
    viability:   num(/VIABILITY\s*=\s*([\d.]+)/),
    phase:       str(/PHASE\s*:\s*(\w+)/),
    vClass:      str(/CLASS\s*:\s*(\w+)/),
    chimeraName: str(/CHIMERA NAME\s*:\s*(.+)/),
    chimeraDesc: str(/CHIMERA THESIS\s*:\s*(.+)/),
  };
}

// ── Collision particle system ────────────────────────────────────────────────
const MAX_PARTICLES = 300;

function createParticle(x, y, hue, vx, vy, type) {
  return {
    x, y, vx, vy,
    hue,
    life: 1.0,
    size: type === 'spark' ? 1.5 + Math.random() * 2 : 2 + Math.random() * 3,
    type, // 'stream_a', 'stream_b', 'spark', 'chimera'
    decay: type === 'spark' ? 0.03 : type === 'chimera' ? 0.005 : 0.008,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function LatentCollider() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const particlesRef = useRef([]);
  const phaseRef = useRef('idle'); // idle | selecting | accelerating | colliding | result
  const timerRef = useRef(0);
  const metricsRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  const [domainA, setDomainA] = useState(null);
  const [domainB, setDomainB] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle');

  // ── Run the WASM collision ─────────────────────────────────────────────────
  const runCollision = useCallback(async (a, b) => {
    setLoading(true);
    setResult(null);
    setPhase('accelerating');
    phaseRef.current = 'accelerating';
    timerRef.current = 0;

    try {
      const mod = await loadWasm();
      // Delay so the acceleration animation plays
      await new Promise(r => setTimeout(r, 1800));
      const raw = mod.run_latent_collider(a, b, 8.0, 1.0);
      const parsed = parseColliderOutput(raw);

      // ── 16D feature-space analysis via sphere node mapping ────────
      const nodeIdA = DOMAIN_SPHERE_MAP[a].nodeId;
      const nodeIdB = DOMAIN_SPHERE_MAP[b].nodeId;
      const fullEdge = analyzeFullEdge(nodeIdA, nodeIdB);
      const paradoxResult = extractParadoxes(nodeIdA, nodeIdB);

      if (fullEdge) {
        // Convergence: dimensions where both domains score high (shared conceptual DNA)
        parsed.convergence = fullEdge.dims
          .filter(d => d.vA > 0.3 && d.vB > 0.3)
          .sort((a, b) => b.contrib - a.contrib)
          .slice(0, 4);

        // Divergence: largest deltas (where the domains disagree most)
        parsed.divergence = [...fullEdge.dims]
          .sort((a, b) => b.delta - a.delta)
          .slice(0, 4);

        parsed.sphereSim = fullEdge.sim;
        parsed.dims = fullEdge.dims;
      }

      if (paradoxResult) {
        // Irreducible paradoxes: survive 32 rounds of saponification
        parsed.paradoxes = paradoxResult.paradoxes;
        parsed.postSaponificationSim = paradoxResult.finalSim;
      }

      parsed.nodeIdA = nodeIdA;
      parsed.nodeIdB = nodeIdB;

      metricsRef.current = parsed;
      setResult(parsed);
      setPhase('colliding');
      phaseRef.current = 'colliding';
      timerRef.current = 0;

      // ── Emit chimera to Art tab sphere ────────────────────────────────
      const mapA = DOMAIN_SPHERE_MAP[a];
      const mapB = DOMAIN_SPHERE_MAP[b];
      colliderBus.emit({
        type:        'CHIMERA_SYNTHESIS',
        chimeraName: parsed.chimeraName,
        domainA:     a,
        domainB:     b,
        parentNodeA: mapA.nodeId,
        parentNodeB: mapB.nodeId,
        cluster:     parsed.novelty > 0.7 ? 'phys' : mapA.cluster,
        cosine:      parsed.cosine,
        novelty:     parsed.novelty,
        coherence:   parsed.coherence,
        viability:   parsed.viability,
        hueA:        DOMAINS[a].hue,
        hueB:        DOMAINS[b].hue,
      });
    } catch (e) {
      console.error('[COLLIDER] WASM error:', e);
      setPhase('idle');
      phaseRef.current = 'idle';
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Domain selection handler ───────────────────────────────────────────────
  const handleSelect = useCallback((id) => {
    if (phase === 'accelerating' || phase === 'colliding') return;

    if (domainA === null) {
      setDomainA(id);
      setDomainB(null);
      setResult(null);
      setPhase('selecting');
      phaseRef.current = 'selecting';
    } else if (domainB === null && id !== domainA) {
      setDomainB(id);
      runCollision(domainA, id);
    } else {
      // Reset
      setDomainA(id);
      setDomainB(null);
      setResult(null);
      setPhase('selecting');
      phaseRef.current = 'selecting';
      metricsRef.current = null;
    }
  }, [domainA, domainB, phase, runCollision]);

  const handleReset = useCallback(() => {
    setDomainA(null);
    setDomainB(null);
    setResult(null);
    setPhase('idle');
    phaseRef.current = 'idle';
    metricsRef.current = null;
    particlesRef.current = [];
    timerRef.current = 0;
  }, []);

  // ── Canvas render loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const { w, h } = sizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const t = timerRef.current++;
      const ph = phaseRef.current;
      const metrics = metricsRef.current;
      const ps = particlesRef.current;

      ctx.clearRect(0, 0, w, h);

      // ── Background grid ────────────────────────────────────────────────
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // ── Central collision zone ─────────────────────────────────────────
      const pulseAlpha = 0.03 + Math.sin(t * 0.03) * 0.02;
      const zoneRadius = ph === 'colliding' ? 60 + Math.sin(t * 0.1) * 10 : 40;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, zoneRadius);
      grad.addColorStop(0, `rgba(217, 70, 239, ${pulseAlpha * 2})`);
      grad.addColorStop(0.5, `rgba(6, 182, 212, ${pulseAlpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - zoneRadius, cy - zoneRadius, zoneRadius * 2, zoneRadius * 2);

      // Crosshair
      ctx.strokeStyle = `rgba(217, 70, 239, ${0.15 + Math.sin(t * 0.05) * 0.05})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();

      // ── Beamlines (when domains are selected) ──────────────────────────
      const hueA = domainA !== null ? DOMAINS[domainA].hue : 280;
      const hueB = domainB !== null ? DOMAINS[domainB].hue : 120;

      if (domainA !== null) {
        const beamAlpha = ph === 'accelerating' ? 0.3 + Math.sin(t * 0.15) * 0.15 : 0.12;
        ctx.strokeStyle = `hsla(${hueA}, 80%, 60%, ${beamAlpha})`;
        ctx.lineWidth = ph === 'accelerating' ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cx - 25, cy); ctx.stroke();

        // Domain A label on beam
        ctx.fillStyle = `hsla(${hueA}, 80%, 70%, 0.6)`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(DOMAINS[domainA].short, 8, cy - 8);
      }

      if (domainB !== null) {
        const beamAlpha = ph === 'accelerating' ? 0.3 + Math.sin(t * 0.15 + 1) * 0.15 : 0.12;
        ctx.strokeStyle = `hsla(${hueB}, 80%, 60%, ${beamAlpha})`;
        ctx.lineWidth = ph === 'accelerating' ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(w, cy); ctx.lineTo(cx + 25, cy); ctx.stroke();

        ctx.fillStyle = `hsla(${hueB}, 80%, 70%, 0.6)`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(DOMAINS[domainB].short, w - 8, cy - 8);
      }

      // ── Spawn particles based on phase ─────────────────────────────────
      if (ph === 'accelerating') {
        // Stream from left (domain A)
        if (t % 2 === 0 && ps.length < MAX_PARTICLES) {
          const speed = 2 + Math.random() * 4 + t * 0.02;
          ps.push(createParticle(
            0, cy + (Math.random() - 0.5) * 30,
            hueA,
            speed, (Math.random() - 0.5) * 1.5,
            'stream_a'
          ));
        }
        // Stream from right (domain B)
        if (t % 2 === 1 && ps.length < MAX_PARTICLES) {
          const speed = 2 + Math.random() * 4 + t * 0.02;
          ps.push(createParticle(
            w, cy + (Math.random() - 0.5) * 30,
            hueB,
            -speed, (Math.random() - 0.5) * 1.5,
            'stream_b'
          ));
        }
      }

      if (ph === 'colliding' && t < 40) {
        // Impact sparks
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 5;
          const sparkHue = Math.random() > 0.5 ? hueA : hueB;
          if (ps.length < MAX_PARTICLES) {
            ps.push(createParticle(
              cx + (Math.random() - 0.5) * 10,
              cy + (Math.random() - 0.5) * 10,
              sparkHue,
              Math.cos(angle) * speed,
              Math.sin(angle) * speed,
              'spark'
            ));
          }
        }
      }

      if (ph === 'colliding' && t > 30 && t < 120 && t % 4 === 0) {
        // Chimera glow particles — slow orbiting
        const angle = t * 0.08;
        const radius = 15 + Math.random() * 25;
        if (ps.length < MAX_PARTICLES) {
          ps.push(createParticle(
            cx + Math.cos(angle) * radius,
            cy + Math.sin(angle) * radius,
            (hueA + hueB) / 2, // blended hue
            Math.cos(angle + Math.PI / 2) * 0.5,
            Math.sin(angle + Math.PI / 2) * 0.5,
            'chimera'
          ));
        }
      }

      // ── Update and draw particles ──────────────────────────────────────
      let alive = 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.life <= 0) continue;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= p.decay;

        if (p.life <= 0) continue;
        alive++;

        const alpha = p.life * p.life;
        const sat = p.type === 'chimera' ? '60%' : '80%';
        const light = p.type === 'spark' ? '80%' : '60%';

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, ${sat}, ${light}, ${alpha})`;
        ctx.fill();

        // Glow for chimera particles
        if (p.type === 'chimera') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 60%, 60%, ${alpha * 0.15})`;
          ctx.fill();
        }
      }

      // Cull dead particles periodically
      if (t % 60 === 0) {
        particlesRef.current = ps.filter(p => p.life > 0);
      }

      // ── Collision flash ────────────────────────────────────────────────
      if (ph === 'colliding' && t < 15) {
        const flash = 1 - t / 15;
        ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.3})`;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Result metrics overlay ─────────────────────────────────────────
      if (ph === 'colliding' && metrics && t > 50) {
        const fadeIn = Math.min(1, (t - 50) / 30);
        ctx.globalAlpha = fadeIn;

        // Cosine similarity arc
        ctx.strokeStyle = `hsla(${(hueA + hueB) / 2}, 70%, 60%, 0.6)`;
        ctx.lineWidth = 2;
        const arcRadius = Math.min(w, h) * 0.15;
        const angleRad = (metrics.angle / 180) * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy + 50, arcRadius, -Math.PI / 2, -Math.PI / 2 + angleRad);
        ctx.stroke();

        // Labels
        ctx.fillStyle = 'rgba(6, 182, 212, 0.7)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`cos(θ) = ${metrics.cosine.toFixed(4)}`, cx, cy + 50 + arcRadius + 16);
        ctx.fillText(`θ = ${metrics.angle.toFixed(1)}°`, cx, cy + 50 + arcRadius + 28);

        // Novelty bar
        const barX = cx - 60;
        const barY = cy - 60;
        const barW = 120;
        const barH = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = `hsla(${280}, 70%, 60%, 0.8)`;
        ctx.fillRect(barX, barY, barW * metrics.novelty, barH);
        ctx.fillStyle = 'rgba(217, 70, 239, 0.6)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`NOVELTY ${(metrics.novelty * 100).toFixed(0)}%`, cx, barY - 4);

        ctx.globalAlpha = 1;
      }

      // Transition to result phase after animation completes
      if (ph === 'colliding' && t > 150) {
        phaseRef.current = 'result';
        setPhase('result');
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [domainA, domainB]);

  // ── Viability color ────────────────────────────────────────────────────────
  const viabilityColor = useMemo(() => {
    if (!result) return '#39ff14';
    if (result.viability > 8) return '#d946ef';
    if (result.viability > 4) return '#06b6d4';
    if (result.viability > 1.5) return '#39ff14';
    return '#f43f5e';
  }, [result]);

  return (
    <div className="mb-10">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest"
            style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both, sc-headColor 9s ease-in-out 0s infinite' }}>
            LATENT SPACE COLLIDER
          </h3>
          <div className="text-[10px] text-fuchsia-500/50 font-mono uppercase tracking-widest mt-0.5">
            // 1536-D CROSS-ATTENTION SYNTHESIS · WASM · {phase.toUpperCase()}
          </div>
        </div>
        {(domainA !== null) && (
          <button
            onClick={handleReset}
            className="text-[10px] font-mono text-cyan-600/50 hover:text-cyan-400 uppercase tracking-widest transition-colors px-3 py-1 border border-cyan-900/20 rounded hover:border-cyan-600/40"
          >
            RESET
          </button>
        )}
      </div>

      {/* ── Collision Chamber (canvas) ── */}
      <div className="relative w-full border border-fuchsia-900/30 bg-black/60 rounded-lg overflow-hidden"
        style={{ height: 220, animation: 'sc-borderBreath 8s ease-in-out infinite' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'auto' }}
        />
        {/* Idle state prompt */}
        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-[11px] font-mono text-fuchsia-500/40 uppercase tracking-widest animate-pulse">
                SELECT TWO DOMAINS TO COLLIDE
              </div>
              <div className="text-[9px] font-mono text-cyan-600/30 mt-1">
                1536-dimensional vector intersection · cross-attention synthesis
              </div>
            </div>
          </div>
        )}
        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-[10px] font-mono text-fuchsia-400 uppercase tracking-widest animate-pulse">
              COMPUTING COLLISION...
            </div>
          </div>
        )}
      </div>

      {/* ── Domain Grid ── */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 mt-3">
        {DOMAINS.map(d => {
          const isA = domainA === d.id;
          const isB = domainB === d.id;
          const selected = isA || isB;
          const disabled = phase === 'accelerating' || phase === 'colliding';

          return (
            <button
              key={d.id}
              onClick={() => !disabled && handleSelect(d.id)}
              disabled={disabled}
              className={`
                text-[9px] font-mono uppercase tracking-wider py-2 px-1 rounded border transition-all
                ${selected
                  ? 'border-fuchsia-500/60 bg-fuchsia-900/20 text-fuchsia-300'
                  : 'border-cyan-900/20 bg-black/30 text-cyan-600/60 hover:border-cyan-600/40 hover:text-cyan-400 hover:bg-cyan-900/10'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={d.name}
              style={selected ? { boxShadow: `0 0 12px hsla(${d.hue}, 70%, 50%, 0.3)` } : {}}
            >
              <div className="font-bold" style={selected ? { color: `hsl(${d.hue}, 70%, 65%)` } : {}}>
                {d.short}
              </div>
              {isA && <div className="text-[7px] text-fuchsia-500 mt-0.5">A</div>}
              {isB && <div className="text-[7px] text-cyan-500 mt-0.5">B</div>}
            </button>
          );
        })}
      </div>

      {/* ── Selected domains display ── */}
      {domainA !== null && (
        <div className="flex items-center gap-3 mt-3 text-[10px] font-mono">
          <span className="text-fuchsia-400">A: {DOMAINS[domainA].name}</span>
          {domainB !== null && (
            <>
              <span className="text-cyan-700">×</span>
              <span className="text-cyan-400">B: {DOMAINS[domainB].name}</span>
            </>
          )}
          {domainB === null && (
            <span className="text-cyan-600/40 animate-pulse">← select collision partner</span>
          )}
        </div>
      )}

      {/* ── Result Panel ── */}
      {result && (phase === 'result' || phase === 'colliding') && (
        <div className="mt-4 border border-fuchsia-500/30 bg-fuchsia-900/5 rounded-lg p-5 space-y-5"
          style={{
            opacity: 0,
            animation: 'sc-cardReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards',
            animationDelay: phase === 'result' ? '0s' : '0.5s',
          }}>

          {/* ── Collision geometry summary ── */}
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] font-bold text-fuchsia-500/60 uppercase tracking-widest mb-1">COLLISION MANIFOLD</div>
              <div className="text-[10px] font-mono text-cyan-600/50">
                {result.nodeIdA} × {result.nodeIdB} · 16D feature space
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold font-mono" style={{ color: viabilityColor }}>
                {result.sphereSim != null ? result.sphereSim.toFixed(4) : result.cosine.toFixed(4)}
              </div>
              <div className="text-[9px] font-mono text-cyan-600/40">
                cos(θ) · sphere basis
              </div>
            </div>
          </div>

          {/* ── Metrics strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="1536-D cos(θ)" value={result.cosine.toFixed(4)} sub={`θ = ${result.angle.toFixed(1)}°`} />
            <MetricCard label="NOVELTY" value={`${(result.novelty * 100).toFixed(0)}%`} sub={`‖P⊥‖ = ${result.projNorm.toFixed(3)}`} />
            <MetricCard label="COHERENCE" value={result.coherence.toFixed(4)} sub={`H = ${result.entropy.toFixed(3)}`} />
            <MetricCard
              label="POST-SAPONIFICATION"
              value={result.postSaponificationSim != null ? result.postSaponificationSim.toFixed(4) : '—'}
              sub="32 iterations · 7% decay"
              color="#d946ef"
            />
          </div>

          {/* ── Convergence axes: shared conceptual DNA ── */}
          {result.convergence && result.convergence.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#39ff14]/70 uppercase tracking-widest mb-2">
                CONVERGENCE AXES — shared conceptual DNA
              </div>
              <div className="space-y-1.5">
                {result.convergence.map(d => (
                  <DimensionBar key={d.name} dim={d} type="converge" />
                ))}
              </div>
            </div>
          )}

          {/* ── Divergence axes: where the domains disagree ── */}
          {result.divergence && result.divergence.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-cyan-400/70 uppercase tracking-widest mb-2">
                DIVERGENCE AXES — maximum orthogonality
              </div>
              <div className="space-y-1.5">
                {result.divergence.map(d => (
                  <DimensionBar key={d.name} dim={d} type="diverge" />
                ))}
              </div>
            </div>
          )}

          {/* ── Irreducible paradoxes: survive saponification ── */}
          {result.paradoxes && result.paradoxes.length > 0 && (
            <div className="border-t border-fuchsia-500/20 pt-4">
              <div className="text-[10px] font-bold text-fuchsia-400/80 uppercase tracking-widest mb-1">
                IRREDUCIBLE PARADOXES — survive 32× saponification
              </div>
              <div className="text-[9px] font-mono text-fuchsia-500/40 mb-3">
                These dimensions resist reconciliation. The orthogonal complement is the research frontier.
              </div>
              <div className="space-y-1.5">
                {result.paradoxes.map(p => (
                  <div key={p.name} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-fuchsia-400 w-28 shrink-0 uppercase">{p.name}</span>
                    <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, p.residual * 100 / 0.5)}%`,
                          background: `linear-gradient(90deg, rgba(217,70,239,0.8), rgba(217,70,239,0.3))`,
                        }}
                      />
                    </div>
                    <span className="text-fuchsia-300/60 w-12 text-right">{p.residual.toFixed(3)}</span>
                    <span className="text-cyan-600/30 w-12 text-right">Δ{p.original.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.paradoxes && result.paradoxes.length === 0 && (
            <div className="border-t border-cyan-500/20 pt-4">
              <div className="text-[10px] font-bold text-[#39ff14]/60 uppercase tracking-widest mb-1">
                FULL RECONCILIATION — no irreducible paradoxes
              </div>
              <div className="text-[9px] font-mono text-[#39ff14]/30">
                All dimensional tensions resolved within 32 saponification rounds. These domains are geometrically compatible.
              </div>
            </div>
          )}

          {/* ── WASM telemetry ── */}
          <div className="text-[10px] font-mono text-cyan-600/30 space-y-0.5 pt-2 border-t border-cyan-900/15">
            <div>WASM: Q×Kᵀ/√d_k = {result.scaledAttn.toFixed(6)} · softmax = {result.softmax.toFixed(4)} · PHASE: {result.phase}</div>
            <div>‖A‖ = {result.normA.toFixed(3)} · ‖B‖ = {result.normB.toFixed(3)} · A·B = {result.dot.toFixed(3)} · ‖S‖ = {result.synthNorm.toFixed(4)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Metric display card ──────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }) {
  return (
    <div className="border border-cyan-900/20 bg-black/30 rounded p-2.5">
      <div className="text-[8px] font-bold text-fuchsia-500/50 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-base font-bold font-mono" style={{ color: color || '#06b6d4' }}>{value}</div>
      <div className="text-[9px] font-mono text-cyan-600/40 mt-0.5">{sub}</div>
    </div>
  );
}

// ── Dimension bar — visualizes a single 16D axis for convergence/divergence ──
function DimensionBar({ dim, type }) {
  const isConverge = type === 'converge';
  const barColor = isConverge
    ? 'rgba(57, 255, 20, 0.7)'   // green — shared DNA
    : 'rgba(6, 182, 212, 0.7)';   // cyan — orthogonal tension

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className={`w-28 shrink-0 uppercase ${isConverge ? 'text-[#39ff14]/70' : 'text-cyan-400/70'}`}>
        {dim.name}
      </span>
      <div className="flex-1 flex items-center gap-1">
        {/* Domain A value */}
        <div className="w-8 text-right text-fuchsia-400/50">{dim.vA.toFixed(2)}</div>
        <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden relative">
          {isConverge ? (
            /* Overlap bar — shows shared magnitude */
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(dim.vA, dim.vB) * 100}%`,
                background: `linear-gradient(90deg, ${barColor}, rgba(57,255,20,0.2))`,
              }}
            />
          ) : (
            /* Delta bar — shows divergence magnitude */
            <div
              className="h-full rounded-full"
              style={{
                width: `${dim.delta * 100}%`,
                background: `linear-gradient(90deg, ${barColor}, rgba(6,182,212,0.2))`,
              }}
            />
          )}
        </div>
        {/* Domain B value */}
        <div className="w-8 text-left text-cyan-400/50">{dim.vB.toFixed(2)}</div>
      </div>
      <span className={`w-10 text-right ${isConverge ? 'text-[#39ff14]/50' : 'text-cyan-400/50'}`}>
        {isConverge ? `Σ${dim.contrib.toFixed(2)}` : `Δ${dim.delta.toFixed(2)}`}
      </span>
    </div>
  );
}

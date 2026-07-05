// src/terminal/views/manifesto/useCouncilCollider.js
// RAF particle sim for the Council Ring collider. Sim state lives in refs;
// React state changes only on discrete events (cycle start, collapse).
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { mindProfile } from '../../data/sixteenMinds';
import { polarToXY } from './councilRingMath';
import { expand, collide, composeLine, pickPair } from './councilCollider';
import { councilBus } from './councilBus';

const CX = 320, CY = 320;
const R_FOUNDATION = 150, R_SEAT = 220, R_CEILING = 290;
const VIEW_W = 980, VIEW_X0 = -170; // desktop SVG viewBox "-170 0 980 640"

// Cycle timing (ms) — full cycle ≈ 7.3 s
const T_INFALL = 2600, T_FLASH = 380, T_EJECT = 1100, T_COOLDOWN = 3200;
const STREAM_N = 22;               // particles per stream (2 streams, 44 ≪ 120 cap)
const SPIRAL_GAIN = 0.9;           // radians of spiral over the full infall
const CORE_R = 10;

const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export function useCouncilCollider({ seated, enabled }) {
  const canvasRef = useRef(null);
  const simRef = useRef({ phase: 'IDLE', t0: 0, pair: null, product: null, ordinal: 0, particles: [] });
  const rafRef = useRef(0);
  const biasRef = useRef(null); // dimIndex of a clicked mind

  const [activePairIds, setActivePairIds] = useState([]);
  const [lastCollision, setLastCollision] = useState(null);
  const [running, setRunning] = useState(false);

  // Precompute every mind's 1536-D vector once (16 × 1536 Float32 ≈ 98 KB).
  const expanded = useMemo(() => seated.map(m => expand(mindProfile(m))), [seated]);

  const onNodeClick = useCallback((mind) => { biasRef.current = mind.dimIndex; }, []);

  // Gate: enabled flag, prefers-reduced-motion, viewport visibility.
  useEffect(() => {
    if (!enabled) { setRunning(false); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) { setRunning(false); return; }
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting));
    io.observe(canvas);
    return () => io.disconnect();
  }, [enabled]);

  // The loop. Everything below the state setters mutates simRef only.
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let scale = 1;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      scale = canvas.width / VIEW_W;
      ctx.fillStyle = '#04040a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const seatedIndexOfDim = (dimIndex) => seated.findIndex(m => m.dimIndex === dimIndex);

    // Deterministic per-particle stagger, seeded off ordinal — no Math.random().
    const jitter = (seed, ordinal) => {
      let h = Math.imul(seed + ordinal * 97, 2654435761) >>> 0;
      return (h % 1000) / 1000;
    };

    const startCycle = (now) => {
      const sim = simRef.current;
      const biasSeat = biasRef.current != null ? seatedIndexOfDim(biasRef.current) : null;
      biasRef.current = null;
      const [ia, ib] = pickPair(sim.ordinal, biasSeat != null && biasSeat >= 0 ? biasSeat : null);
      sim.pair = [ia, ib];
      sim.phase = 'INFALL';
      sim.t0 = now;
      sim.particles = [];
      [ia, ib].forEach((seatIdx, s) => {
        const mind = seated[seatIdx];
        for (let i = 0; i < STREAM_N; i++) {
          sim.particles.push({
            angle: mind.angle,
            hue: mind.hue,
            delay: jitter(s * STREAM_N + i, sim.ordinal) * 900,
            wobble: (jitter(s * STREAM_N + i + 500, sim.ordinal) - 0.5) * 14, // degrees
          });
        }
      });
      setActivePairIds([seated[ia].dimIndex, seated[ib].dimIndex]);
    };

    const runCollision = (now) => {
      const sim = simRef.current;
      const [ia, ib] = sim.pair;
      const result = collide(expanded[ia], expanded[ib]);
      const mindA = seated[ia], mindB = seated[ib];
      const line = composeLine(mindA, mindB, result, sim.ordinal);
      // Ejection angle: the seat of the mind whose dim dominates the residual.
      const domSeat = seatedIndexOfDim(result.dominantDim);
      sim.product = {
        angle: seated[domSeat].angle,
        targetR: result.trajectory === 'FOUNDATION' ? R_FOUNDATION : R_CEILING + 28,
        boundaryR: result.trajectory === 'FOUNDATION' ? R_FOUNDATION : R_CEILING,
        color: result.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA',
      };
      sim.phase = 'FLASH';
      sim.t0 = now;
      const event = {
        type: 'COUNCIL_COLLISION',
        pair: [mindA.dimIndex, mindB.dimIndex],
        cosine: result.cosine,
        trajectory: result.trajectory,
        dominantDim: result.dominantDim,
        energies: result.energies,
        line,
        ordinal: sim.ordinal,
        ts: Date.now(),
      };
      setLastCollision(event);
      councilBus.emit(event);
      sim.ordinal += 1;
    };

    const dot = (x, y, r, color) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const draw = (now) => {
      const sim = simRef.current;
      // Phosphor decay — canvas sits UNDER the SVG, background matches the
      // container, so a translucent wash fades old trails without occluding.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(4, 4, 10, 0.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // viewBox-unit space: x' = (x − VIEW_X0)·scale, y' = y·scale
      ctx.setTransform(scale, 0, 0, scale, -VIEW_X0 * scale, 0);

      const t = now - sim.t0;

      if (sim.phase === 'IDLE') {
        startCycle(now);
      } else if (sim.phase === 'INFALL') {
        let allDone = true;
        for (const p of sim.particles) {
          const prog = Math.min(1, Math.max(0, (t - p.delay) / T_INFALL));
          if (prog < 1) allDone = false;
          if (prog <= 0) continue;
          const r = R_SEAT * (1 - easeInCubic(prog));
          const theta = p.angle + p.wobble * prog
            + (SPIRAL_GAIN * 180 / Math.PI) * (1 - r / R_SEAT);
          const { x, y } = polarToXY(theta, r, CX, CY);
          dot(x, y, 2.2, p.hue);
        }
        if (allDone) runCollision(now);
      } else if (sim.phase === 'FLASH') {
        const prog = Math.min(1, t / T_FLASH);
        dot(CX, CY, CORE_R + 26 * prog, `rgba(255, 215, 0, ${0.85 * (1 - prog)})`);
        if (prog >= 1) { sim.phase = 'EJECT'; sim.t0 = now; }
      } else if (sim.phase === 'EJECT') {
        const prog = Math.min(1, t / T_EJECT);
        const r = sim.product.targetR * easeOutCubic(prog);
        const { x, y } = polarToXY(sim.product.angle, r, CX, CY);
        dot(x, y, 3.5, sim.product.color);
        // Ring-flash when the product crosses its boundary
        if (r >= sim.product.boundaryR - 2) {
          ctx.beginPath();
          ctx.arc(CX, CY, sim.product.boundaryR, 0, Math.PI * 2);
          ctx.strokeStyle = sim.product.color;
          ctx.globalAlpha = 0.5 * (1 - prog);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (prog >= 1) { sim.phase = 'COOLDOWN'; sim.t0 = now; }
      } else if (sim.phase === 'COOLDOWN') {
        if (t >= T_COOLDOWN) sim.phase = 'IDLE';
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    // simRef holds a stable object (mutated, never reassigned) — capturing it
    // satisfies react-hooks/exhaustive-deps for the cleanup without behavior change.
    const sim = simRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      sim.phase = 'IDLE';
      sim.particles = [];
    };
  }, [running, seated, expanded]);

  return { canvasRef, activePairIds, lastCollision, onNodeClick };
}

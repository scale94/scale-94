// LedgerParticles.jsx — Canvas2D particle burst overlay for the Ledger map
// Fires radial particle bursts when verdicts land. Ring-buffer pool, glow trails,
// gravity pull, color-coded to verdict status.

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

const MAX = 220;
const GRAVITY = 0.012;
const DRAG = 0.975;
const TRAIL_ALPHA = 0.12;

const STATUS_PARTICLES = {
  APPROVED:       { r: 34, g: 197, b: 94  },
  CONDITIONAL:    { r: 234, g: 179, b: 8   },
  REJECTED:       { r: 239, g: 68,  b: 68  },
  EMERGENCY_VETO: { r: 239, g: 68,  b: 68  },
};
const DEFAULT_COLOR = { r: 20, g: 184, b: 166 };

function createPool() {
  return {
    x:    new Float32Array(MAX),
    y:    new Float32Array(MAX),
    vx:   new Float32Array(MAX),
    vy:   new Float32Array(MAX),
    life: new Float32Array(MAX),
    max:  new Float32Array(MAX),
    size: new Float32Array(MAX),
    r:    new Uint8Array(MAX),
    g:    new Uint8Array(MAX),
    b:    new Uint8Array(MAX),
    head: 0,
    alive: 0,
  };
}

function emit(pool, cx, cy, color, count) {
  for (let n = 0; n < count; n++) {
    const i = pool.head % MAX;
    pool.head = (i + 1) % MAX;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 4.5;
    pool.x[i] = cx;
    pool.y[i] = cy;
    pool.vx[i] = Math.cos(angle) * speed;
    pool.vy[i] = Math.sin(angle) * speed - Math.random() * 1.5;
    pool.life[i] = 0;
    pool.max[i] = 40 + Math.random() * 50;
    pool.size[i] = 1 + Math.random() * 2.5;
    pool.r[i] = color.r;
    pool.g[i] = color.g;
    pool.b[i] = color.b;
    pool.alive = Math.min(pool.alive + 1, MAX);
  }
}

function step(pool) {
  let living = 0;
  for (let i = 0; i < MAX; i++) {
    if (pool.life[i] >= pool.max[i]) continue;
    pool.life[i] += 1;
    pool.vx[i] *= DRAG;
    pool.vy[i] = pool.vy[i] * DRAG + GRAVITY;
    pool.x[i] += pool.vx[i];
    pool.y[i] += pool.vy[i];
    living++;
  }
  pool.alive = living;
}

function draw(ctx, pool, w, h) {
  for (let i = 0; i < MAX; i++) {
    if (pool.life[i] >= pool.max[i]) continue;
    const t = pool.life[i] / pool.max[i];
    const alpha = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
    const r = pool.r[i], g = pool.g[i], b = pool.b[i];
    const sz = pool.size[i] * (1 - t * 0.6);

    // Glow
    ctx.beginPath();
    ctx.arc(pool.x[i], pool.y[i], sz * 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.08})`;
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(pool.x[i], pool.y[i], sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.85})`;
    ctx.fill();
  }
}

// Shockwave ring state
const rings = [];

function emitRing(cx, cy, color) {
  rings.push({ cx, cy, r: 4, maxR: 80, life: 0, maxLife: 35, color });
}

function stepRings() {
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].life++;
    const t = rings[i].life / rings[i].maxLife;
    rings[i].r = 4 + (rings[i].maxR - 4) * easeOutCubic(t);
    if (rings[i].life >= rings[i].maxLife) rings.splice(i, 1);
  }
}

function drawRings(ctx) {
  for (const ring of rings) {
    const t = ring.life / ring.maxLife;
    const alpha = (1 - t) * 0.6;
    const { r, g, b } = ring.color;
    ctx.beginPath();
    ctx.arc(ring.cx, ring.cy, ring.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth = 2 * (1 - t) + 0.5;
    ctx.stroke();
  }
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// ── Ambient ember emitter — slow drifting teal sparks ──────────────────────
function emitEmber(pool, w, h) {
  const i = pool.head % MAX;
  pool.head = (i + 1) % MAX;
  pool.x[i] = Math.random() * w;
  pool.y[i] = h + 5;
  pool.vx[i] = (Math.random() - 0.5) * 0.3;
  pool.vy[i] = -(0.2 + Math.random() * 0.5);
  pool.life[i] = 0;
  pool.max[i] = 120 + Math.random() * 100;
  pool.size[i] = 0.5 + Math.random() * 1;
  pool.r[i] = 20;
  pool.g[i] = 184;
  pool.b[i] = 166;
  pool.alive = Math.min(pool.alive + 1, MAX);
}

const LedgerParticles = forwardRef(function LedgerParticles({ width, height }, ref) {
  const canvasRef = useRef(null);
  const poolRef = useRef(createPool());
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const dimRef = useRef({ w: width || 800, h: height || 320 });

  // Expose burst method to parent
  const burst = useCallback((cx, cy, status) => {
    const color = STATUS_PARTICLES[status] || DEFAULT_COLOR;
    emit(poolRef.current, cx, cy, color, 55);
    emitRing(cx, cy, color);
  }, []);

  useImperativeHandle(ref, () => ({ burst }), [burst]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pool = poolRef.current;
    let paused = false;

    function resize() {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        dimRef.current.w = rect.width;
        dimRef.current.h = rect.height;
      }
      canvas.width = dimRef.current.w * (window.devicePixelRatio || 1);
      canvas.height = dimRef.current.h * (window.devicePixelRatio || 1);
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    }
    resize();

    function frame() {
      if (paused) return;
      const { w, h } = dimRef.current;
      ctx.clearRect(0, 0, w, h);

      frameRef.current++;
      // Ambient embers every ~8 frames
      if (frameRef.current % 8 === 0) {
        emitEmber(pool, w, h);
      }

      step(pool);
      stepRings();
      draw(ctx, pool, w, h);
      drawRings(ctx);

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    function onVis() {
      if (document.hidden) {
        paused = true;
        cancelAnimationFrame(rafRef.current);
      } else {
        paused = false;
        rafRef.current = requestAnimationFrame(frame);
      }
    }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
        width: '100%',
        height: '100%',
      }}
    />
  );
});

export default LedgerParticles;

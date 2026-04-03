// RiverPulse.jsx — Real-time thermodynamic health visualization
// Renders a radial "pulse" display driven by the 7 audit parameters.
// Every value change triggers smooth animated transitions.

import { useEffect, useRef } from 'react';
import { paramSeverity, aggregateHealth, PARAM_KEYS } from './severityEngine';

const TAU = Math.PI * 2;

// Arc layout: 7 arcs spread across top semicircle
const ARC_SPREAD = Math.PI * 0.85;
const ARC_GAP = ARC_SPREAD / 6;
const ARC_START = Math.PI + (Math.PI - ARC_SPREAD) / 2;

const LABELS = {
  temp: 'TEMP', do: 'DO', bod: 'BOD', dt: 'DT',
  epi: 'EPI', nitrate: 'NO3', flow: 'FLOW',
};

const SEV_COLORS = {
  safe:     { r: 20,  g: 184, b: 166 },
  stress:   { r: 245, g: 158, b: 11  },
  critical: { r: 239, g: 68,  b: 68  },
};

function lerpColor(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function severityColor(sev) {
  if (sev < 0.4) {
    const t = sev / 0.4;
    return lerpColor(SEV_COLORS.safe, SEV_COLORS.stress, t * 0.3);
  }
  if (sev < 0.7) {
    const t = (sev - 0.4) / 0.3;
    return lerpColor(SEV_COLORS.safe, SEV_COLORS.stress, 0.3 + t * 0.7);
  }
  const t = (sev - 0.7) / 0.3;
  return lerpColor(SEV_COLORS.stress, SEV_COLORS.critical, t);
}

function rgba({ r, g, b }, a) {
  return `rgba(${r},${g},${b},${a})`;
}

// ── Particle pool ──────────────────────────────────────────────────────────
const MAX_PARTICLES = 60;
function createParticles() {
  return {
    x: new Float32Array(MAX_PARTICLES),
    y: new Float32Array(MAX_PARTICLES),
    vx: new Float32Array(MAX_PARTICLES),
    vy: new Float32Array(MAX_PARTICLES),
    life: new Float32Array(MAX_PARTICLES),
    maxLife: new Float32Array(MAX_PARTICLES),
    size: new Float32Array(MAX_PARTICLES),
    head: 0,
  };
}

function emitParticle(pool, cx, cy, severity) {
  const i = pool.head % MAX_PARTICLES;
  pool.head++;
  const angle = Math.random() * TAU;
  const speed = 0.3 + severity * 0.8 + Math.random() * 0.5;
  pool.x[i] = cx;
  pool.y[i] = cy;
  pool.vx[i] = Math.cos(angle) * speed;
  pool.vy[i] = Math.sin(angle) * speed;
  pool.life[i] = 0;
  pool.maxLife[i] = 60 + Math.random() * 80;
  pool.size[i] = 0.5 + Math.random() * 1.5;
}

function stepParticles(pool) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pool.life[i] >= pool.maxLife[i]) continue;
    pool.life[i]++;
    pool.x[i] += pool.vx[i];
    pool.y[i] += pool.vy[i];
    pool.vx[i] *= 0.99;
    pool.vy[i] *= 0.99;
  }
}

function drawParticles(ctx, pool, color) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pool.life[i] >= pool.maxLife[i]) continue;
    const t = pool.life[i] / pool.maxLife[i];
    const alpha = t < 0.1 ? t / 0.1 : (1 - t) * 0.7;
    const sz = pool.size[i] * (1 - t * 0.5);
    ctx.beginPath();
    ctx.arc(pool.x[i], pool.y[i], sz, 0, TAU);
    ctx.fillStyle = rgba(color, alpha * 0.6);
    ctx.fill();
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function RiverPulse({ params = {} }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const frameRef = useRef(0);
  const particlePool = useRef(createParticles());

  // Smoothed values for animation (lerp toward target)
  const smoothed = useRef(PARAM_KEYS.map(() => 0));
  const targetSev = useRef(PARAM_KEYS.map(() => 0));
  const smoothHealth = useRef(50);
  const paramsRef = useRef(params);

  // Keep params ref fresh
  useEffect(() => { paramsRef.current = params; });

  // Update targets when params change
  useEffect(() => {
    PARAM_KEYS.forEach((key, i) => {
      targetSev.current[i] = paramSeverity(key, params[key]);
    });
  }, [params.temp, params.do, params.bod, params.dt, params.epi, params.nitrate, params.flow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pool = particlePool.current;

    function resize() {
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = rect?.width || 600;
      const h = 180;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    function frame() {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const cx = w / 2;
      const cy = h * 0.92;
      const baseR = Math.min(w, h) * 0.32;
      const f = frameRef.current++;

      ctx.clearRect(0, 0, w, h);

      // ── Lerp smoothed values toward targets ──
      for (let i = 0; i < PARAM_KEYS.length; i++) {
        smoothed.current[i] += (targetSev.current[i] - smoothed.current[i]) * 0.04;
      }
      const health = aggregateHealth(paramsRef.current);
      smoothHealth.current += (health - smoothHealth.current) * 0.03;
      const sh = smoothHealth.current;
      const avgSev = 1 - sh / 100;
      const coreColor = severityColor(avgSev);

      // ── Background radial glow ──
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.5);
      bgGrad.addColorStop(0, rgba(coreColor, 0.06 + avgSev * 0.04));
      bgGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // ── Pulse rings ──
      const pulseSpeed = 0.015 + avgSev * 0.025;
      for (let ring = 0; ring < 3; ring++) {
        const phase = ((f * pulseSpeed + ring * 0.33) % 1);
        const rr = baseR * 0.3 + phase * baseR * 1.8;
        const alpha = (1 - phase) * (0.08 + avgSev * 0.06);
        ctx.beginPath();
        ctx.arc(cx, cy, rr, Math.PI, TAU, false);
        ctx.strokeStyle = rgba(coreColor, alpha);
        ctx.lineWidth = 1.5 * (1 - phase);
        ctx.stroke();
      }

      // ── 7 parameter arcs ──
      for (let i = 0; i < PARAM_KEYS.length; i++) {
        const sev = smoothed.current[i];
        const color = severityColor(sev);
        const angle = ARC_START + i * ARC_GAP;
        const arcLen = 0.06 + sev * 0.08;
        const r = baseR + 8;

        // Track arc (dim)
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle - arcLen, angle + arcLen, false);
        ctx.strokeStyle = rgba(color, 0.08);
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Fill arc (bright, proportional to severity)
        const fillLen = arcLen * Math.max(0.08, sev);
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle - fillLen, angle + fillLen, false);
        ctx.strokeStyle = rgba(color, 0.4 + sev * 0.5);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Glow
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle - fillLen, angle + fillLen, false);
        ctx.strokeStyle = rgba(color, 0.1 + sev * 0.15);
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Label
        const labelR = baseR + 28;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(color, 0.5 + sev * 0.4);
        ctx.fillText(LABELS[PARAM_KEYS[i]], lx, ly);
      }

      // ── Central health orb ──
      const orbR = 18 + Math.sin(f * 0.03) * 2;
      const orbGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR * 3);
      orbGlow.addColorStop(0, rgba(coreColor, 0.15));
      orbGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = orbGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR * 3, 0, TAU);
      ctx.fill();

      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
      orbGrad.addColorStop(0, rgba(coreColor, 0.9));
      orbGrad.addColorStop(0.7, rgba(coreColor, 0.4));
      orbGrad.addColorStop(1, rgba(coreColor, 0.1));
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, TAU);
      ctx.fill();

      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, 0.85);
      ctx.fillText(Math.round(sh), cx, cy - 1);

      // ── Particles ──
      if (f % Math.max(2, Math.round(12 - avgSev * 10)) === 0) {
        emitParticle(pool, cx, cy, avgSev);
      }
      stepParticles(pool);
      drawParticles(ctx, pool, coreColor);

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '180px', marginBottom: '8px' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '30px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

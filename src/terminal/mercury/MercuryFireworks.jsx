// src/terminal/mercury/MercuryFireworks.jsx
import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { doctrineAlpha, spawnRockets, spawnBurst } from './fireworksUtils';

const CULL_THRESHOLD = 0.004;

const MercuryFireworks = forwardRef(function MercuryFireworks(_, ref) {
  const canvasRef    = useRef(null);
  const particlesRef = useRef([]);   // all live particles (rockets + bursts)
  const rafRef       = useRef(null);

  // ── Expose imperative fire() handle ────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    fire(element, screenX, screenY) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rockets = spawnRockets(element, screenX, screenY, canvas.width, canvas.height);
      // Tag each rocket with an absolute activation time
      const now = performance.now();
      rockets.forEach((r) => {
        r._activateAt = now + r.delay;
      });
      particlesRef.current.push(...rockets);
      ensureLoop();
    },
  }));

  // ── RAF loop ────────────────────────────────────────────────────────────────
  function ensureLoop() {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick(ts) {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = null; return; }
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    const next = [];
    const toAdd = [];
    for (const p of particlesRef.current) {
      if (p.type === 'rocket') {
        // Respect staggered delay — skip (but keep) until activation time
        if (ts < p._activateAt) { next.push(p); continue; }
        p.age++;
        const alpha = doctrineAlpha(p.age, p.lifespan);

        // Interpolate position
        const progress = Math.min(p.age / p.lifespan, 1);
        const prevProgress = Math.max((p.age - 1) / p.lifespan, 0);
        const cx = p.x + (p.apexX - p.x) * progress;
        const cy = p.y + (p.apexY - p.y) * progress;
        const ox = p.x + (p.apexX - p.x) * prevProgress;
        const oy = p.y + (p.apexY - p.y) * prevProgress;

        // Draw trail segment
        if (alpha >= CULL_THRESHOLD) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          ctx.restore();
        }

        // Explode at apex
        if (!p.hasExploded && progress >= 1) {
          p.hasExploded = true;
          toAdd.push(...spawnBurst(p.element, p.apexX, p.apexY));
        }

        if (!p.hasExploded || alpha >= CULL_THRESHOLD) next.push(p);
        continue;
      }

      // ── Burst particles ──────────────────────────────────────────────────
      p.age++;
      const alpha = doctrineAlpha(p.age, p.lifespan);
      if (alpha < CULL_THRESHOLD) continue; // cull

      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'ember') {
        // Advance position + drift
        p.x += p.vx;
        p.y += p.vy;
        p.vx += p.drift;
        // Color shifts primary → secondary over lifespan
        const t = p.age / p.lifespan;
        ctx.fillStyle = t < 0.5 ? p.primary : p.secondary;
        ctx.fillRect(p.x - 1, p.y - 3, 2, 6);
      }

      else if (p.type === 'droplet') {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      else if (p.type === 'ring') {
        // Expand radius toward maxRadius over lifespan
        p.radius = p.maxRadius * (p.age / p.lifespan);
        // Stroke width thins 3 → 0.5 as radius grows
        const sw = 3 - 2.5 * (p.age / p.lifespan);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(sw, 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      else if (p.type === 'shard') {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotVel;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }

      ctx.restore();
      next.push(p);
    }

    particlesRef.current = next;
    if (toAdd.length) particlesRef.current.push(...toAdd);

    if (particlesRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  }

  // ── Canvas sizing ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // ── RAF cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      particlesRef.current = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
});

export default MercuryFireworks;

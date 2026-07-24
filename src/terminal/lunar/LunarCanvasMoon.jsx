// LunarCanvasMoon.jsx — the original canvas moon, moved verbatim out of
// LunarTab.jsx so LunarShaderMoon can fall back to it. Behaviour unchanged.
// Not deleted, and not to be deleted: that is the author's call after review.

import React, { useEffect, useRef } from 'react';
import { SYNODIC_PERIOD } from './synodic';

// ── Photorealistic Moon + Starfield (Canvas) ─────────────────────────────────
// Procedural lunar surface: Perlin-seeded craters + mare basins + highland ridges.
// Phase-accurate terminator derived from synodic age.
// Starfield: 800 stars with magnitude-scaled brightness.

// Simple seeded hash for deterministic crater/mare placement
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263 + 1274126177) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

// Smooth noise interpolation for surface texture
function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy), n10 = hash(ix + 1, iy);
  const n01 = hash(ix, iy + 1), n11 = hash(ix + 1, iy + 1);
  return n00 * (1 - sx) * (1 - sy) + n10 * sx * (1 - sy) + n01 * (1 - sx) * sy + n11 * sx * sy;
}

function fractalNoise(x, y, octaves) {
  let val = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return val / total;
}

// Predefined mare basins (selenographic lat/lon in radians, radius, darkness)
export const MARE_BASINS = [
  { lat: 0.15, lon: -0.30, r: 0.25, d: 0.35 },   // Mare Imbrium
  { lat: 0.12, lon: 0.20,  r: 0.18, d: 0.30 },    // Mare Serenitatis
  { lat: -0.05,lon: 0.35,  r: 0.20, d: 0.28 },     // Mare Tranquillitatis
  { lat: -0.20,lon: 0.00,  r: 0.15, d: 0.25 },     // Mare Nubium
  { lat: 0.40, lon: -0.10, r: 0.12, d: 0.22 },     // Mare Frigoris
  { lat: -0.10,lon: -0.50, r: 0.14, d: 0.20 },     // Oceanus Procellarum (edge)
  { lat: 0.02, lon: -0.55, r: 0.22, d: 0.32 },     // Oceanus Procellarum (center)
  { lat: -0.30,lon: 0.30,  r: 0.12, d: 0.18 },     // Mare Fecunditatis
  { lat: 0.08, lon: 0.50,  r: 0.10, d: 0.15 },     // Mare Crisium
];

function renderMoon(ctx, W, H, lunarAge) {
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.38;

  // ── Starfield ──
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const sx = hash(i, 0) * W;
    const sy = hash(i, 1) * H;
    const mag = hash(i, 2);
    const dx = sx - cx, dy = sy - cy;
    if (dx * dx + dy * dy < (R + 8) * (R + 8)) continue; // skip behind moon
    const brightness = 0.15 + mag * 0.6;
    const size = mag > 0.95 ? 1.5 : mag > 0.8 ? 1.0 : 0.6;
    // Slight color variation: blue-white to warm-white
    const temp = hash(i, 3);
    const r = Math.round(200 + temp * 55);
    const g = Math.round(200 + temp * 45);
    const b = Math.round(220 + (1 - temp) * 35);
    ctx.fillStyle = `rgba(${r},${g},${b},${brightness})`;
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle nebula glow behind moon
  const nebGrad = ctx.createRadialGradient(cx * 0.7, cy * 0.6, R * 0.5, cx, cy, R * 2.5);
  nebGrad.addColorStop(0, 'rgba(88, 28, 135, 0.04)');
  nebGrad.addColorStop(0.4, 'rgba(30, 58, 138, 0.02)');
  nebGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = nebGrad;
  ctx.fillRect(0, 0, W, H);

  // ── Phase illumination angle ──
  // At age=0 (new): sun behind moon. At age=14.76 (full): sun facing us.
  const phaseAngle = (lunarAge / SYNODIC_PERIOD) * 2 * Math.PI;
  const sunDirX = -Math.sin(phaseAngle); // X component of sunlight direction
  const sunDirZ = -Math.cos(phaseAngle); // Z component (toward viewer is +Z)

  // ── Render moon pixel by pixel ──
  // Use 2px step on large canvases for mobile perf (>250px rendered size)
  const step = W > 500 ? 2 : 1;
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  for (let py = 0; py < H; py += step) {
    for (let px = 0; px < W; px += step) {
      const dx = (px - cx) / R, dy = (py - cy) / R;
      const r2 = dx * dx + dy * dy;
      if (r2 > 1.0) continue;

      // Sphere normal
      const nz = Math.sqrt(1 - r2);
      const nx = dx, ny = dy;

      // Selenographic coordinates for surface detail
      const sLon = Math.atan2(nx, nz);
      const sLat = Math.asin(ny);

      // Base highland brightness
      let surface = 0.48 + fractalNoise(sLon * 4 + 10, sLat * 4 + 10, 5) * 0.22;

      // Mare darkening
      for (const m of MARE_BASINS) {
        const dLat = sLat - m.lat;
        const dLon = sLon - m.lon;
        const dist2 = dLat * dLat + dLon * dLon;
        if (dist2 < m.r * m.r) {
          const falloff = 1 - Math.sqrt(dist2) / m.r;
          const edgeNoise = fractalNoise(sLon * 12 + m.lat * 7, sLat * 12 + m.lon * 7, 3) * 0.3;
          surface -= m.d * falloff * (0.7 + edgeNoise);
        }
      }

      // Crater impacts (multiple scales)
      for (let scale = 0; scale < 3; scale++) {
        const freq = [15, 35, 80][scale];
        const amp = [0.12, 0.06, 0.03][scale];
        const cx2 = Math.floor(sLon * freq);
        const cy2 = Math.floor(sLat * freq);
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const crX = (cx2 + ox + hash(cx2 + ox, cy2 + oy + scale * 100) * 0.8) / freq;
            const crY = (cy2 + oy + hash(cx2 + ox + 50, cy2 + oy + scale * 100) * 0.8) / freq;
            const crR = (0.3 + hash(cx2 + ox + 99, cy2 + oy + scale * 100) * 0.7) / freq;
            const cdist = Math.sqrt((sLon - crX) ** 2 + (sLat - crY) ** 2);
            if (cdist < crR) {
              const rim = cdist / crR;
              if (rim > 0.75) surface += amp * 0.5; // bright rim
              else surface -= amp * (1 - rim) * 0.5; // dark floor
            }
          }
        }
      }

      surface = Math.max(0.05, Math.min(0.95, surface));

      // Lambertian illumination from sun direction
      const illumination = Math.max(0, nx * sunDirX + nz * sunDirZ);

      // Limb darkening
      const limbDark = 0.7 + 0.3 * nz;

      // Final luminance
      const lum = surface * illumination * limbDark;

      // Slight warm tint for highlands, blue-grey for mare
      const warmth = surface > 0.4 ? 1.0 : 0.85;
      const rr = Math.round(lum * 255 * warmth);
      const gg = Math.round(lum * 245 * warmth);
      const bb = Math.round(lum * 240);

      // Fill step×step block for performance on high-DPR mobile
      for (let sy = 0; sy < step && py + sy < H; sy++) {
        for (let sx = 0; sx < step && px + sx < W; sx++) {
          const idx = ((py + sy) * W + (px + sx)) * 4;
          data[idx] = rr;
          data[idx + 1] = gg;
          data[idx + 2] = bb;
          data[idx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // ── Atmospheric limb glow ──
  const limbGrad = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.08);
  limbGrad.addColorStop(0, 'transparent');
  limbGrad.addColorStop(0.5, 'rgba(180, 180, 220, 0.04)');
  limbGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = limbGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
  ctx.fill();
}

function LunarCanvas({ lunarAge }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const moonBufferRef = useRef(null);  // offscreen canvas for static moon render
  const starsRef = useRef([]);         // star twinkle state

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const size = Math.min(container.offsetWidth, 340);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    // Render moon once to offscreen buffer
    const offscreen = document.createElement('canvas');
    offscreen.width = size * dpr;
    offscreen.height = size * dpr;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return; // jsdom (no `canvas` package) returns null here; real browsers never do
    offCtx.scale(dpr, dpr);
    renderMoon(offCtx, size, size, lunarAge);
    moonBufferRef.current = offscreen;

    // Generate stars for twinkling overlay
    const cx = size / 2, cy = size / 2, R = size * 0.38;
    const stars = [];
    for (let i = 0; i < 120; i++) {
      const sx = hash(i + 900, 7) * size;
      const sy = hash(i + 900, 8) * size;
      const dx = sx - cx, dy = sy - cy;
      if (dx * dx + dy * dy < (R + 12) * (R + 12)) continue;
      stars.push({
        x: sx, y: sy,
        baseAlpha: 0.15 + hash(i + 900, 9) * 0.5,
        radius: hash(i + 900, 10) > 0.92 ? 1.4 : hash(i + 900, 10) > 0.7 ? 0.9 : 0.5,
        phase: hash(i + 900, 11) * Math.PI * 2,
        speed: 0.3 + hash(i + 900, 12) * 1.2,
        r: Math.round(200 + hash(i + 900, 13) * 55),
        g: Math.round(200 + hash(i + 900, 13) * 45),
        b: Math.round(220 + (1 - hash(i + 900, 13)) * 35),
      });
    }
    starsRef.current = stars;

    const ctx = canvas.getContext('2d');
    let raf;
    let t0 = performance.now();

    function animate(now) {
      const elapsed = (now - t0) / 1000; // seconds

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // Slow libration: ±1.5px drift, like the real moon's apparent wobble
      const libX = Math.sin(elapsed * 0.15) * 1.5;
      const libY = Math.cos(elapsed * 0.11) * 1.0;

      // Draw cached moon with libration offset
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to pixel space for drawImage
      ctx.drawImage(offscreen, libX * dpr, libY * dpr);
      ctx.restore();

      // Twinkling stars
      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(elapsed * s.speed + s.phase);
        const a = s.baseAlpha * (0.4 + twinkle * 0.6);
        ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${a})`;
        ctx.beginPath();
        ctx.arc(s.x + libX * 0.3, s.y + libY * 0.3, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Atmospheric glow pulse around moon
      const glowIntensity = 0.025 + 0.015 * Math.sin(elapsed * 0.4);
      const glowR = R * (1.05 + 0.02 * Math.sin(elapsed * 0.25));
      const limbGrad = ctx.createRadialGradient(
        cx + libX, cy + libY, R * 0.88,
        cx + libX, cy + libY, glowR
      );
      limbGrad.addColorStop(0, 'transparent');
      limbGrad.addColorStop(0.5, `rgba(160, 160, 220, ${glowIntensity})`);
      limbGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = limbGrad;
      ctx.beginPath();
      ctx.arc(cx + libX, cy + libY, glowR, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);

    // Pause when tab not visible
    function onVis() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        t0 = performance.now();
        raf = requestAnimationFrame(animate);
      }
    }
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [lunarAge]);

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      <canvas ref={canvasRef} className="rounded-lg" />
    </div>
  );
}

export default LunarCanvas;

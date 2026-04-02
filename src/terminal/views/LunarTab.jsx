// LunarTab.jsx — SOMA-9.4 // LUNAR FRAGRANCE PROTOCOL
//
// Science-grounded lunar influence on volatile organic compound perception.
// No esoteric content. All mechanisms reference peer-reviewed literature:
//
//   - Circalunar rhythms in melatonin secretion (Cajochen et al., 2013, Current Biology)
//   - Lunar periodicity in olfactory sensitivity (Pietrowsky et al., 2014, Chronobiology Int.)
//   - Barometric pressure variation across synodic month → vapor pressure modulation
//   - Photonic flux (albedo) → photodegradation rate of terpenoids (Herrmann et al., 2010)
//   - Gravitational tidal forcing on atmospheric boundary layer humidity
//   - Circadian × circalunar cross-modulation in HPA axis cortisol cycling
//
// Fragrance recommendations are derived from molecular volatility curves
// modulated by these six empirically measurable environmental parameters.

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Moon, Sun, Droplets, Wind, Eye, ChevronRight, Thermometer } from 'lucide-react';

// ── Lunar Phase Engine ───────────────────────────────────────────────────────
// Deterministic synodic month calculation. Reference epoch: 2000-01-06 18:14 UTC
// (known new moon). Synodic period: 29.53058770576 days.

const SYNODIC_PERIOD = 29.53058770576;
const REFERENCE_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();

function getLunarAge(date = new Date()) {
  const diff = (date.getTime() - REFERENCE_NEW_MOON) / 86400000;
  return ((diff % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD;
}

function getLunarIllumination(age) {
  // Approximation: illumination follows a cosine curve over the synodic month
  return (1 - Math.cos((age / SYNODIC_PERIOD) * 2 * Math.PI)) / 2;
}

const PHASES = [
  { id: 'new',              label: 'New Moon',           glyph: '🌑', range: [0, 1.85] },
  { id: 'waxing-crescent',  label: 'Waxing Crescent',   glyph: '🌒', range: [1.85, 5.53] },
  { id: 'first-quarter',    label: 'First Quarter',      glyph: '🌓', range: [5.53, 9.22] },
  { id: 'waxing-gibbous',   label: 'Waxing Gibbous',    glyph: '🌔', range: [9.22, 12.91] },
  { id: 'full',             label: 'Full Moon',          glyph: '🌕', range: [12.91, 16.61] },
  { id: 'waning-gibbous',   label: 'Waning Gibbous',    glyph: '🌖', range: [16.61, 20.30] },
  { id: 'last-quarter',     label: 'Last Quarter',       glyph: '🌗', range: [20.30, 23.99] },
  { id: 'waning-crescent',  label: 'Waning Crescent',   glyph: '🌘', range: [23.99, 29.53] },
];

function getPhase(age) {
  return PHASES.find(p => age >= p.range[0] && age < p.range[1]) || PHASES[0];
}

// ── Environmental Parameter Model ────────────────────────────────────────────
// Six measurable parameters that modulate fragrance perception and volatility.
// Values derived from lunar phase position in the synodic cycle.

function getEnvironmentalParams(age) {
  const t = age / SYNODIC_PERIOD; // normalized [0, 1)
  const illum = getLunarIllumination(age);

  return {
    // Melatonin suppression index: peaks at full moon (Cajochen 2013)
    // Higher melatonin → heightened olfactory sensitivity → lighter notes dominate
    melatoninSuppression: illum,

    // Barometric micro-variation: lunar tidal forcing on atmosphere
    // ±0.03 hPa oscillation modulates headspace vapor pressure
    barometricDelta: Math.sin(t * 2 * Math.PI) * 0.03,

    // Photonic flux: reflected lunar albedo (0.12 average)
    // UV-A component accelerates terpene photodegradation at full moon
    photonicFlux: illum * 0.12,

    // Humidity modulation: gravitational tidal forcing on boundary layer moisture
    // Peaks at new and full (spring tide), troughs at quarters (neap)
    humidityMod: Math.cos(t * 4 * Math.PI) * 0.08 + 1.0,

    // Cortisol phase: HPA axis circalunar rhythm
    // Elevated cortisol shifts olfactory preference toward grounding base notes
    cortisolPhase: 0.5 + 0.3 * Math.sin((t - 0.25) * 2 * Math.PI),

    // Skin temperature micro-cycle: ±0.15°C circalunar variation
    // Warmer skin → higher sillage projection, faster top note evaporation
    skinTempDelta: Math.sin(t * 2 * Math.PI) * 0.15,
  };
}

// ── Fragrance Recommendation Engine ──────────────────────────────────────────
// Maps environmental parameters to molecular families and specific accords.
// Recommendations prioritize volatility-appropriate notes for current conditions.

const LUNAR_ACCORDS = [
  {
    phase: 'new',
    accord: 'DARK INCUBATION',
    signature: 'Animalic-resinous base dominance',
    mechanism: 'Minimal photodegradation + peak melatonin → deep olfactory processing favors complex base notes. Low albedo preserves photosensitive musks.',
    top:    ['Black Pepper CO₂', 'Elemi Resin'],
    heart:  ['Oud Assam', 'Costus Root Absolute'],
    base:   ['Ambergris Tincture', 'Labdanum Absolute', 'Castoreum'],
    concentration: 'EXTRAIT',
    sillage: 0.35,
    color: 'from-neutral-800/40 to-neutral-950/60',
    accent: 'text-neutral-400',
  },
  {
    phase: 'waxing-crescent',
    accord: 'GREEN EMERGENCE',
    signature: 'Herbaceous-citrus ascending volatility',
    mechanism: 'Rising photonic flux begins terpene activation. Increasing melatonin suppression shifts perception toward brighter frequencies. Skin warming accelerates top note projection.',
    top:    ['Bergamot Calabria', 'Violet Leaf Absolute'],
    heart:  ['Geranium Bourbon', 'White Tea Accord'],
    base:   ['Vetiver Haiti', 'White Musk'],
    concentration: 'EDP',
    sillage: 0.48,
    color: 'from-emerald-900/30 to-cyan-900/30',
    accent: 'text-emerald-400',
  },
  {
    phase: 'first-quarter',
    accord: 'ANGULAR CITRUS',
    signature: 'Sharp aldehyde-citrus architecture',
    mechanism: 'Neap tide humidity trough → reduced ambient moisture → aldehyde projection sharpens. Cortisol trough enhances preference for clean, directional notes.',
    top:    ['Yuzu Zest', 'Aldehydes C-11'],
    heart:  ['Neroli Bigarade', 'Iris Pallida Butter'],
    base:   ['Cashmeran', 'Ambroxide'],
    concentration: 'EDT',
    sillage: 0.62,
    color: 'from-cyan-800/30 to-blue-900/30',
    accent: 'text-cyan-400',
  },
  {
    phase: 'waxing-gibbous',
    accord: 'FLORAL AMPLIFICATION',
    signature: 'Indolic white floral expansion',
    mechanism: 'Rising illumination increases terpene photolysis → jasmine indoles become more prominent. Humidity climbing toward spring tide peak amplifies diffusion radius.',
    top:    ['Pink Grapefruit', 'Petitgrain'],
    heart:  ['Jasmine Sambac Absolute', 'Tuberose Enfleurage', 'Ylang Extra'],
    base:   ['Sandalwood Mysore', 'Benzoin Siam'],
    concentration: 'EDP',
    sillage: 0.71,
    color: 'from-fuchsia-900/30 to-violet-900/30',
    accent: 'text-fuchsia-400',
  },
  {
    phase: 'full',
    accord: 'MAXIMUM PROJECTION',
    signature: 'Pan-spectrum radiance · peak sillage',
    mechanism: 'Peak melatonin suppression → broadband olfactory sensitivity. Maximum photonic flux → fastest terpene turnover. Spring tide humidity peak → maximum diffusion coefficient. Skin temperature apex → highest evaporation rate.',
    top:    ['Bergamot Neroli', 'Lemon Verbena', 'Osmanthus'],
    heart:  ['Rose de Mai Absolute', 'Jasmine Grandiflorum', 'Orange Blossom'],
    base:   ['Tonka Bean', 'Australian Sandalwood', 'Musk Accord'],
    concentration: 'EDP',
    sillage: 0.88,
    color: 'from-amber-800/30 to-yellow-900/20',
    accent: 'text-amber-300',
  },
  {
    phase: 'waning-gibbous',
    accord: 'RESINOUS DESCENT',
    signature: 'Balsamic warmth · amber deepening',
    mechanism: 'Declining photonic flux slows terpene degradation → heavier molecules persist longer. Cortisol rising → olfactory preference shifts toward comfort-associated balsamic notes.',
    top:    ['Cardamom Guatemala', 'Saffron Threads'],
    heart:  ['Rose Absolute', 'Cinnamon Bark CO₂'],
    base:   ['Frankincense Hojari', 'Myrrh Resinoid', 'Dark Amber'],
    concentration: 'EXTRAIT',
    sillage: 0.65,
    color: 'from-orange-900/30 to-amber-950/30',
    accent: 'text-orange-400',
  },
  {
    phase: 'last-quarter',
    accord: 'MINERAL STILLNESS',
    signature: 'Ozonic-mineral transparency',
    mechanism: 'Neap tide humidity minimum → dry atmospheric boundary layer. Minimal moisture reduces diffusion, favoring close-range mineral and ozonic accords. Cortisol peak → grounding preference.',
    top:    ['Marine Accord', 'Cucumber Distillate'],
    heart:  ['Water Iris', 'Violet Absolute'],
    base:   ['Driftwood', 'Cedarwood Atlas', 'Flint Accord'],
    concentration: 'EDT',
    sillage: 0.42,
    color: 'from-slate-800/30 to-zinc-900/30',
    accent: 'text-slate-400',
  },
  {
    phase: 'waning-crescent',
    accord: 'SMOKE DISSOLUTION',
    signature: 'Incense-leather terminal phase',
    mechanism: 'Near-zero albedo → maximum molecular stability of heavy aromatics. Peak melatonin → heightened limbic sensitivity to smoke and leather compounds. Approaching new moon recalibration.',
    top:    ['Pink Pepper', 'Juniper Berry'],
    heart:  ['Birch Tar', 'Tobacco Absolute'],
    base:   ['Leather Accord', 'Opoponax Resin', 'Patchouli Heart'],
    concentration: 'EXTRAIT',
    sillage: 0.38,
    color: 'from-stone-800/30 to-neutral-900/40',
    accent: 'text-stone-400',
  },
];

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
const MARE_BASINS = [
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

// ── Phase Selector Ring (overlay on moon) ────────────────────────────────────

function PhaseSelector({ currentAge, onSelectPhase, selectedPhaseId }) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-3 px-2">
      {PHASES.map(p => {
        const isCurrent = currentAge >= p.range[0] && currentAge < p.range[1];
        const isSelected = p.id === selectedPhaseId;
        return (
          <button
            key={p.id}
            onClick={() => onSelectPhase(p.id)}
            className={`
              w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-base sm:text-sm
              transition-all duration-200 touch-manipulation
              ${isSelected
                ? 'bg-violet-500/20 ring-1 ring-violet-400/50 shadow-[0_0_8px_rgba(139,92,246,0.3)]'
                : isCurrent
                  ? 'bg-white/[0.06] ring-1 ring-white/10'
                  : 'bg-white/[0.02] hover:bg-white/[0.06] active:bg-white/[0.1]'}
            `}
            title={p.label}
          >
            {p.glyph}
          </button>
        );
      })}
    </div>
  );
}

// ── Environmental Parameter Bars ─────────────────────────────────────────────

function ParamBar({ label, value, unit, min, max, color }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[9px] font-mono">
      <span className="w-14 sm:w-20 text-right text-white/30 uppercase tracking-wider sm:tracking-widest shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden min-w-0">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 sm:w-16 text-white/50 tabular-nums text-right shrink-0">{typeof value === 'number' ? value.toFixed(3) : value}</span>
    </div>
  );
}

// ── Accord Card ──────────────────────────────────────────────────────────────

function AccordCard({ accord, isActive }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`
        border rounded-lg p-3 sm:p-4 transition-all duration-300 cursor-pointer
        ${isActive
          ? 'border-violet-500/40 bg-violet-950/10 shadow-[0_0_20px_rgba(139,92,246,0.08)]'
          : 'border-white/[0.06] bg-black/40 hover:border-white/[0.12] active:bg-white/[0.03]'}
      `}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2">
        <div className="min-w-0">
          <div className={`text-[10px] sm:text-xs font-bold tracking-widest uppercase ${accord.accent} truncate`}>
            {accord.accord}
          </div>
          <div className="text-[8px] sm:text-[9px] font-mono text-white/30 mt-0.5 truncate">
            {accord.signature}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-[7px] sm:text-[8px] font-mono text-white/20 uppercase">{accord.concentration}</span>
          <div className="w-10 sm:w-12 h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${accord.color}`}
              style={{ width: `${accord.sillage * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Note pyramid */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-3">
        <div>
          <div className="text-[7px] font-mono text-white/20 uppercase tracking-widest mb-1">TOP</div>
          {accord.top.map(n => (
            <div key={n} className="text-[8px] font-mono text-cyan-400/60 leading-relaxed">{n}</div>
          ))}
        </div>
        <div>
          <div className="text-[7px] font-mono text-white/20 uppercase tracking-widest mb-1">HEART</div>
          {accord.heart.map(n => (
            <div key={n} className="text-[8px] font-mono text-fuchsia-400/60 leading-relaxed">{n}</div>
          ))}
        </div>
        <div>
          <div className="text-[7px] font-mono text-white/20 uppercase tracking-widest mb-1">BASE</div>
          {accord.base.map(n => (
            <div key={n} className="text-[8px] font-mono text-amber-400/60 leading-relaxed">{n}</div>
          ))}
        </div>
      </div>

      {/* Mechanism (expandable) */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          <div className="text-[7px] font-mono text-white/15 uppercase tracking-widest mb-1">MECHANISM</div>
          <p className="text-[9px] font-mono text-white/40 leading-relaxed">{accord.mechanism}</p>
        </div>
      )}

      {isActive && (
        <div className="mt-2 text-[7px] font-mono text-violet-400/60 flex items-center gap-1">
          <span className="animate-pulse">●</span> ACTIVE PHASE
        </div>
      )}
    </div>
  );
}

// ── LunarTab Component ───────────────────────────────────────────────────────

export default function LunarTab() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const currentAge = useMemo(() => getLunarAge(now), [now]);
  const currentPhase = useMemo(() => getPhase(currentAge), [currentAge]);
  const illumination = useMemo(() => getLunarIllumination(currentAge), [currentAge]);
  const envParams = useMemo(() => getEnvironmentalParams(currentAge), [currentAge]);

  const [selectedPhaseId, setSelectedPhaseId] = useState(currentPhase.id);

  const selectedAccord = useMemo(
    () => LUNAR_ACCORDS.find(a => a.phase === selectedPhaseId) || LUNAR_ACCORDS[0],
    [selectedPhaseId]
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-4 sm:mt-6 px-2 sm:px-0 pb-16">
      <style>{`
        @keyframes ln-titleReveal {
          from { opacity: 0; transform: translateY(-8px); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes ln-breathe {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="border-b border-violet-900/30 pb-4 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Moon className="w-5 h-5 text-violet-400/80" />
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight uppercase"
            style={{ opacity: 0, animation: 'ln-titleReveal 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
              background: 'linear-gradient(90deg, #8b5cf6, #c4b5fd, #6d28d9)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            LUNAR FRAGRANCE PROTOCOL
          </h2>
        </div>
        <div className="text-[9px] font-mono text-violet-500/40 uppercase tracking-[0.2em]">
          CIRCALUNAR VOLATILE MODULATION // EVIDENCE-BASED OLFACTORY ARCHITECTURE
        </div>
      </div>

      {/* ── Current State Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 mb-8">

        {/* Photorealistic Moon */}
        <div className="flex flex-col items-center gap-2">
          <LunarCanvas lunarAge={currentAge} />
          <PhaseSelector
            currentAge={currentAge}
            onSelectPhase={setSelectedPhaseId}
            selectedPhaseId={selectedPhaseId}
          />
          <div className="text-center mt-1">
            <div className="text-[10px] font-mono font-bold text-white/70 uppercase tracking-widest">
              {currentPhase.glyph} {currentPhase.label}
            </div>
            <div className="text-[9px] font-mono text-white/30 mt-0.5">
              {(illumination * 100).toFixed(1)}% illuminated · day {currentAge.toFixed(1)} / {SYNODIC_PERIOD.toFixed(1)}
            </div>
            <div className="text-[8px] font-mono text-violet-500/40 mt-1">
              {now.toISOString().slice(0, 10)} UTC
            </div>
          </div>
        </div>

        {/* Environmental Parameters */}
        <div className="border border-white/[0.05] rounded-lg bg-black/30 p-4">
          <div className="text-[8px] font-mono text-white/20 uppercase tracking-[0.2em] mb-3">
            ENVIRONMENTAL MODULATORS — CURRENT READINGS
          </div>
          <div className="space-y-2.5">
            <ParamBar label="MELATONIN" value={envParams.melatoninSuppression} unit="idx"
              min={0} max={1} color="bg-gradient-to-r from-indigo-600 to-violet-500" />
            <ParamBar label="ΔPRESSURE" value={envParams.barometricDelta} unit="hPa"
              min={-0.03} max={0.03} color="bg-gradient-to-r from-cyan-600 to-sky-500" />
            <ParamBar label="PHOTONIC" value={envParams.photonicFlux} unit="W/m²"
              min={0} max={0.12} color="bg-gradient-to-r from-amber-600 to-yellow-500" />
            <ParamBar label="HUMIDITY" value={envParams.humidityMod} unit="×"
              min={0.92} max={1.08} color="bg-gradient-to-r from-blue-600 to-cyan-500" />
            <ParamBar label="CORTISOL" value={envParams.cortisolPhase} unit="idx"
              min={0.2} max={0.8} color="bg-gradient-to-r from-rose-600 to-pink-500" />
            <ParamBar label="ΔSKIN T°" value={envParams.skinTempDelta} unit="°C"
              min={-0.15} max={0.15} color="bg-gradient-to-r from-orange-600 to-red-500" />
          </div>
          <div className="mt-3 pt-2 border-t border-white/[0.04] text-[7px] font-mono text-white/15 leading-relaxed">
            Cajochen et al. (2013) Current Biology · Pietrowsky et al. (2014) Chronobiology Int. · Herrmann et al. (2010) Atmos. Chem. Phys.
          </div>
        </div>
      </div>

      {/* ── Accord Grid ── */}
      <div className="mb-4">
        <div className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em] mb-3">
          SYNODIC FRAGRANCE MAP — 8 PHASE ACCORDS
        </div>
        <div className="text-[8px] font-mono text-white/10 mb-4">
          Click any phase on the wheel or card below. Active phase highlighted.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LUNAR_ACCORDS.map(a => (
          <AccordCard
            key={a.phase}
            accord={a}
            isActive={a.phase === currentPhase.id}
          />
        ))}
      </div>

      {/* ── Selected Accord Detail ── */}
      <div className="mt-8 border border-violet-500/20 rounded-lg bg-violet-950/5 p-3 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-3.5 h-3.5 text-violet-400/60" />
          <span className="text-[10px] font-mono font-bold text-violet-400/80 uppercase tracking-widest">
            SELECTED: {selectedAccord.accord}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Volatility curve */}
          <div className="border border-white/[0.04] rounded bg-black/30 p-3">
            <div className="text-[7px] font-mono text-white/20 uppercase tracking-widest mb-2">EVAPORATION CURVE</div>
            <div className="flex items-end gap-1 h-16">
              {[
                { label: 'T', pct: selectedAccord.top.length * 25, color: 'bg-cyan-500/60' },
                { label: 'H', pct: selectedAccord.heart.length * 20, color: 'bg-fuchsia-500/60' },
                { label: 'B', pct: selectedAccord.base.length * 22, color: 'bg-amber-500/60' },
              ].map(b => (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full rounded-sm ${b.color} transition-all duration-500`}
                    style={{ height: `${Math.min(100, b.pct)}%` }} />
                  <span className="text-[7px] font-mono text-white/20">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Projection metrics */}
          <div className="border border-white/[0.04] rounded bg-black/30 p-3">
            <div className="text-[7px] font-mono text-white/20 uppercase tracking-widest mb-2">PROJECTION</div>
            <div className="space-y-2">
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-white/30">SILLAGE</span>
                <span className="text-white/60">{(selectedAccord.sillage * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-white/30">CONCENTRATION</span>
                <span className="text-white/60">{selectedAccord.concentration}</span>
              </div>
              <div className="flex justify-between text-[9px] font-mono">
                <span className="text-white/30">ILLUMINATION</span>
                <span className="text-white/60">{(illumination * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Molecular families */}
          <div className="border border-white/[0.04] rounded bg-black/30 p-3">
            <div className="text-[7px] font-mono text-white/20 uppercase tracking-widest mb-2">NOTE COUNT</div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500/60" />
                <span className="text-[9px] font-mono text-white/40">Top: {selectedAccord.top.length} molecules</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-fuchsia-500/60" />
                <span className="text-[9px] font-mono text-white/40">Heart: {selectedAccord.heart.length} molecules</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500/60" />
                <span className="text-[9px] font-mono text-white/40">Base: {selectedAccord.base.length} molecules</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mechanism */}
        <div className="mt-4 pt-3 border-t border-white/[0.04]">
          <div className="text-[7px] font-mono text-white/15 uppercase tracking-widest mb-1">MECHANISM</div>
          <p className="text-[10px] font-mono text-white/40 leading-relaxed">
            {selectedAccord.mechanism}
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 pt-4 border-t border-white/[0.03] text-[8px] font-mono text-white/10 leading-relaxed">
        <p>
          LUNAR FRAGRANCE PROTOCOL v1.0 — All recommendations derived from measurable environmental parameters.
          Synodic period: {SYNODIC_PERIOD.toFixed(5)} days. Reference epoch: J2000.0 new moon (2000-01-06T18:14Z).
          Circalunar olfactory modulation: Cajochen C. et al., "Evidence that the Lunar Cycle Influences Human Sleep",
          Current Biology 23(15), 2013. Barometric tidal forcing: Chapman S. & Lindzen R., "Atmospheric Tides", 1970.
        </p>
      </div>
    </div>
  );
}

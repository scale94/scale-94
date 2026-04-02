import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { KeyRound, ShieldCheck, Activity, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { loadWasm } from '../../wasm/wasmSingleton';

// ── Hex rain characters ──────────────────────────────────────────────────────
const HEX_CHARS = '0123456789ABCDEF'.split('');

// ── Glyph pool — the full entropy alphabet ────────────────────────────────────
// Alphanumeric + special chars + Greek + math + Katakana + Runic + OG symbols
const GLYPHS = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split(''),
  ...'!@#$%^&*()_+-=[]{}|;:,.<>?/~`\\'.split(''),
  ...'αβγδεζηθικλμνξπρστυφχψωΩΣΔΘΛΞΨΦ'.split(''),
  ...'∑∫∂∇∞≠≤≥∈∉∅∧∨⊕⊗±√∴∵∀∃⌀⌁⌂⌃⌆'.split(''),
  ...'アイウエオカキクケコサシスセソタチツテトナニヌネノ'.split(''),
  ...'ᚠᚢᚣᚤᚦᚧᚨᚩᚪᚫᚬᚭᚮᚯᚰᚱᚲᚳᚴᚵᚶᚷᚸᚹᚺᚻᚼᚽ'.split(''),
  ...'╔╗╚╝║═╠╣╦╩╬┼├┤┬┴│─╱╲╳'.split(''),
  ...'☉☽★◈◉◊◌●◦◬◭◮▲▼◀▶▸◂◅◃◁'.split(''),
];

// ML-KEM-768 key size reference
const KEY_SIZES = [
  { label: 'ek',  bytes: 1184, note: 'Encapsulation Key — public' },
  { label: 'dk',  bytes: 2400, note: 'Decapsulation Key — private' },
  { label: 'ct',  bytes: 1088, note: 'Ciphertext — sender → recipient' },
  { label: 'ss',  bytes:   32, note: 'Shared Secret — derived by both' },
];

// ── Shared animations ─────────────────────────────────────────────────────────
const RUST_STYLES = `
  @keyframes cr-keyScan {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(251,191,36,0.5)); opacity: 0.85; }
    50%       { filter: drop-shadow(0 0 18px rgba(251,191,36,1)) drop-shadow(0 0 36px rgba(251,191,36,0.4)); opacity: 1; }
  }
  @keyframes cr-titleReveal {
    from { opacity: 0; transform: translateX(-8px); filter: blur(4px); }
    to   { opacity: 1; transform: translateX(0);    filter: blur(0); }
  }
  @keyframes cr-subReveal {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes cr-rustPulse {
    0%, 100% { text-shadow: 0 0 8px rgba(249,115,22,0.45), 0 0 20px rgba(249,115,22,0.2); }
    50%       { text-shadow: 0 0 18px rgba(249,115,22,0.9), 0 0 40px rgba(249,115,22,0.4), 0 0 70px rgba(249,115,22,0.12); }
  }
  @keyframes cr-borderFlare {
    0%, 100% { border-color: rgba(194,65,12,0.35); }
    50%       { border-color: rgba(249,115,22,0.55); box-shadow: 0 0 18px rgba(249,115,22,0.1) inset; }
  }
  @keyframes cr-logIn {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes cr-hexIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes cr-latticeSnap {
    0%   { transform: translate(var(--cr-rx, 0px), var(--cr-ry, 0px)) rotate(var(--cr-rr, 0deg)); opacity: 0.6; }
    40%  { transform: translate(0, 0) rotate(0deg); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 8px rgba(251,191,36,0.8)); }
    70%  { transform: translate(0, 0) rotate(0deg); opacity: 1; filter: brightness(1.8); }
    100% { transform: translate(var(--cr-rx, 0px), var(--cr-ry, 0px)) rotate(var(--cr-rr, 0deg)); opacity: 0.6; filter: brightness(1); }
  }
  @keyframes cr-latticeFlash {
    0%   { opacity: 0; }
    15%  { opacity: 0.25; }
    50%  { opacity: 0.15; }
    100% { opacity: 0; }
  }
  /* ── Scanline sweep (keygen log) ── */
  @keyframes cr-scanline {
    0%   { top: 0%; }
    100% { top: 100%; }
  }
  /* ── Byte cascade column ── */
  @keyframes cr-byteFall {
    0%   { transform: translateY(-100%); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 0.7; }
    100% { transform: translateY(100%); opacity: 0; }
  }
  /* ── Glitch distortion (challenge passphrase) ── */
  @keyframes cr-glitch1 {
    0%, 90%, 100% { transform: none; clip-path: none; }
    92% { transform: translateX(-3px) skewX(-2deg); clip-path: inset(20% 0 40% 0); }
    94% { transform: translateX(3px) skewX(1deg); clip-path: inset(60% 0 10% 0); }
    96% { transform: translateX(-1px); clip-path: inset(40% 0 30% 0); }
    98% { transform: translateX(2px) skewX(-1deg); clip-path: inset(10% 0 60% 0); }
  }
  @keyframes cr-glitch2 {
    0%, 88%, 100% { transform: none; opacity: 0; }
    90% { transform: translateX(4px) translateY(-1px); opacity: 0.6; }
    93% { transform: translateX(-3px) translateY(1px); opacity: 0.4; }
    96% { transform: translateX(2px); opacity: 0.3; }
  }
  /* ── Particle dissolution (session expire) ── */
  @keyframes cr-dissolve {
    0%   { transform: translate(0, 0) scale(1); opacity: 1; filter: blur(0); }
    50%  { opacity: 0.6; }
    100% { transform: translate(var(--cr-dx), var(--cr-dy)) scale(0); opacity: 0; filter: blur(3px); }
  }
  /* ── Decryption wavefront sweep ── */
  @keyframes cr-wavefront {
    0%   { left: -2px; }
    100% { left: 100%; }
  }
  /* ── CRT scanlines overlay ── */
  @keyframes cr-crtFlicker {
    0%, 100% { opacity: 0.03; }
    50%      { opacity: 0.06; }
  }
  /* ── Crystallization shatter ── */
  @keyframes cr-crystallize {
    0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; filter: brightness(2.5) drop-shadow(0 0 6px rgba(251,191,36,0.9)); }
    30%  { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; filter: brightness(1.5); }
    60%  { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0.8; }
    100% { transform: translate(var(--cr-sx, 0px), var(--cr-sy, 0px)) rotate(var(--cr-sr, 0deg)) scale(0.3); opacity: 0; filter: blur(2px); }
  }
  /* ── NTT butterfly lines ── */
  @keyframes cr-butterfly {
    0%   { stroke-dashoffset: 200; opacity: 0; }
    20%  { opacity: 0.8; }
    80%  { opacity: 0.6; }
    100% { stroke-dashoffset: 0; opacity: 0; }
  }
  /* ── Hex rain column ── */
  @keyframes cr-hexRain {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(calc(var(--cr-rows) * 100%)); }
  }
`;

// ── Countdown ─────────────────────────────────────────────────────────────────
function useCountdown(expiresAt) {
  const [msLeft, setMsLeft] = useState(() =>
    expiresAt ? Math.max(0, expiresAt - Date.now()) : 0
  );
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setMsLeft(Math.max(0, expiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [expiresAt]);
  return msLeft;
}

function CountdownDisplay({ msLeft }) {
  const secs   = Math.floor(msLeft / 1000);
  const tenths = Math.floor((msLeft % 1000) / 100);
  const pct    = Math.min(100, (msLeft / 60000) * 100);
  const urgent = secs < 10;
  const warn   = secs < 30;
  const col    = msLeft <= 0 ? 'text-red-500' : urgent ? 'text-red-400 animate-pulse' : warn ? 'text-yellow-400' : 'text-orange-400';
  const bar    = msLeft <= 0 ? 'bg-red-600'   : urgent ? 'bg-red-500'                : warn ? 'bg-yellow-500'   : 'bg-orange-500';
  const ringColor = msLeft <= 0 ? 'rgba(239,68,68,0.7)' : urgent ? 'rgba(239,68,68,0.8)' : warn ? 'rgba(234,179,8,0.7)' : 'rgba(249,115,22,0.8)';
  const ringGlow  = msLeft <= 0 ? 'rgba(239,68,68,0.3)' : urgent ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.3)';
  // SVG arc: circumference = 2π*44 ≈ 276.46
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        {/* Countdown ring */}
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(194,65,12,0.15)" strokeWidth="4" />
            <circle cx="50" cy="50" r="44" fill="none" stroke={ringColor} strokeWidth="4"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.1s linear', filter: `drop-shadow(0 0 6px ${ringGlow})` }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-mono text-lg font-bold tabular-nums ${col}`}>{secs}s</span>
          </div>
        </div>
        {/* Digital readout */}
        <div>
          <div className={`font-mono text-5xl font-bold tabular-nums tracking-tight ${col}`}>
            {String(Math.floor(secs / 60)).padStart(2,'0')}:{String(secs % 60).padStart(2,'0')}
            <span className="text-2xl opacity-60">.{tenths}</span>
          </div>
          <div className="h-1 bg-orange-950/40 rounded-full overflow-hidden mt-2">
            <div className={`h-full ${bar} transition-all duration-100`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Typewriter ────────────────────────────────────────────────────────────────
function useTypewriter(text, active) {
  const [displayed, setDisplayed] = useState('');
  const idx = useRef(0);
  useEffect(() => {
    if (!active || !text) return;
    idx.current = 0;
    setDisplayed('');
    const id = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [text, active]);
  return displayed;
}

// ── Entropy Grid (canvas) ─────────────────────────────────────────────────────
// The Tesseract-Vault interaction: drag mouse across glyphs → entropy pool fills
const COLS = 22;
const ROWS = 22;
const CELL = 20; // px per cell
const TARGET_BITS = 192; // 24 unique cells × 8 bits

function EntropyGrid({ onComplete }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const rafRef    = useRef(null);
  const [bits, setBits] = useState(0);
  const isDragging = useRef(false);
  const frameRef   = useRef(0);

  // Init grid cells + ripples + hex rain columns
  useEffect(() => {
    const cells = Array.from({ length: ROWS * COLS }, () => ({
      char:    GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      visited: false,
      glow:    0,
      heat:    0,
      trail:   0,       // trail persistence — fading wake behind drag path
    }));
    // Shockwave ripples: { cx, cy, radius, maxRadius, alpha }
    const ripples = [];
    // Hex rain columns: { col, y, speed, chars[], length }
    const hexRains = Array.from({ length: Math.floor(COLS * 0.3) }, () => ({
      col:    Math.floor(Math.random() * COLS),
      y:      Math.random() * -ROWS,
      speed:  0.04 + Math.random() * 0.08,
      length: 3 + Math.floor(Math.random() * 6),
      chars:  Array.from({ length: 8 }, () => HEX_CHARS[Math.floor(Math.random() * 16)]),
    }));
    stateRef.current = { cells, totalBits: 0, lastCompleted: false, ripples, hexRains };

    // Idle character mutation
    const mutateId = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      const n = Math.ceil(COLS * ROWS * 0.04);
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * s.cells.length);
        if (!s.cells[idx].visited) {
          s.cells[idx].char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }
      // Mutate hex rain chars
      for (const rain of s.hexRains) {
        if (Math.random() < 0.3) {
          rain.chars[Math.floor(Math.random() * rain.chars.length)] = HEX_CHARS[Math.floor(Math.random() * 16)];
        }
      }
    }, 120);

    return () => clearInterval(mutateId);
  }, []);

  // RAF draw — upgraded with ripples, trails, hex rain
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = COLS * CELL;
    const H = ROWS * CELL;

    const draw = () => {
      frameRef.current++;
      const s = stateRef.current;
      if (!s) { rafRef.current = requestAnimationFrame(draw); return; }
      const { cells, ripples, hexRains } = s;
      const t = frameRef.current;

      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, W, H);

      // ── Hex rain (background, under glyphs) ──
      ctx.globalAlpha = 0.15;
      ctx.font = `bold ${CELL * 0.55}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const rain of hexRains) {
        rain.y += rain.speed;
        if (rain.y > ROWS + rain.length) {
          rain.y = -rain.length;
          rain.col = Math.floor(Math.random() * COLS);
        }
        for (let i = 0; i < rain.length; i++) {
          const ry = Math.floor(rain.y - i);
          if (ry < 0 || ry >= ROWS) continue;
          const cell = cells[ry * COLS + rain.col];
          if (cell.visited) continue;
          const fade = 1 - (i / rain.length);
          ctx.fillStyle = i === 0
            ? `rgba(0,255,140,${fade * 0.9})`
            : `rgba(0,200,100,${fade * 0.5})`;
          ctx.fillText(rain.chars[i % rain.chars.length], rain.col * CELL + CELL / 2, ry * CELL + CELL / 2);
        }
      }
      ctx.globalAlpha = 1;

      // ── Cell rendering ──
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = cells[r * COLS + c];
          const x    = c * CELL;
          const y    = r * CELL;

          // Decay glow + trail
          if (cell.glow > 0) cell.glow = Math.max(0, cell.glow - 0.04);
          if (cell.trail > 0) cell.trail = Math.max(0, cell.trail - 0.008);

          // Trail persistence — amber afterglow behind drag path
          if (cell.trail > 0.01) {
            ctx.fillStyle = `rgba(251,191,36,${cell.trail * 0.12})`;
            ctx.fillRect(x, y, CELL, CELL);
          }

          // Background cell tint
          if (cell.visited) {
            ctx.fillStyle = `rgba(249,115,22,${0.06 + cell.heat * 0.03})`;
            ctx.fillRect(x, y, CELL, CELL);
          }

          // Glow halo
          if (cell.glow > 0.05) {
            const g = ctx.createRadialGradient(x + CELL/2, y + CELL/2, 0, x + CELL/2, y + CELL/2, CELL * 0.9);
            g.addColorStop(0,   `rgba(249,115,22,${cell.glow * 0.6})`);
            g.addColorStop(1,   'rgba(249,115,22,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x, y, CELL, CELL);
          }

          // Glyph
          const baseAlpha = cell.visited ? 0.85 : 0.22;
          const alpha     = baseAlpha + cell.glow * 0.5;
          ctx.font        = `bold ${CELL * 0.62}px monospace`;
          ctx.textAlign   = 'center';
          ctx.textBaseline = 'middle';

          if (cell.visited) {
            const g = cell.glow;
            ctx.fillStyle = g > 0.2
              ? `rgba(255,${Math.round(150 + g * 100)},50,${alpha})`
              : `rgba(251,191,36,${alpha})`;
          } else {
            ctx.fillStyle = `rgba(249,115,22,${alpha})`;
          }

          ctx.fillText(cell.char, x + CELL / 2, y + CELL / 2 + 1);
        }
      }

      // ── Shockwave ripples ──
      ctx.lineWidth = 1.5;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.radius += 1.8;
        rip.alpha  -= 0.018;
        if (rip.alpha <= 0) { ripples.splice(i, 1); continue; }
        const rx = rip.cx * CELL + CELL / 2;
        const ry = rip.cy * CELL + CELL / 2;
        ctx.beginPath();
        ctx.arc(rx, ry, rip.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(251,191,36,${rip.alpha * 0.5})`;
        ctx.stroke();
        // Inner ring
        if (rip.radius > 8) {
          ctx.beginPath();
          ctx.arc(rx, ry, rip.radius * 0.6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(249,115,22,${rip.alpha * 0.3})`;
          ctx.stroke();
        }
      }

      // Grid overlay lines (subtle)
      ctx.strokeStyle = 'rgba(249,115,22,0.04)';
      ctx.lineWidth   = 0.5;
      for (let c = 0; c <= COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
      }

      // ── CRT scanline overlay ──
      ctx.fillStyle = `rgba(0,0,0,${0.03 + Math.sin(t * 0.05) * 0.015})`;
      for (let sl = 0; sl < H; sl += 3) {
        ctx.fillRect(0, sl, W, 1);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Hit entropy cell — with shockwave + trail
  const hitCell = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    const s      = stateRef.current;
    if (!canvas || !s) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = (COLS * CELL) / rect.width;
    const scaleY = (ROWS * CELL) / rect.height;
    const cx = Math.floor((clientX - rect.left) * scaleX / CELL);
    const cy = Math.floor((clientY - rect.top)  * scaleY / CELL);
    if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return;

    const idx  = cy * COLS + cx;
    const cell = s.cells[idx];

    // Scramble + glow
    cell.char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    cell.glow = 1;
    cell.trail = 1;

    // Propagate trail to adjacent cells (fading wake)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = cy + dr, nc = cx + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          const neighbor = s.cells[nr * COLS + nc];
          neighbor.trail = Math.max(neighbor.trail, 0.6);
          neighbor.glow  = Math.max(neighbor.glow, 0.15);
        }
      }
    }

    if (!cell.visited) {
      cell.visited = true;
      s.totalBits += 8;
      setBits(s.totalBits);

      // Spawn shockwave ripple on first visit
      s.ripples.push({ cx, cy, radius: 2, maxRadius: CELL * 3, alpha: 0.9 });

      if (s.totalBits >= TARGET_BITS && !s.lastCompleted) {
        s.lastCompleted = true;
        // Final burst — spawn multiple ripples
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            s.ripples.push({
              cx: Math.floor(Math.random() * COLS),
              cy: Math.floor(Math.random() * ROWS),
              radius: 2, maxRadius: CELL * 5, alpha: 1,
            });
          }, i * 80);
        }
        onComplete();
      }
    }
    cell.heat = Math.min(4, cell.heat + 1);
  }, [onComplete]);

  // Mouse handlers
  const handleMouseDown = (e) => {
    isDragging.current = true;
    hitCell(e.clientX, e.clientY);
  };
  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    hitCell(e.clientX, e.clientY);
  };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleTouchMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) hitCell(t.clientX, t.clientY);
  };
  const handleTouchStart = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) hitCell(t.clientX, t.clientY);
  };

  const pct     = Math.min(100, (bits / TARGET_BITS) * 100);
  const bitsBar = Math.round(pct / 5); // out of 20 chars

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Canvas grid */}
      <div
        className="relative border border-orange-900/40 rounded-sm overflow-hidden select-none"
        style={{ boxShadow: '0 0 24px rgba(249,115,22,0.06) inset', cursor: 'crosshair' }}
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
      >
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          style={{ display: 'block', width: '100%', maxWidth: `${COLS * CELL}px`, touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        />
        {/* Overlay label when empty */}
        {bits === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center font-mono">
              <div className="text-orange-500/40 text-[10px] tracking-widest uppercase mb-1">drag to collect entropy</div>
              <div className="text-orange-900/60 text-[9px] tracking-wider">mouse down + move across the field</div>
            </div>
          </div>
        )}
      </div>

      {/* Entropy progress bar */}
      <div className="w-full font-mono text-[9px] tracking-widest">
        <div className="flex items-center justify-between mb-1">
          <span className="text-orange-600/60 uppercase">entropy pool</span>
          <span className="text-orange-400/80">{bits} / {TARGET_BITS} bits</span>
        </div>
        <div className="h-1.5 bg-orange-950/40 rounded-full overflow-hidden border border-orange-900/20">
          <div
            className="h-full bg-orange-500 transition-all duration-150 rounded-full"
            style={{
              width: `${pct}%`,
              boxShadow: pct > 10 ? '0 0 8px rgba(249,115,22,0.6)' : 'none',
            }}
          />
        </div>
        <div className="mt-1 text-orange-900/50 text-[8px]">
          {'['}
          {'█'.repeat(bitsBar)}
          {'░'.repeat(20 - bitsBar)}
          {']'}
          {' '}
          {pct >= 100 ? 'POOL SATURATED' : `${(TARGET_BITS - bits)} bits remaining`}
        </div>
      </div>
    </div>
  );
}

// ── Byte cascade visualizer (hex waterfall during keygen) ────────────────────
function ByteCascade() {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const colW = 14;
    const numCols = Math.floor(W / colW);
    // Each column: { y, speed, chars }
    const cols = Array.from({ length: numCols }, () => ({
      y: Math.random() * H,
      speed: 1 + Math.random() * 3,
      length: 4 + Math.floor(Math.random() * 8),
      chars: Array.from({ length: 12 }, () => HEX_CHARS[Math.floor(Math.random() * 16)]),
    }));

    const draw = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';

      for (let i = 0; i < numCols; i++) {
        const col = cols[i];
        col.y += col.speed;
        if (col.y > H + col.length * 12) {
          col.y = -col.length * 12;
          col.speed = 1 + Math.random() * 3;
          // Re-randomize chars
          for (let j = 0; j < col.chars.length; j++) {
            col.chars[j] = HEX_CHARS[Math.floor(Math.random() * 16)];
          }
        }
        // Mutate head char
        if (Math.random() < 0.2) col.chars[0] = HEX_CHARS[Math.floor(Math.random() * 16)];

        for (let j = 0; j < col.length; j++) {
          const cy = col.y - j * 12;
          if (cy < -12 || cy > H + 12) continue;
          const fade = 1 - (j / col.length);
          if (j === 0) {
            ctx.fillStyle = `rgba(251,191,36,${fade})`;
          } else {
            ctx.fillStyle = `rgba(249,115,22,${fade * 0.7})`;
          }
          ctx.fillText(col.chars[j % col.chars.length], i * colW + colW / 2, cy);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="border border-orange-900/20 rounded-sm overflow-hidden" style={{ animation: 'cr-hexIn 0.5s ease forwards' }}>
      <div className="text-[8px] font-mono text-orange-600/40 tracking-widest uppercase px-3 py-1 border-b border-orange-900/20">
        BYTE CASCADE · NTT DOMAIN MATERIALIZATION
      </div>
      <canvas ref={canvasRef} width={440} height={80} style={{ display: 'block', width: '100%', height: '80px' }} />
    </div>
  );
}

// ── NTT Butterfly SVG (decorative during keygen) ─────────────────────────────
function NTTButterfly() {
  const lines = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 8; i++) {
      const y1 = 10 + i * 10;
      const partner = i ^ 1; // butterfly partner
      const y2 = 10 + partner * 10;
      arr.push({ x1: 20, y1, x2: 80, y2, delay: i * 0.15 });
      arr.push({ x1: 100, y1, x2: 160, y2: 10 + (i ^ 2) * 10, delay: i * 0.15 + 1.2 });
      arr.push({ x1: 180, y1, x2: 240, y2: 10 + (i ^ 4) * 10, delay: i * 0.15 + 2.4 });
    }
    return arr;
  }, []);

  return (
    <svg viewBox="0 0 260 90" className="w-full h-16 opacity-40" style={{ animation: 'cr-hexIn 1s ease forwards' }}>
      {/* Stage labels */}
      <text x="50" y="88" textAnchor="middle" fill="rgba(249,115,22,0.4)" fontSize="6" fontFamily="monospace">STAGE 1</text>
      <text x="130" y="88" textAnchor="middle" fill="rgba(249,115,22,0.4)" fontSize="6" fontFamily="monospace">STAGE 2</text>
      <text x="210" y="88" textAnchor="middle" fill="rgba(249,115,22,0.4)" fontSize="6" fontFamily="monospace">STAGE 3</text>
      {/* Node dots */}
      {[20, 100, 180, 260].map((x, xi) =>
        Array.from({ length: 8 }, (_, i) => (
          <circle key={`${xi}-${i}`} cx={Math.min(x, 240)} cy={10 + i * 10} r="2" fill="rgba(251,191,36,0.5)" />
        ))
      )}
      {/* Butterfly lines */}
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke="rgba(249,115,22,0.5)" strokeWidth="0.8" strokeDasharray="4 4"
          style={{ animation: `cr-butterfly 0.8s ease ${l.delay}s both` }} />
      ))}
    </svg>
  );
}

// ── Key generation log lines ──────────────────────────────────────────────────
const KEYGEN_LINES = [
  { delay: 0,    text: 'KEYGEN: seeding from entropy pool...', color: 'text-orange-400/70' },
  { delay: 320,  text: 'KEYGEN: instantiating NTT domain...', color: 'text-orange-400/60' },
  { delay: 600,  text: 'KEYGEN: sampling A ∈ ℤ₃₃₂₉^{3×3} via SHAKE-128...', color: 'text-cyan-400/60' },
  { delay: 880,  text: 'KEYGEN: sampling s, e from centered binomial (η₁=2)...', color: 'text-cyan-400/60' },
  { delay: 1140, text: 'KEYGEN: computing t = A·s + e mod 3329...', color: 'text-orange-300/70' },
  { delay: 1400, text: 'KEYGEN: encoding encapsulation key (ek)... 1184 bytes', color: 'text-orange-300/70' },
  { delay: 1650, text: 'KEYGEN: encoding decapsulation key (dk)... 2400 bytes', color: 'text-orange-400/60' },
  { delay: 1900, text: 'KEYGEN: zeroizing intermediate state via log_entropy_flush()', color: 'text-rose-400/60' },
  { delay: 2150, text: 'KEYGEN: ✓ keypair ready — K=3, q=3329, 128-bit post-quantum security', color: 'text-amber-300/80' },
];

// ── Keypair extraction + download helpers ─────────────────────────────────────
// Parse the hex blocks out of run_classified(1) log output.
// Lines carrying key material start with 6 spaces then uppercase hex chars.
function parseMLKemKeypair(log) {
  const lines = log.split('\n');
  let section = null;
  let ekHex = '';
  let dkHex = '';
  for (const line of lines) {
    if (line.includes('ENCAPSULATION KEY (PUBLIC)'))  { section = 'ek'; continue; }
    if (line.includes('DECAPSULATION KEY (PRIVATE)')) { section = 'dk'; continue; }
    if (line.includes('CIPHERTEXT (ENCAPSULATED)'))   { section = null; continue; }
    if (section && line.startsWith('      ')) {
      const hex = line.trim();
      if (/^[0-9A-F]+$/.test(hex)) {
        if (section === 'ek') ekHex += hex;
        else                  dkHex += hex;
      }
    }
  }
  return { ekHex, dkHex };
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function triggerDownload(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Key session history (sessionStorage so it survives hot-reload, resets per tab) ──
const SESSION_HISTORY_KEY = 'cr_key_sessions';
function loadKeyHistory() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_HISTORY_KEY) ?? '[]'); } catch { return []; }
}
function saveKeyHistory(hist) {
  try { sessionStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(hist.slice(-6))); } catch {}
}

// ── Key generation phase ──────────────────────────────────────────────────────
function KeygenPhase() {
  const [visibleLines, setVisibleLines] = useState([]);
  const [showAction,   setShowAction]   = useState(false);
  const [wasmState,    setWasmState]    = useState('idle'); // idle|running|done|error
  const [wasmError,    setWasmError]    = useState(null);
  const [keypair,      setKeypair]      = useState(null);   // { ekHex, dkHex }
  const [downloaded,   setDownloaded]   = useState({ ek: false, dk: false });
  const [keyHistory,   setKeyHistory]   = useState(() => loadKeyHistory());

  useEffect(() => {
    const timers = KEYGEN_LINES.map((line, i) =>
      setTimeout(() => {
        setVisibleLines(prev => [...prev, { ...line, i }]);
        if (i === KEYGEN_LINES.length - 1) setTimeout(() => setShowAction(true), 600);
      }, line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleInitiate = useCallback(async () => {
    setWasmState('running');
    try {
      const mod = await loadWasm();
      const output = mod.run_classified(1);
      const { ekHex, dkHex } = parseMLKemKeypair(output);
      if (ekHex.length !== 2368) throw new Error(`ek: ${ekHex.length / 2}B (expected 1184B)`);
      if (dkHex.length !== 4800) throw new Error(`dk: ${dkHex.length / 2}B (expected 2400B)`);
      setKeypair({ ekHex, dkHex });
      setWasmState('done');
      // Record this session in history
      const entry = {
        ts:       Date.now(),
        ekPrefix: ekHex.slice(0, 16).toUpperCase(),
        sessionId: Math.random().toString(36).slice(2, 10).toUpperCase(),
      };
      setKeyHistory(prev => {
        const next = [...prev, entry].slice(-6);
        saveKeyHistory(next);
        return next;
      });
    } catch (err) {
      setWasmError(err.message);
      setWasmState('error');
    }
  }, []);

  const doDownload = useCallback((which) => {
    if (!keypair) return;
    const hex  = which === 'ek' ? keypair.ekHex : keypair.dkHex;
    const name = which === 'ek'
      ? 'mlkem768-encapsulation-key.bin'
      : 'mlkem768-decapsulation-key.bin';
    triggerDownload(hexToBytes(hex), name);
    setDownloaded(prev => ({ ...prev, [which]: true }));
  }, [keypair]);

  return (
    <div className="space-y-4 font-mono text-[10px]">
      {/* Log stream with scanline sweep */}
      <div className="relative border border-orange-900/30 bg-black/60 rounded-sm p-4 space-y-0.5 min-h-[200px] overflow-hidden">
        {/* Scanline sweep */}
        {wasmState === 'running' && (
          <div className="absolute left-0 right-0 h-px pointer-events-none z-10"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.6) 30%, rgba(249,115,22,0.9) 50%, rgba(251,191,36,0.6) 70%, transparent 100%)',
              boxShadow: '0 0 12px 4px rgba(251,191,36,0.3)',
              animation: 'cr-scanline 1.5s linear infinite',
            }} />
        )}

        {visibleLines.map(line => (
          <div key={line.i} className={`${line.color} tracking-wide`}
               style={{ animation: 'cr-logIn 0.25s ease forwards' }}>
            <span className="text-orange-900/40 mr-2 select-none">{'>'}</span>
            {line.text}
          </div>
        ))}
        {visibleLines.length < KEYGEN_LINES.length && (
          <span className="text-orange-500/40 animate-pulse">█</span>
        )}
        {wasmState === 'running' && (
          <div className="text-cyan-400/70 tracking-wide" style={{ animation: 'cr-logIn 0.25s ease forwards' }}>
            <span className="text-orange-900/40 mr-2 select-none">{'>'}</span>
            KEYGEN: calling WASM — MlKem768::generate(&amp;mut OsRng)...
            <span className="animate-pulse ml-1">█</span>
          </div>
        )}
        {wasmState === 'done' && (
          <>
            <div className="text-amber-300/80 tracking-wide" style={{ animation: 'cr-logIn 0.25s ease forwards' }}>
              <span className="text-orange-900/40 mr-2">{'>'}</span>
              KEYGEN: ✓ ML-KEM-768 keypair generated — OsRng entropy consumed
            </div>
            <div className="text-rose-400/60 tracking-wide" style={{ animation: 'cr-logIn 0.25s ease forwards' }}>
              <span className="text-orange-900/40 mr-2">{'>'}</span>
              KEYGEN: log_entropy_flush() — ephemeral state zeroized via compiler_fence(SeqCst)
            </div>
          </>
        )}
        {wasmState === 'error' && (
          <div className="text-red-400/70 tracking-wide">
            <span className="text-orange-900/40 mr-2">{'>'}</span>
            KEYGEN: ✗ WASM ERROR — {wasmError}
          </div>
        )}
      </div>

      {/* ── Byte cascade visualizer — scrolling hex waterfall ── */}
      {wasmState === 'running' && (
        <>
          <ByteCascade />
          <NTTButterfly />
        </>
      )}

      {/* Real keypair download UI — appears after WASM completes */}
      {keypair && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ animation: 'cr-hexIn 0.4s ease forwards' }}>
          {[
            { label: 'ENCAPSULATION KEY (ek)', bytes: 1184, color: 'text-orange-300/70', which: 'ek' },
            { label: 'DECAPSULATION KEY (dk)', bytes: 2400, color: 'text-rose-400/60',   which: 'dk' },
          ].map(({ label, bytes, color, which }) => {
            const preview = (which === 'ek' ? keypair.ekHex : keypair.dkHex).slice(0, 64).toUpperCase();
            const done    = downloaded[which];
            return (
              <div key={which} className="border border-orange-900/25 bg-black/50 rounded-sm p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[8px] tracking-widest uppercase ${color}`}>{label}</span>
                  <span className="text-orange-600/30 text-[8px]">{bytes} bytes</span>
                </div>
                <pre className={`text-[8px] leading-relaxed break-all whitespace-pre-wrap ${color} opacity-70 mb-2`}>
                  {preview}
                  <span className="text-orange-600/30 text-[7px]">  …+{bytes - 32} bytes</span>
                </pre>
                <button
                  onClick={() => doDownload(which)}
                  className={`w-full text-[9px] font-bold tracking-widest uppercase py-1.5 border transition-all duration-200 rounded-sm ${
                    done
                      ? 'border-green-500/30 bg-green-900/10 text-green-400/70'
                      : which === 'ek'
                        ? 'border-orange-500/30 bg-orange-900/10 text-orange-300 hover:bg-orange-900/30 hover:border-orange-400/50'
                        : 'border-rose-500/30 bg-rose-900/10 text-rose-300 hover:bg-rose-900/30 hover:border-rose-400/50'
                  }`}
                >
                  {done ? '✓ DOWNLOADED' : `↓ ${which === 'ek' ? 'mlkem768-encapsulation-key.bin' : 'mlkem768-decapsulation-key.bin'}`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Initiate button — idle state */}
      {showAction && wasmState === 'idle' && (
        <div className="border border-amber-500/25 bg-amber-950/10 rounded-sm p-4 text-center"
             style={{ animation: 'cr-logIn 0.3s ease forwards' }}>
          <div className="text-amber-400/70 text-[10px] tracking-widest uppercase mb-1">
            Entropy pool saturated — ready for key generation
          </div>
          <div className="text-orange-400/40 text-[9px] mb-3">
            Generated locally by Rust/WASM · no internet connection required
          </div>
          <button
            onClick={handleInitiate}
            className="px-6 py-2 border border-orange-500/40 bg-orange-900/20 text-orange-300 text-[11px] font-bold tracking-widest uppercase rounded-sm hover:bg-orange-900/40 hover:border-orange-400/60 transition-all duration-200"
            style={{ boxShadow: '0 0 12px rgba(249,115,22,0.1)' }}
          >
            → initiate enclave
          </button>
        </div>
      )}

      {/* Footer note after keypair is ready */}
      {keypair && (
        <div className="border border-orange-500/10 bg-black/20 rounded-sm px-4 py-2 text-center space-y-0.5">
          <div className="text-orange-600/35 text-[8px] tracking-widest">
            dk — PRIVATE KEY · STORE SECURELY · NEVER SHARE · FIPS 203 // ML-KEM-768
          </div>
          <div className="text-orange-600/20 text-[8px]">
            type <span className="text-orange-500/40">run classified</span> for the time-locked AES-GCM decryption enclave
          </div>
        </div>
      )}

      {/* ── Key session history timeline ──────────────────────────────────── */}
      {keyHistory.length > 0 && (
        <div className="border border-orange-900/20 bg-black/40 rounded-sm p-3">
          <div className="text-[8px] tracking-widest text-orange-600/40 uppercase mb-2 flex items-center gap-1.5">
            <Activity className="w-2.5 h-2.5" />
            KEY SESSION HISTORY · this window only
          </div>
          <div className="space-y-1">
            {keyHistory.map((h, i) => {
              const ts = new Date(h.ts).toLocaleTimeString('en-US', { hour12: false });
              const isCurrent = i === keyHistory.length - 1;
              return (
                <div key={h.sessionId} className="flex items-center gap-2 font-mono text-[8px]">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrent ? 'bg-orange-400' : 'bg-orange-900/60'}`}
                       style={isCurrent ? { boxShadow: '0 0 5px rgba(249,115,22,0.8)' } : {}} />
                  <span className="text-orange-600/30 tabular-nums w-16 shrink-0">{ts}</span>
                  <span className="text-orange-900/50">{h.sessionId}</span>
                  <span className="text-orange-600/20 font-mono tracking-wider">{h.ekPrefix}…</span>
                  {isCurrent && <span className="text-orange-400/60 ml-auto">[current]</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── File Vault — drag-and-drop encrypt/decrypt ───────────────────────────────
function FileVault() {
  const [mode, setMode]           = useState('idle');      // idle | encrypting | decrypting | done | error
  const [dragOver, setDragOver]   = useState(false);
  const [file, setFile]           = useState(null);        // { name, size, bytes: Uint8Array }
  const [passphrase, setPassphrase] = useState('');
  const [result, setResult]       = useState(null);        // { bytes, name, action }
  const [error, setError]         = useState(null);
  const [progress, setProgress]   = useState(0);           // 0..100 fake progress
  const [log, setLog]             = useState([]);
  const fileInputRef              = useRef(null);
  const progressRef               = useRef(null);

  const addLog = useCallback((text, color = 'text-orange-400/60') => {
    setLog(prev => [...prev.slice(-12), { text, color, id: Date.now() + Math.random() }]);
  }, []);

  const handleFile = useCallback((f) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result);
      const isSealed = bytes.length >= 4 &&
        bytes[0] === 0x54 && bytes[1] === 0x56 && bytes[2] === 0x31 && bytes[3] === 0x2E; // "TV1."
      setFile({ name: f.name, size: f.size, bytes, isSealed });
      setResult(null);
      setError(null);
      setLog([]);
      addLog(`FILE LOADED: ${f.name} — ${f.size.toLocaleString()} bytes`, 'text-orange-300/80');
      if (isSealed) {
        addLog('DETECTED: TV1. envelope header — Tesseract-Vault sealed file', 'text-cyan-400/70');
      } else {
        addLog(`TYPE: ${f.name.split('.').pop()?.toUpperCase() || 'BINARY'} — plaintext candidate`, 'text-orange-400/60');
      }
    };
    reader.readAsArrayBuffer(f);
  }, [addLog]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const runProgress = useCallback((duration) => {
    setProgress(0);
    let start = null;
    const tick = (ts) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const pct = Math.min(95, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct < 95) progressRef.current = requestAnimationFrame(tick);
    };
    progressRef.current = requestAnimationFrame(tick);
  }, []);

  const handleEncrypt = useCallback(async () => {
    if (!file || !passphrase) return;
    setMode('encrypting');
    setError(null);
    setResult(null);
    runProgress(2000);

    addLog('SEAL: initializing WASM runtime...', 'text-orange-400/60');

    try {
      const mod = await loadWasm();

      addLog('SEAL: Argon2id KDF — deriving 256-bit master key...', 'text-cyan-400/60');
      addLog(`SEAL: input ${file.size.toLocaleString()} bytes — ${file.name}`, 'text-orange-400/60');

      const sealed = mod.seal_markdown(file.bytes, passphrase);

      if (!sealed || sealed.length === 0) throw new Error('seal_markdown returned empty — check passphrase');

      addLog(`SEAL: AES-256-GCM encryption complete — ${sealed.length.toLocaleString()} bytes`, 'text-orange-300/70');
      addLog('SEAL: BLAKE3 integrity hash appended', 'text-cyan-400/60');
      addLog('SEAL: ✓ TV1. envelope sealed', 'text-amber-300/80');

      setProgress(100);
      setResult({
        bytes: sealed,
        name: file.name + '.tv1',
        action: 'encrypt',
      });
      setMode('done');
    } catch (err) {
      addLog(`SEAL: ✗ ERROR — ${err.message}`, 'text-red-400/70');
      setError(err.message);
      setMode('error');
    }
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
  }, [file, passphrase, addLog, runProgress]);

  const handleDecrypt = useCallback(async () => {
    if (!file || !passphrase) return;
    setMode('decrypting');
    setError(null);
    setResult(null);
    runProgress(2000);

    addLog('UNSEAL: initializing WASM runtime...', 'text-orange-400/60');

    try {
      const mod = await loadWasm();

      addLog('UNSEAL: Argon2id KDF — rederiving master key from passphrase...', 'text-cyan-400/60');
      addLog(`UNSEAL: sealed envelope ${file.size.toLocaleString()} bytes`, 'text-orange-400/60');

      const plaintext = mod.unseal_markdown(file.bytes, passphrase);

      if (!plaintext || plaintext.length === 0) throw new Error('Decryption failed — wrong passphrase or corrupted envelope');

      addLog(`UNSEAL: AES-256-GCM decryption complete — ${plaintext.length.toLocaleString()} bytes`, 'text-orange-300/70');
      addLog('UNSEAL: BLAKE3 integrity verified ✓', 'text-cyan-400/60');
      addLog('UNSEAL: ✓ plaintext recovered', 'text-amber-300/80');

      // Strip .tv1 extension if present
      let outName = file.name;
      if (outName.endsWith('.tv1')) outName = outName.slice(0, -4);
      else outName = 'decrypted-' + outName;

      setProgress(100);
      setResult({
        bytes: plaintext,
        name: outName,
        action: 'decrypt',
      });
      setMode('done');
    } catch (err) {
      addLog(`UNSEAL: ✗ ERROR — ${err.message}`, 'text-red-400/70');
      setError(err.message);
      setMode('error');
    }
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
  }, [file, passphrase, addLog, runProgress]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    triggerDownload(result.bytes, result.name);
  }, [result]);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setMode('idle');
    setPassphrase('');
    setLog([]);
    setProgress(0);
  }, []);

  const isProcessing = mode === 'encrypting' || mode === 'decrypting';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[9px] font-mono tracking-widest text-orange-600/50 uppercase flex items-center gap-2">
          <Lock className="w-3 h-3" />
          FILE VAULT // TESSERACT-VAULT PIPELINE
        </div>
        {file && (
          <button onClick={reset}
            className="text-[8px] font-mono text-orange-600/40 hover:text-orange-400/60 tracking-widest uppercase transition-colors">
            [clear]
          </button>
        )}
      </div>

      {/* ── Drop zone ── */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !file && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-all duration-300 ${
          dragOver
            ? 'border-orange-400/60 bg-orange-900/20'
            : file
              ? 'border-orange-500/30 bg-black/50'
              : 'border-orange-900/30 bg-black/40 hover:border-orange-500/40 hover:bg-orange-900/10'
        }`}
        style={dragOver ? { boxShadow: '0 0 30px rgba(249,115,22,0.15) inset' } : {}}
      >
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

        {!file ? (
          <div className="space-y-2">
            <div className="text-3xl text-orange-500/30">⬡</div>
            <div className="text-orange-400/50 font-mono text-[11px] tracking-widest uppercase">
              Drop file to encrypt or decrypt
            </div>
            <div className="text-orange-600/30 font-mono text-[9px]">
              or click to browse · TV1. envelopes auto-detected for decryption
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-3">
              <div className={`w-3 h-3 rounded-sm ${file.isSealed ? 'bg-cyan-400/60' : 'bg-orange-400/60'}`} />
              <span className="text-orange-200/80 font-mono text-sm font-bold">{file.name}</span>
            </div>
            <div className="text-orange-600/40 font-mono text-[9px] tracking-widest">
              {file.size.toLocaleString()} bytes · {file.isSealed ? 'TV1. SEALED ENVELOPE' : 'PLAINTEXT FILE'}
            </div>
          </div>
        )}

        {/* Drag shimmer */}
        {dragOver && (
          <div className="absolute inset-0 pointer-events-none rounded-sm"
            style={{
              background: 'radial-gradient(circle at center, rgba(249,115,22,0.1) 0%, transparent 70%)',
              animation: 'cr-crtFlicker 0.5s ease-in-out infinite',
            }} />
        )}
      </div>

      {/* ── Passphrase input ── */}
      {file && (
        <div className="space-y-2" style={{ animation: 'cr-logIn 0.3s ease forwards' }}>
          <div className="text-[8px] font-mono tracking-widest text-orange-600/40 uppercase">
            Passphrase — Argon2id KDF (RFC 9106)
          </div>
          <div className="relative">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="enter passphrase..."
              disabled={isProcessing}
              className="w-full bg-black/60 border border-orange-900/40 rounded-sm px-4 py-2.5 font-mono text-sm text-orange-200/80 placeholder-orange-900/40 focus:outline-none focus:border-orange-500/50 transition-colors"
              style={{ boxShadow: '0 0 8px rgba(249,115,22,0.05) inset' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && passphrase) {
                  file.isSealed ? handleDecrypt() : handleEncrypt();
                }
              }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-mono text-orange-600/30 tracking-widest">
              {passphrase.length > 0 ? `${passphrase.length} chars` : 'REQUIRED'}
            </div>
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      {file && passphrase && !isProcessing && mode !== 'done' && (
        <div className="flex gap-3" style={{ animation: 'cr-logIn 0.3s ease forwards' }}>
          {!file.isSealed && (
            <button onClick={handleEncrypt}
              className="flex-1 py-2.5 border border-orange-500/40 bg-orange-900/15 text-orange-300 font-mono text-[10px] font-bold tracking-widest uppercase rounded-sm hover:bg-orange-900/30 hover:border-orange-400/60 transition-all duration-200"
              style={{ boxShadow: '0 0 12px rgba(249,115,22,0.08)' }}>
              ⬡ SEAL — ENCRYPT FILE
            </button>
          )}
          {file.isSealed && (
            <button onClick={handleDecrypt}
              className="flex-1 py-2.5 border border-cyan-500/40 bg-cyan-900/15 text-cyan-300 font-mono text-[10px] font-bold tracking-widest uppercase rounded-sm hover:bg-cyan-900/30 hover:border-cyan-400/60 transition-all duration-200"
              style={{ boxShadow: '0 0 12px rgba(6,182,212,0.08)' }}>
              ⬢ UNSEAL — DECRYPT FILE
            </button>
          )}
          {/* Allow manual override for non-detected files */}
          {!file.isSealed && (
            <button onClick={handleDecrypt}
              className="py-2.5 px-4 border border-cyan-900/30 bg-black/30 text-cyan-600/50 font-mono text-[10px] tracking-widest uppercase rounded-sm hover:bg-cyan-900/15 hover:text-cyan-400/60 transition-all duration-200">
              UNSEAL
            </button>
          )}
        </div>
      )}

      {/* ── Progress bar ── */}
      {isProcessing && (
        <div className="space-y-1" style={{ animation: 'cr-logIn 0.2s ease forwards' }}>
          <div className="h-1.5 bg-orange-950/30 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-75 ${mode === 'encrypting' ? 'bg-orange-500/70' : 'bg-cyan-500/70'}`}
              style={{
                width: `${progress}%`,
                boxShadow: `0 0 8px ${mode === 'encrypting' ? 'rgba(249,115,22,0.5)' : 'rgba(6,182,212,0.5)'}`,
              }} />
          </div>
          <div className="text-[8px] font-mono text-orange-600/30 tracking-widest uppercase text-center">
            {mode === 'encrypting' ? 'SEALING' : 'UNSEALING'}... {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* ── Log stream ── */}
      {log.length > 0 && (
        <div className="border border-orange-900/20 bg-black/50 rounded-sm p-3 space-y-0.5 max-h-[180px] overflow-y-auto font-mono text-[9px]">
          {log.map((l) => (
            <div key={l.id} className={`${l.color} tracking-wide`} style={{ animation: 'cr-logIn 0.2s ease forwards' }}>
              <span className="text-orange-900/40 mr-2 select-none">{'>'}</span>
              {l.text}
            </div>
          ))}
          {isProcessing && <span className="text-orange-500/40 animate-pulse">█</span>}
        </div>
      )}

      {/* ── Result — download ── */}
      {mode === 'done' && result && (
        <div className={`border rounded-sm p-4 text-center ${result.action === 'encrypt' ? 'border-orange-500/30 bg-orange-900/10' : 'border-cyan-500/30 bg-cyan-900/10'}`}
          style={{ animation: 'cr-hexIn 0.4s ease forwards' }}>
          <div className={`text-[9px] font-mono tracking-widest uppercase mb-2 ${result.action === 'encrypt' ? 'text-orange-400/60' : 'text-cyan-400/60'}`}>
            {result.action === 'encrypt' ? '✓ FILE SEALED' : '✓ FILE UNSEALED'} — {result.bytes.length.toLocaleString()} bytes
          </div>
          <div className="text-orange-200/60 font-mono text-xs mb-3">{result.name}</div>
          <div className="flex gap-3 justify-center">
            <button onClick={handleDownload}
              className={`px-6 py-2 border rounded-sm font-mono text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${
                result.action === 'encrypt'
                  ? 'border-orange-500/40 bg-orange-900/20 text-orange-300 hover:bg-orange-900/40'
                  : 'border-cyan-500/40 bg-cyan-900/20 text-cyan-300 hover:bg-cyan-900/40'
              }`}>
              ↓ DOWNLOAD {result.name}
            </button>
            <button onClick={reset}
              className="px-4 py-2 border border-orange-900/30 bg-black/30 text-orange-600/50 font-mono text-[10px] tracking-widest uppercase rounded-sm hover:text-orange-400/60 transition-colors">
              NEW FILE
            </button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {mode === 'error' && (
        <div className="border border-red-900/40 bg-red-950/15 rounded-sm p-4 text-center" style={{ animation: 'cr-hexIn 0.3s ease forwards' }}>
          <AlertTriangle className="w-4 h-4 text-red-500/60 mx-auto mb-1" />
          <div className="text-red-400/70 font-mono text-[10px]">{error}</div>
          <button onClick={() => setMode('idle')}
            className="mt-2 text-[9px] font-mono text-red-400/40 hover:text-red-300/60 tracking-widest uppercase transition-colors">
            [retry]
          </button>
        </div>
      )}

      {/* ── Pipeline info ── */}
      <div className="grid grid-cols-4 gap-1.5 font-mono text-[8px]">
        {[
          { label: 'KDF', value: 'Argon2id', note: 'RFC 9106' },
          { label: 'CIPHER', value: 'AES-256', note: 'GCM mode' },
          { label: 'HASH', value: 'BLAKE3', note: 'integrity' },
          { label: 'FORMAT', value: 'TV1.', note: 'envelope' },
        ].map(({ label, value, note }) => (
          <div key={label} className="border border-orange-900/20 bg-black/30 p-2 rounded-sm text-center">
            <div className="text-orange-600/30 uppercase tracking-widest mb-0.5">{label}</div>
            <div className="text-orange-400/70 font-bold">{value}</div>
            <div className="text-orange-900/40 uppercase tracking-widest">{note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Phase: LOCKED (entropy grid entry point) ──────────────────────────────────
function LockedPhase({ onInitiateEnclave }) {
  const [phase, setPhase] = useState('collect'); // 'collect' | 'generating'

  return (
    <div className="tab-fade-v2 max-w-6xl mx-auto mt-8 relative">
      <style>{RUST_STYLES}</style>

      {/* CRT scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-40"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 3px)',
          animation: 'cr-crtFlicker 3s ease-in-out infinite',
        }} />

      {/* Header */}
      <div
        className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 mb-6 gap-4"
        style={{ borderColor: 'rgba(194,65,12,0.4)', animation: 'cr-borderFlare 4s ease-in-out infinite' }}
      >
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <KeyRound
              className="w-8 h-8 shrink-0 text-amber-400"
              style={{ animation: 'cr-keyScan 3.5s ease-in-out infinite' }}
            />
            <span style={{ animation: 'cr-rustPulse 3s ease-in-out infinite, cr-titleReveal 0.7s cubic-bezier(0.16,1,0.3,1) forwards' }}>
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #f97316 0%, #fb923c 35%, #fcd34d 70%, #fdba74 100%)' }}
              >
                CRYPTOGRAPHY
              </span>
            </span>
          </h2>
          <div
            className="text-sm font-bold tracking-widest text-orange-500/70 uppercase"
            style={{ opacity: 0, animation: 'cr-subReveal 0.5s ease 0.5s forwards' }}
          >
            TESSERACT-VAULT // ML-KEM-768 // FIPS 203
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-orange-900/40 px-3 py-1 bg-black/40 text-orange-600/60 rounded-sm font-mono">
          <Lock className="w-3 h-3" />
          {phase === 'collect' ? 'AWAITING ENTROPY' : 'KEYGEN ACTIVE'}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-8 items-start">

        {/* LEFT — entropy grid or keygen log */}
        <div>
          <div className="text-[9px] font-mono tracking-widest text-orange-600/50 uppercase mb-3">
            {phase === 'collect'
              ? 'entropy collector // drag to generate key material'
              : 'ml-kem-768 key generation in progress...'}
          </div>

          {phase === 'collect' ? (
            <EntropyGrid onComplete={() => setPhase('generating')} />
          ) : (
            <KeygenPhase onProceed={onInitiateEnclave} />
          )}
        </div>

        {/* RIGHT — ML-KEM math + key sizes */}
        <div className="space-y-5">

          {/* Math block */}
          <div className="p-5 border border-orange-900/30 bg-black/50 rounded-sm font-mono">
            <div className="text-[9px] tracking-widest text-orange-600/60 uppercase mb-3">
              MODULE LEARNING WITH ERRORS
            </div>
            <div className="text-orange-200/90 text-sm mb-2">
              <span className="text-orange-600/60 mr-2">{'>'}</span>
              <span className="text-cyan-400">A</span>
              <span className="text-orange-400/70">·</span>
              <span className="text-yellow-400">s</span>
              <span className="text-orange-400/70"> + </span>
              <span className="text-rose-400">e</span>
              <span className="text-orange-400/70"> = </span>
              <span className="text-orange-200">t</span>
              <span className="text-orange-600/50"> (mod q)</span>
            </div>
            <div className="text-[10px] text-orange-400/50 leading-relaxed space-y-0.5">
              <div><span className="text-cyan-400/70 w-6 inline-block">A</span> public matrix ∈ ℤ<sub>q</sub><sup>k×k</sup> — sampled via XOF</div>
              <div><span className="text-yellow-400/70 w-6 inline-block">s</span> secret vector — private key core</div>
              <div><span className="text-rose-400/70 w-6 inline-block">e</span> error term — computationally hides s</div>
              <div><span className="text-orange-300/70 w-6 inline-block">t</span> encapsulation key component</div>
              <div className="pt-1.5 text-orange-600/40 text-[9px]">
                q = 3329 · k = 3 · best quantum attack = O(2¹²⁸)
              </div>
            </div>
          </div>

          {/* Key sizes */}
          <div>
            <div className="text-[9px] tracking-widest text-orange-600/60 uppercase mb-3 font-mono">
              ML-KEM-768 KEY SIZES (FIPS 203 TABLE 2)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {KEY_SIZES.map(({ label, bytes, note }) => (
                <div key={label} className="border border-orange-900/30 bg-black/40 p-3 rounded-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-orange-300/80">{label}</span>
                    <span className="text-xl font-bold font-mono tabular-nums text-orange-400"
                          style={{ textShadow: '0 0 8px rgba(249,115,22,0.4)' }}>{bytes}</span>
                  </div>
                  <div className="text-[8px] text-orange-600/40 font-mono">{note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Enclave prompt */}
          <div className="p-4 border border-orange-500/15 bg-orange-900/5 rounded-sm font-mono text-center">
            <div className="text-orange-600/40 text-[9px] tracking-widest uppercase mb-2">
              Classified payload — AES-256-GCM encrypted
            </div>
            <div className="text-[10px] text-orange-400/40 mb-2">
              Collect entropy above, then initiate the decryption enclave:
            </div>
            <code className="text-orange-300/60 text-xs">run classified</code>
            <div className="text-orange-900/40 text-[8px] mt-2">60s window · HMAC-signed · single-use</div>
          </div>

        </div>
      </div>

      {/* ── File Vault — full width below the two-column grid ── */}
      <div className="mt-8 border-t border-orange-900/20 pt-8">
        <FileVault />
      </div>
    </div>
  );
}

// ── Phase: PENDING ────────────────────────────────────────────────────────────
function PendingPhase() {
  return (
    <div className="animate-in fade-in duration-300 max-w-5xl mx-auto mt-8">
      <style>{RUST_STYLES}</style>
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        {/* Animated ring spinner */}
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 64 64" className="w-full h-full animate-spin" style={{ animationDuration: '2s' }}>
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(194,65,12,0.2)" strokeWidth="2" />
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(251,191,36,0.8)" strokeWidth="2"
              strokeDasharray="40 136" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' }} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="w-5 h-5 text-orange-400/60" />
          </div>
        </div>
        <div className="text-orange-400/60 font-mono text-sm tracking-widest uppercase">
          Contacting secure enclave...
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-500/50 animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Phase: CHALLENGED ─────────────────────────────────────────────────────────
function ChallengedPhase({ session }) {
  const msLeft  = useCountdown(session.expiresAt);
  const expired = msLeft <= 0;
  const urgent  = msLeft > 0 && msLeft < 10000;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-8 relative">
      <style>{RUST_STYLES}</style>

      {/* CRT scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-40"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 3px)',
          animation: 'cr-crtFlicker 3s ease-in-out infinite',
        }} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 mb-6 gap-4"
           style={{ borderColor: 'rgba(194,65,12,0.4)', animation: 'cr-borderFlare 3s ease-in-out infinite' }}>
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <KeyRound className="w-8 h-8 shrink-0 text-amber-400 animate-pulse"
              style={{ filter: 'drop-shadow(0 0 12px rgba(251,191,36,1))' }} />
            <span style={{ animation: 'cr-rustPulse 3s ease-in-out infinite' }}>
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #f97316 0%, #fcd34d 70%, #fdba74 100%)' }}>
                CHALLENGE ACTIVE
              </span>
            </span>
          </h2>
          <div className="font-mono text-[10px] text-orange-600/60 tracking-widest">
            SESSION_ID: {session.sessionId} · {session.algorithm}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-orange-500/40 px-3 py-1 bg-orange-900/10 text-orange-400 rounded-sm font-mono">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          ENCLAVE ACTIVE
        </div>
      </div>

      <div className={`mb-6 p-6 border rounded-sm font-mono ${expired ? 'border-red-900/50 bg-red-950/20' : urgent ? 'border-red-500/40 bg-red-900/10' : 'border-orange-500/30 bg-orange-900/5'}`}
           style={!expired && !urgent ? { animation: 'cr-borderFlare 3.5s ease-in-out infinite' } : {}}>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="text-[9px] tracking-widest text-orange-600/50 uppercase mb-3">
              {expired ? '⚠ SESSION EXPIRED' : 'TIME REMAINING'}
            </div>
            <CountdownDisplay msLeft={msLeft} />
            {urgent && !expired && (
              <div className="mt-2 text-[9px] text-red-400/80 tracking-widest animate-pulse uppercase">⚠ Critical — submit now</div>
            )}
          </div>
          <div>
            <div className="text-[9px] tracking-widest text-orange-600/50 uppercase mb-3">ECHO PASSPHRASE</div>
            <div className="relative">
              {/* Primary passphrase */}
              <div
                className={`text-4xl font-bold tracking-[0.3em] px-4 py-3 border rounded-sm text-center ${expired ? 'text-red-500/40 border-red-900/30 bg-black/20' : 'text-orange-200 border-orange-500/40 bg-black/60'}`}
                style={{
                  ...(! expired ? { textShadow: '0 0 14px rgba(249,115,22,0.6)' } : {}),
                  ...(urgent && !expired ? { animation: 'cr-glitch1 2s steps(1) infinite' } : {}),
                }}
              >
                {session.code}
              </div>
              {/* Glitch echo layer (urgent only) */}
              {urgent && !expired && (
                <div
                  className="absolute inset-0 text-4xl font-bold tracking-[0.3em] px-4 py-3 text-center text-red-400/40 pointer-events-none"
                  style={{ animation: 'cr-glitch2 2s steps(1) infinite', mixBlendMode: 'screen' }}
                >
                  {session.code}
                </div>
              )}
            </div>
            <div className="text-[9px] text-orange-600/30 mt-2 text-center">
              {expired ? 'type run classified to restart' : 'case-insensitive · spaces ignored'}
            </div>
          </div>
        </div>
      </div>

      {!expired && (
        <div className="mb-6 p-4 border border-amber-900/30 bg-amber-950/10 rounded-sm font-mono">
          <div className="text-[9px] tracking-widest text-amber-600/50 uppercase mb-2 flex items-center gap-2">
            <Activity className="w-3 h-3" /> TERMINAL COMMAND
          </div>
          <div className="bg-black/60 border border-amber-900/30 px-3 py-2 rounded-sm inline-block">
            <span className="text-amber-600/50">{'>'} </span>
            <span className="text-amber-300">verify </span>
            <span className="text-orange-300 font-bold tracking-widest">{session.code}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Encap Key',  value: session.encapKeySize ?? 1184,  unit: 'bytes' },
          { label: 'Ciphertext', value: session.ciphertextSize ?? 1088, unit: 'bytes' },
          { label: 'Shared Key', value: 32,                             unit: 'bytes' },
          { label: 'Cipher',     value: 'AES-256',                      unit: 'GCM'   },
        ].map(({ label, value, unit }) => (
          <div key={label} className="border border-orange-900/30 bg-black/40 p-3 rounded-sm text-center font-mono">
            <div className="text-[9px] text-orange-600/40 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-lg font-bold text-orange-400 tabular-nums"
                 style={{ textShadow: '0 0 8px rgba(249,115,22,0.4)' }}>{value}</div>
            <div className="text-[8px] text-orange-600/30 uppercase tracking-widest">{unit}</div>
          </div>
        ))}
      </div>

      {expired && (
        <div className="mt-4 p-4 border border-red-900/40 bg-red-950/20 rounded-sm font-mono text-center relative overflow-hidden">
          {/* Particle dissolution effect */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="absolute w-1 h-1 rounded-full bg-red-400"
                style={{
                  left: `${20 + Math.random() * 60}%`,
                  top: `${30 + Math.random() * 40}%`,
                  '--cr-dx': `${(Math.random() - 0.5) * 120}px`,
                  '--cr-dy': `${-20 - Math.random() * 60}px`,
                  animation: `cr-dissolve 1.5s ease-out ${i * 0.05}s forwards`,
                }} />
            ))}
          </div>
          <AlertTriangle className="w-5 h-5 text-red-500/60 mx-auto mb-2" />
          <div className="text-red-400/70 text-sm">Session window closed.</div>
          <div className="text-red-500/40 text-[10px] mt-1">Type <span className="text-red-300/60">run classified</span> to generate a new challenge.</div>
        </div>
      )}
    </div>
  );
}

// ── Cipher-to-plaintext morph typewriter ──────────────────────────────────────
// Each char starts as random hex, cycles through 3-4 random glyphs, then resolves
function useCipherMorph(text, active) {
  const [displayed, setDisplayed] = useState('');
  const [morphChars, setMorphChars] = useState([]); // array of { char, resolved, morphFrame }
  const rafRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!active || !text) return;
    frameRef.current = 0;

    // Initialize morph state — each char has a reveal delay
    const chars = text.split('').map((ch, i) => ({
      target: ch,
      current: HEX_CHARS[Math.floor(Math.random() * 16)],
      resolved: false,
      revealAt: i * 1.2,       // frame when this char starts resolving
      morphCycles: 3 + Math.floor(Math.random() * 4),
      cyclesDone: 0,
    }));
    setMorphChars(chars);

    const tick = () => {
      frameRef.current++;
      const f = frameRef.current;
      let allDone = true;

      for (const ch of chars) {
        if (ch.resolved) continue;
        if (f < ch.revealAt) { allDone = false; continue; }

        // Morph through random chars before resolving
        if (ch.cyclesDone < ch.morphCycles) {
          if ((f - ch.revealAt) % 3 === 0) {
            ch.current = ch.target === ' ' ? ' ' : HEX_CHARS[Math.floor(Math.random() * 16)];
            ch.cyclesDone++;
          }
          allDone = false;
        } else {
          ch.current = ch.target;
          ch.resolved = true;
        }
      }

      setDisplayed(chars.map(c => c.current).join(''));
      setMorphChars([...chars]);

      if (!allDone) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [text, active]);

  return { displayed, morphChars };
}

// ── Phase: UNLOCKED ───────────────────────────────────────────────────────────
function UnlockedPhase({ session }) {
  const { displayed, morphChars } = useCipherMorph(session.content, true);
  const decryptedAt = new Date(session.decryptedAt).toLocaleTimeString('en-US', { hour12: false });
  const [phase, setPhase] = useState('crystallize'); // 'crystallize' | 'shatter' | 'done'

  // Crystallization: form → hold → shatter → done
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('shatter'), 1200);
    const t2 = setTimeout(() => setPhase('done'), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Count resolved vs total for progress indicator
  const resolved = morphChars.filter(c => c.resolved).length;
  const total = morphChars.length;
  const decryptPct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-8 relative">
      <style>{RUST_STYLES}</style>

      {/* ── Crystallization shatter overlay ── */}
      {phase !== 'done' && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden"
          style={phase === 'shatter' ? { animation: 'cr-latticeFlash 1.2s ease-out forwards' } : {}}>
          <div className="w-full h-full" style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gridTemplateRows: 'repeat(8, 1fr)', gap: '2px' }}>
            {Array.from({ length: 128 }, (_, i) => {
              const angle = Math.random() * Math.PI * 2;
              const dist = 60 + Math.random() * 100;
              return (
                <div key={i} className="flex items-center justify-center font-mono text-[10px] text-amber-400/60"
                  style={{
                    ...(phase === 'crystallize' ? {
                      '--cr-rx': `${(Math.random() - 0.5) * 40}px`,
                      '--cr-ry': `${(Math.random() - 0.5) * 30}px`,
                      '--cr-rr': `${(Math.random() - 0.5) * 30}deg`,
                      animation: `cr-latticeSnap 1.2s cubic-bezier(0.16,1,0.3,1) forwards`,
                      animationDelay: `${i * 4}ms`,
                    } : {
                      '--cr-sx': `${Math.cos(angle) * dist}px`,
                      '--cr-sy': `${Math.sin(angle) * dist}px`,
                      '--cr-sr': `${(Math.random() - 0.5) * 180}deg`,
                      animation: `cr-crystallize 1.2s cubic-bezier(0.4,0,1,1) forwards`,
                      animationDelay: `${i * 3}ms`,
                    }),
                  }}>
                  {GLYPHS[Math.floor(Math.random() * GLYPHS.length)]}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CRT scanline overlay ── */}
      <div className="absolute inset-0 pointer-events-none z-40"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 3px)',
          animation: 'cr-crtFlicker 3s ease-in-out infinite',
        }} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 mb-6 gap-4"
           style={{ borderColor: 'rgba(249,115,22,0.35)', animation: 'cr-borderFlare 3s ease-in-out infinite' }}>
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <Unlock className="w-8 h-8 shrink-0 text-orange-400"
              style={{ filter: 'drop-shadow(0 0 12px rgba(249,115,22,1))' }} />
            <span style={{ animation: 'cr-rustPulse 3s ease-in-out infinite' }}>
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #f97316 0%, #fcd34d 70%, #fdba74 100%)' }}>
                DECRYPTED
              </span>
            </span>
          </h2>
          <div className="font-mono text-[10px] text-orange-600/60 tracking-widest">
            SESSION_ID: {session.sessionId} · AT: {decryptedAt}
            {session.remainingMs > 0 && (
              <span className="text-orange-500/50"> · {(session.remainingMs/1000).toFixed(1)}s remaining when decrypted</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-orange-400/40 px-3 py-1 bg-orange-900/15 text-orange-300 rounded-sm font-mono">
          <ShieldCheck className="w-3 h-3" />
          AES-GCM AUTH PASSED
        </div>
      </div>

      {/* Verification badges — staggered reveal */}
      <div className="flex flex-wrap gap-2 mb-6 font-mono text-[9px]">
        {['HMAC-SHA256 ✓', 'TIME GATE ✓', 'CHALLENGE ✓', 'AES-256-GCM ✓'].map((label, i) => (
          <span key={label}
            className="border border-orange-500/25 bg-orange-900/10 text-orange-400/70 px-2 py-1 rounded-sm tracking-widest uppercase"
            style={{ opacity: 0, animation: `cr-logIn 0.3s ease ${0.3 + i * 0.15}s forwards` }}>
            {label}
          </span>
        ))}
      </div>

      {/* ── Decryption progress bar ── */}
      {decryptPct < 100 && (
        <div className="mb-3 font-mono text-[8px] tracking-widest text-orange-600/40">
          <div className="flex justify-between mb-1">
            <span>DECRYPTING PAYLOAD</span>
            <span className="text-orange-400/60">{decryptPct}%</span>
          </div>
          <div className="h-0.5 bg-orange-950/30 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500/70 transition-all duration-75 rounded-full"
              style={{ width: `${decryptPct}%`, boxShadow: '0 0 6px rgba(249,115,22,0.5)' }} />
          </div>
        </div>
      )}

      <div className="mb-6 border border-orange-500/30 bg-black/70 rounded-sm overflow-hidden relative">
        <div className="border-b border-orange-900/40 px-4 py-2 flex items-center gap-2 bg-orange-900/10">
          <div className="w-2 h-2 rounded-full bg-orange-400" style={{ boxShadow: '0 0 6px rgba(249,115,22,0.9)' }} />
          <span className="text-[9px] font-mono text-orange-500/60 tracking-widest uppercase">
            CLASSIFIED PAYLOAD — {decryptPct < 100 ? 'DECRYPTING' : 'PLAINTEXT'}
          </span>
        </div>

        {/* Decryption wavefront sweep line */}
        {decryptPct < 100 && (
          <div className="absolute top-10 bottom-0 w-px z-10 pointer-events-none"
            style={{
              left: `${decryptPct}%`,
              background: 'linear-gradient(180deg, transparent 0%, rgba(251,191,36,0.8) 20%, rgba(249,115,22,0.9) 50%, rgba(251,191,36,0.8) 80%, transparent 100%)',
              boxShadow: '0 0 8px 2px rgba(251,191,36,0.3), 4px 0 12px rgba(249,115,22,0.15)',
              transition: 'left 0.05s linear',
            }} />
        )}

        {/* Cipher-to-plaintext morphing content */}
        <pre className="p-5 text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">
          {morphChars.map((ch, i) => (
            <span key={i} style={{
              color: ch.resolved
                ? 'rgba(255,237,213,0.9)'
                : 'rgba(249,115,22,0.5)',
              textShadow: !ch.resolved
                ? '0 0 4px rgba(249,115,22,0.4)'
                : 'none',
              transition: 'color 0.15s ease',
            }}>
              {ch.current}
            </span>
          ))}
          {decryptPct < 100 && (
            <span className="animate-pulse text-orange-400">█</span>
          )}
        </pre>
      </div>

      <div className="text-[9px] font-mono text-orange-600/30 text-center">
        Session consumed · type <span className="text-orange-500/50">run classified</span> to generate a new session
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
const ClassifiedTab = ({ session, onInitiateEnclave }) => {
  if (!session || session.status === 'locked') return <LockedPhase onInitiateEnclave={onInitiateEnclave} />;
  if (session.status === 'pending')            return <PendingPhase />;
  if (session.status === 'challenged')         return <ChallengedPhase session={session} />;
  if (session.status === 'unlocked')           return <UnlockedPhase session={session} />;
  return <LockedPhase onInitiateEnclave={onInitiateEnclave} />;
};

export default React.memo(ClassifiedTab);

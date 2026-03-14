import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KeyRound, ShieldCheck, Activity, Lock, Unlock, AlertTriangle } from 'lucide-react';

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
  return (
    <div className="space-y-2">
      <div className={`font-mono text-5xl font-bold tabular-nums tracking-tight ${col}`}>
        {String(Math.floor(secs / 60)).padStart(2,'0')}:{String(secs % 60).padStart(2,'0')}
        <span className="text-2xl opacity-60">.{tenths}</span>
      </div>
      <div className="h-1 bg-orange-950/40 rounded-full overflow-hidden">
        <div className={`h-full ${bar} transition-all duration-100`} style={{ width: `${pct}%` }} />
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

  // Init grid cells
  useEffect(() => {
    const cells = Array.from({ length: ROWS * COLS }, () => ({
      char:    GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      visited: false,
      glow:    0,        // 0..1 — orange glow intensity, decays
      heat:    0,        // cumulative heat for long-term colour
    }));
    stateRef.current = { cells, totalBits: 0, lastCompleted: false };

    // Idle character mutation — characters slowly shift
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
    }, 120);

    return () => clearInterval(mutateId);
  }, []);

  // RAF draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = COLS * CELL;
    const H = ROWS * CELL;

    const draw = () => {
      const s = stateRef.current;
      if (!s) { rafRef.current = requestAnimationFrame(draw); return; }
      const { cells } = s;

      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, W, H);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = cells[r * COLS + c];
          const x    = c * CELL;
          const y    = r * CELL;

          // Decay glow
          if (cell.glow > 0) cell.glow = Math.max(0, cell.glow - 0.04);

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

      // Grid overlay lines (subtle)
      ctx.strokeStyle = 'rgba(249,115,22,0.04)';
      ctx.lineWidth   = 0.5;
      for (let c = 0; c <= COLS; c++) {
        ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Hit entropy cell from canvas coords
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

    // Scramble the char on every touch
    cell.char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    cell.glow = 1;

    if (!cell.visited) {
      cell.visited = true;
      s.totalBits += 8;
      setBits(s.totalBits);
      if (s.totalBits >= TARGET_BITS && !s.lastCompleted) {
        s.lastCompleted = true;
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
          style={{ display: 'block', width: '100%', maxWidth: `${COLS * CELL}px` }}
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

// ── Key generation phase ──────────────────────────────────────────────────────
function KeygenPhase() {
  const [visibleLines, setVisibleLines] = useState([]);
  const [showAction,   setShowAction]   = useState(false);
  const [wasmState,    setWasmState]    = useState('idle'); // idle|running|done|error
  const [wasmError,    setWasmError]    = useState(null);
  const [keypair,      setKeypair]      = useState(null);   // { ekHex, dkHex }
  const [downloaded,   setDownloaded]   = useState({ ek: false, dk: false });

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
      const mod    = await import('../../wasm/scale94_kernels.js');
      const output = mod.run_classified(1);
      const { ekHex, dkHex } = parseMLKemKeypair(output);
      if (ekHex.length !== 2368) throw new Error(`ek: ${ekHex.length / 2}B (expected 1184B)`);
      if (dkHex.length !== 4800) throw new Error(`dk: ${dkHex.length / 2}B (expected 2400B)`);
      setKeypair({ ekHex, dkHex });
      setWasmState('done');
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
      {/* Log stream */}
      <div className="border border-orange-900/30 bg-black/60 rounded-sm p-4 space-y-0.5 min-h-[200px]">
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
    </div>
  );
}

// ── Phase: LOCKED (entropy grid entry point) ──────────────────────────────────
function LockedPhase({ onInitiateEnclave }) {
  const [phase, setPhase] = useState('collect'); // 'collect' | 'generating'

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto mt-8">
      <style>{RUST_STYLES}</style>

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
    </div>
  );
}

// ── Phase: PENDING ────────────────────────────────────────────────────────────
function PendingPhase() {
  return (
    <div className="animate-in fade-in duration-300 max-w-5xl mx-auto mt-8">
      <style>{RUST_STYLES}</style>
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-6 h-6 border-2 border-orange-600/40 border-t-orange-400 rounded-full animate-spin" />
        <div className="text-orange-400/60 font-mono text-sm tracking-widest uppercase">
          Contacting secure enclave...
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-8">
      <style>{RUST_STYLES}</style>

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
            <div
              className={`text-4xl font-bold tracking-[0.3em] px-4 py-3 border rounded-sm text-center ${expired ? 'text-red-500/40 border-red-900/30 bg-black/20' : 'text-orange-200 border-orange-500/40 bg-black/60'}`}
              style={!expired ? { textShadow: '0 0 14px rgba(249,115,22,0.6)' } : {}}
            >
              {session.code}
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
        <div className="mt-4 p-4 border border-red-900/40 bg-red-950/20 rounded-sm font-mono text-center">
          <AlertTriangle className="w-5 h-5 text-red-500/60 mx-auto mb-2" />
          <div className="text-red-400/70 text-sm">Session window closed.</div>
          <div className="text-red-500/40 text-[10px] mt-1">Type <span className="text-red-300/60">run classified</span> to generate a new challenge.</div>
        </div>
      )}
    </div>
  );
}

// ── Phase: UNLOCKED ───────────────────────────────────────────────────────────
function UnlockedPhase({ session }) {
  const typed       = useTypewriter(session.content, true);
  const decryptedAt = new Date(session.decryptedAt).toLocaleTimeString('en-US', { hour12: false });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-8">
      <style>{RUST_STYLES}</style>

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

      <div className="flex flex-wrap gap-2 mb-6 font-mono text-[9px]">
        {['HMAC-SHA256 ✓', 'TIME GATE ✓', 'CHALLENGE ✓', 'AES-256-GCM ✓'].map(label => (
          <span key={label} className="border border-orange-500/25 bg-orange-900/10 text-orange-400/70 px-2 py-1 rounded-sm tracking-widest uppercase">
            {label}
          </span>
        ))}
      </div>

      <div className="mb-6 border border-orange-500/30 bg-black/70 rounded-sm overflow-hidden">
        <div className="border-b border-orange-900/40 px-4 py-2 flex items-center gap-2 bg-orange-900/10">
          <div className="w-2 h-2 rounded-full bg-orange-400" style={{ boxShadow: '0 0 6px rgba(249,115,22,0.9)' }} />
          <span className="text-[9px] font-mono text-orange-500/60 tracking-widest uppercase">
            CLASSIFIED PAYLOAD — PLAINTEXT
          </span>
        </div>
        <pre className="p-5 text-sm font-mono text-orange-200/90 leading-relaxed whitespace-pre-wrap break-words">
          {typed}
          {typed.length < (session.content?.length ?? 0) && (
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

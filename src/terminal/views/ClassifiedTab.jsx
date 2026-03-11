import React from 'react';
import { KeyRound, ShieldCheck, Activity } from 'lucide-react';

// ML-KEM-768 key size reference (FIPS 203 Table 2)
const KEY_SIZES = [
  { label: 'Encapsulation Key (ek)',  bytes: 1184, note: 'Public — safe to share' },
  { label: 'Decapsulation Key (dk)',  bytes: 2400, note: 'Private — REDACTED by default' },
  { label: 'Ciphertext (ct)',          bytes: 1088, note: 'Sender → Recipient' },
  { label: 'Shared Secret (ss)',        bytes:   32, note: 'Derived by both parties' },
];

// Preset parameter sets for known Gray-Scott pattern regimes
const GS_PRESETS = [
  { name: 'CORAL',    f: '0.037', k: '0.065', desc: 'coral growth — slow spirals' },
  { name: 'SPOTS',    f: '0.055', k: '0.062', desc: 'mitosis — self-replicating dots' },
  { name: 'MAZES',    f: '0.029', k: '0.057', desc: 'labyrinthine filaments' },
  { name: 'SOLITONS', f: '0.025', k: '0.060', desc: 'stable travelling pulses' },
];

const ClassifiedTab = () => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-8">

    {/* ── Header ─────────────────────────────────────────────────────────── */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-green-900/40 pb-4 mb-6 gap-4">
      <div>
        <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
          <KeyRound
            className="w-8 h-8 shrink-0 text-green-400"
            style={{ filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.6))' }}
          />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-cyan-400">
            CLASSIFIED
          </span>
        </h2>
        <div className="text-sm font-bold tracking-widest text-green-400/70 uppercase">
          POST-QUANTUM CRYPTOGRAPHY // ML-KEM-768 // FIPS 203
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs border border-green-500/30 px-3 py-1 bg-green-900/10 text-green-400 rounded-sm font-mono">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
        ENCLAVE ACTIVE
      </div>
    </div>

    {/* ── MLWE Math Block ─────────────────────────────────────────────────── */}
    <div className="mb-6 p-5 border border-green-900/30 bg-black/50 rounded-sm font-mono">
      <div className="text-[9px] tracking-widest text-green-500/60 uppercase mb-3">
        MATHEMATICAL FOUNDATION — MODULE LEARNING WITH ERRORS
      </div>
      <div className="text-green-300/90 text-sm mb-2">
        <span className="text-green-500/60 mr-2">{'>'}</span>
        <span className="text-cyan-400">A</span>
        <span className="text-green-300/70">·</span>
        <span className="text-yellow-400">s</span>
        <span className="text-green-300/70"> + </span>
        <span className="text-orange-400">e</span>
        <span className="text-green-300/70"> = </span>
        <span className="text-green-300">t</span>
        <span className="text-green-500/50"> (mod q)</span>
      </div>
      <div className="text-[10px] text-green-400/50 leading-relaxed space-y-0.5">
        <div><span className="text-cyan-400/70 w-6 inline-block">A</span> public matrix ∈ ℤ<sub>q</sub><sup>k×k</sup> — generated from public seed</div>
        <div><span className="text-yellow-400/70 w-6 inline-block">s</span> secret vector ∈ ℤ<sub>q</sub><sup>k</sup> — small coefficients (private key core)</div>
        <div><span className="text-orange-400/70 w-6 inline-block">e</span> error term ∈ ℤ<sub>q</sub><sup>k</sup> — small noise (computationally hides s)</div>
        <div><span className="text-green-300/70 w-6 inline-block">t</span> public vector ∈ ℤ<sub>q</sub><sup>k</sup> — encapsulation key component</div>
        <div className="pt-1 text-green-500/40">q = 3329  ·  k = 3 (ML-KEM-768)  ·  hardness: best attack = O(2¹²⁸) quantum ops</div>
      </div>
    </div>

    {/* ── Key Size Table ──────────────────────────────────────────────────── */}
    <div className="mb-6">
      <div className="text-[9px] tracking-widest text-green-500/60 uppercase mb-3 font-mono">
        ML-KEM-768 KEY SIZES (FIPS 203 TABLE 2)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {KEY_SIZES.map(({ label, bytes, note }) => (
          <div
            key={label}
            className="border border-green-900/30 bg-black/40 p-3 rounded-sm flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-xs font-mono text-green-300/80 font-bold">{label}</div>
              <div className="text-[9px] text-green-500/40 font-mono mt-0.5">{note}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold font-mono tabular-nums text-green-400">{bytes}</div>
              <div className="text-[8px] tracking-widest text-green-500/40 uppercase">bytes</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* ── Terminal Usage ──────────────────────────────────────────────────── */}
    <div className="mb-6 p-4 border border-green-900/20 bg-black/30 rounded-sm">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-3 h-3 text-green-500/60 shrink-0" />
        <span className="text-[9px] tracking-widest text-green-500/60 uppercase font-mono font-bold">
          TERMINAL INTERFACE — WASM KERNEL
        </span>
      </div>

      <div className="space-y-3 font-mono text-xs">
        <div>
          <div className="text-[9px] text-green-500/50 uppercase tracking-widest mb-1">Generate keypair (private key redacted)</div>
          <div className="bg-black/60 border border-green-900/30 px-3 py-2 rounded-sm">
            <span className="text-green-500/60">{'>'} </span>
            <span className="text-green-300">run classified</span>
          </div>
        </div>

        <div>
          <div className="text-[9px] text-green-500/50 uppercase tracking-widest mb-1">Expose private decapsulation key in system log</div>
          <div className="bg-black/60 border border-orange-900/30 px-3 py-2 rounded-sm">
            <span className="text-orange-500/60">{'>'} </span>
            <span className="text-orange-300">run classified --reveal 1</span>
            <span className="text-orange-500/40 ml-3">// WARN: private key visible</span>
          </div>
        </div>

        <div>
          <div className="text-[9px] text-green-500/50 uppercase tracking-widest mb-1">Gray-Scott reaction-diffusion (stateful — grid persists)</div>
          <div className="bg-black/60 border border-green-900/30 px-3 py-2 rounded-sm">
            <span className="text-green-500/60">{'>'} </span>
            <span className="text-green-300">run grayscott</span>
            <span className="text-green-500/40 ml-2">// default: f=0.055 k=0.062 frames=50</span>
          </div>
        </div>

        <div>
          <div className="text-[9px] text-green-500/50 uppercase tracking-widest mb-1">Custom parameters</div>
          <div className="bg-black/60 border border-green-900/30 px-3 py-2 rounded-sm">
            <span className="text-green-500/60">{'>'} </span>
            <span className="text-green-300">run grayscott --feed 0.037 --kill 0.065 --frames 200</span>
          </div>
        </div>
      </div>
    </div>

    {/* ── Gray-Scott Presets ──────────────────────────────────────────────── */}
    <div className="mb-6">
      <div className="text-[9px] tracking-widest text-green-500/60 uppercase mb-3 font-mono">
        REACTION-DIFFUSION PATTERN PRESETS
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {GS_PRESETS.map(({ name, f, k, desc }) => (
          <div key={name} className="border border-green-900/30 bg-black/40 p-3 rounded-sm">
            <div className="text-xs font-bold font-mono text-green-400 mb-1">{name}</div>
            <div className="text-[9px] font-mono text-green-500/50 mb-1.5">
              f={f} · k={k}
            </div>
            <div className="text-[8px] text-green-400/40 leading-snug">{desc}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[9px] text-green-500/30 font-mono">
        run grayscott --feed 0.037 --kill 0.065 --frames 500 → coral pattern
      </div>
    </div>

    {/* ── Security Context ────────────────────────────────────────────────── */}
    <div className="mb-6 px-4 py-3 border border-green-500/10 bg-green-900/5 rounded-sm text-[10px] font-mono text-green-400/50 leading-relaxed">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="w-3 h-3 text-green-500/60 shrink-0" />
        <span className="text-green-500/70 font-bold tracking-widest uppercase text-[9px]">Security Notes</span>
      </div>
      <ul className="space-y-1 ml-5 list-disc">
        <li>Keys are ephemeral — regenerated fresh on every <span className="text-green-300/60">run classified</span> call</li>
        <li>Private key is redacted by default — <span className="text-orange-400/60">--reveal 1</span> logs it for demonstration purposes only</li>
        <li>ML-KEM-768 is NIST Category 3 — equivalent to AES-192 security against quantum adversaries</li>
        <li>This kernel is an Ars Electronica 2027 demonstration. Do not use for production key management.</li>
      </ul>
    </div>

    {/* ── Footer ─────────────────────────────────────────────────────────── */}
    <div className="border-t border-green-900/20 pt-6 pb-8 text-center">
      <div className="text-[10px] font-mono text-green-400/30 tracking-widest mb-1">
        ML-KEM-768 · FIPS 203 · SCALE_9.4 WASM KERNEL LAYER
      </div>
      <div className="text-[9px] font-mono text-green-400/20">
        NIST Post-Quantum Cryptography Standardization · 2024
        {' '}· Module Learning With Errors (MLWE) hardness assumption
      </div>
    </div>
  </div>
);

export default React.memo(ClassifiedTab);

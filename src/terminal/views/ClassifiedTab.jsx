import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, ShieldCheck, Activity, Lock, Unlock, Clock, AlertTriangle } from 'lucide-react';

// ML-KEM-768 key size reference (FIPS 203 Table 2)
const KEY_SIZES = [
  { label: 'Encapsulation Key (ek)',  bytes: 1184, note: 'Public — safe to share' },
  { label: 'Decapsulation Key (dk)',  bytes: 2400, note: 'Private — REDACTED by default' },
  { label: 'Ciphertext (ct)',          bytes: 1088, note: 'Sender → Recipient' },
  { label: 'Shared Secret (ss)',        bytes:   32, note: 'Derived by both parties' },
];

// ── Countdown timer hook ─────────────────────────────────────────────────────
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

// ── Typewriter for decrypted content ─────────────────────────────────────────
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

// ── Shared styles (injected once at LockedPhase, inherited by all phases) ────
const RUST_STYLES = `
  @keyframes cr-keyScan {
    0%, 100% { filter: drop-shadow(0 0 6px rgba(251,191,36,0.5)) drop-shadow(0 0 2px rgba(251,191,36,0.8)); opacity: 0.85; }
    50%       { filter: drop-shadow(0 0 16px rgba(251,191,36,1)) drop-shadow(0 0 32px rgba(251,191,36,0.5)) drop-shadow(0 0 48px rgba(251,191,36,0.15)); opacity: 1; }
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
    0%, 100% { border-color: rgba(194,65,12,0.35); box-shadow: 0 0 0px rgba(249,115,22,0); }
    50%       { border-color: rgba(249,115,22,0.55); box-shadow: 0 0 18px rgba(249,115,22,0.12), inset 0 0 24px rgba(249,115,22,0.04); }
  }
  .cr-page-glow {
    animation: cr-borderFlare 4s ease-in-out infinite;
  }
  .cr-title-glow {
    animation: cr-rustPulse 3s ease-in-out infinite;
  }
`;

// ── Countdown display ────────────────────────────────────────────────────────
function CountdownDisplay({ msLeft }) {
  const totalSeconds = msLeft / 1000;
  const mins   = Math.floor(totalSeconds / 60);
  const secs   = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((msLeft % 1000) / 100);

  const pct      = Math.min(100, (msLeft / 60000) * 100);
  const urgent   = totalSeconds < 10;
  const warning  = totalSeconds < 30;
  const expired  = msLeft <= 0;

  const colorCls = expired  ? 'text-red-500'
                 : urgent   ? 'text-red-400 animate-pulse'
                 : warning  ? 'text-yellow-400'
                 :            'text-orange-400';

  const barColor = expired  ? 'bg-red-600'
                 : urgent   ? 'bg-red-500'
                 : warning  ? 'bg-yellow-500'
                 :            'bg-orange-500';

  return (
    <div className="space-y-2">
      {/* Numeric display */}
      <div className={`font-mono text-5xl font-bold tabular-nums tracking-tight ${colorCls}`}
           style={{ fontVariantNumeric: 'tabular-nums' }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        <span className="text-2xl opacity-60">.{tenths}</span>
      </div>
      {/* Depletion bar */}
      <div className="h-1 bg-orange-950/40 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-100`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Command reference data ────────────────────────────────────────────────────
const CMD_SECTIONS = [
  {
    heading: 'ENCLAVE FLOW',
    color: 'text-amber-400',
    borderColor: 'border-amber-900/40',
    commands: [
      {
        cmd: 'run classified',
        keys: ['run classified'],
        desc: 'Boot the ML-KEM-768 WASM kernel, request a signed challenge token from the API, and navigate to this tab. Opens a 60-second single-use decryption window.',
      },
      {
        cmd: 'verify <CODE>',
        keys: ['verify ABC123'],
        desc: 'Submit the 6-char echo passphrase displayed on screen. Server checks HMAC signature, enforces the time gate, then decrypts the AES-256-GCM payload. Case-insensitive, spaces ignored.',
      },
    ],
  },
  {
    heading: 'WASM CRYPTO KERNELS',
    color: 'text-orange-400',
    borderColor: 'border-orange-900/40',
    commands: [
      {
        cmd: 'run classified',
        keys: ['run classified', 'run mlkem', 'run pqc'],
        desc: 'ML-KEM-768 key encapsulation simulation. Generates ephemeral (A, s, e, t) parameters, demonstrates encap/decap round-trip, then calls log_entropy_flush() to zeroize secrets from WASM linear memory.',
      },
      {
        cmd: 'run dh_ec',
        keys: ['run dh_ec', 'run dh', 'run ec'],
        desc: 'Classical key exchange reference kernel. Models Diffie-Hellman over a prime field and ECDH over a 256-bit curve. Outputs shared secret derivation steps — useful as a pre-quantum baseline comparison.',
      },
      {
        cmd: 'run feigenbaum',
        keys: ['run feigenbaum', 'run bifurcation'],
        desc: 'Period-doubling bifurcation via the logistic map. Plots the route to chaos as r → 4. Relevant to entropy analysis — the Feigenbaum constant δ ≈ 4.669 appears in PRNG quality diagnostics.',
      },
    ],
  },
  {
    heading: 'NAVIGATION ALIASES',
    color: 'text-cyan-400',
    borderColor: 'border-cyan-900/40',
    commands: [
      {
        cmd: 'load cryptography',
        keys: ['load cryptography', 'load classified', 'load pqc', 'load mlkem'],
        desc: 'Navigate directly to this tab. All four aliases resolve via the loadTabMap guard before article search — no ambiguity with kernel article IDs.',
      },
    ],
  },
];

// ── Phase: LOCKED ─────────────────────────────────────────────────────────────
function LockedPhase() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto mt-8">
      <style>{RUST_STYLES}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 mb-6 gap-4"
           style={{ borderColor: 'rgba(194,65,12,0.4)', animation: 'cr-borderFlare 4s ease-in-out infinite' }}>
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <KeyRound className="w-8 h-8 shrink-0 text-amber-400"
              style={{ animation: 'cr-keyScan 3.5s ease-in-out infinite' }} />
            <span style={{ animation: 'cr-rustPulse 3s ease-in-out infinite, cr-titleReveal 0.7s cubic-bezier(0.16,1,0.3,1) forwards' }}>
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #f97316 0%, #fb923c 35%, #fcd34d 70%, #fdba74 100%)' }}>
                CRYPTOGRAPHY
              </span>
            </span>
          </h2>
          <div
            className="text-sm font-bold tracking-widest text-orange-500/70 uppercase"
            style={{ opacity: 0, animation: 'cr-subReveal 0.5s ease 0.5s forwards' }}
          >
            POST-QUANTUM CRYPTOGRAPHY // ML-KEM-768 // FIPS 203
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-orange-900/40 px-3 py-1 bg-black/40 text-orange-600/60 rounded-sm font-mono">
          <Lock className="w-3 h-3" />
          ENCLAVE LOCKED
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">

        {/* ── LEFT: existing content ──────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Initiate prompt */}
          <div className="p-5 border border-orange-500/20 bg-orange-900/5 rounded-sm font-mono text-center"
               style={{ animation: 'cr-borderFlare 5s ease-in-out 0.3s infinite' }}>
            <div className="text-orange-500/50 text-[10px] tracking-widest uppercase mb-3">
              CLASSIFIED PAYLOAD — AES-256-GCM ENCRYPTED
            </div>
            <div className="text-orange-300/60 text-sm mb-2">
              Initiate time-locked decryption sequence from the terminal:
            </div>
            <div className="inline-block bg-black/60 border border-orange-500/30 px-4 py-2 rounded-sm mt-1">
              <span className="text-orange-600/60">{'>'} </span>
              <span className="text-orange-300 font-bold">run classified</span>
            </div>
            <div className="text-orange-600/30 text-[9px] mt-3">
              60-second challenge window · ML-KEM-768 session · single-use
            </div>
          </div>

          {/* Math block */}
          <div className="p-5 border border-orange-900/30 bg-black/50 rounded-sm font-mono">
            <div className="text-[9px] tracking-widest text-orange-600/60 uppercase mb-3">
              MATHEMATICAL FOUNDATION — MODULE LEARNING WITH ERRORS
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
              <div><span className="text-cyan-400/70 w-6 inline-block">A</span> public matrix ∈ ℤ<sub>q</sub><sup>k×k</sup></div>
              <div><span className="text-yellow-400/70 w-6 inline-block">s</span> secret vector ∈ ℤ<sub>q</sub><sup>k</sup> — private key core</div>
              <div><span className="text-rose-400/70 w-6 inline-block">e</span> error term — computationally hides s</div>
              <div><span className="text-orange-300/70 w-6 inline-block">t</span> public key component (encapsulation key)</div>
              <div className="pt-1 text-orange-600/40">q = 3329  ·  k = 3 (ML-KEM-768)  ·  best attack = O(2¹²⁸) quantum ops</div>
            </div>
          </div>

          {/* Key sizes */}
          <div>
            <div className="text-[9px] tracking-widest text-orange-600/60 uppercase mb-3 font-mono">
              ML-KEM-768 KEY SIZES (FIPS 203 TABLE 2)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {KEY_SIZES.map(({ label, bytes, note }) => (
                <div key={label} className="border border-orange-900/30 bg-black/40 p-3 rounded-sm flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono text-orange-200/80 font-bold">{label}</div>
                    <div className="text-[9px] text-orange-600/40 font-mono mt-0.5">{note}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold font-mono tabular-nums text-orange-400"
                         style={{ textShadow: '0 0 10px rgba(249,115,22,0.5)' }}>{bytes}</div>
                    <div className="text-[8px] tracking-widest text-orange-600/40 uppercase">bytes</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security notes */}
          <div className="px-4 py-3 border border-orange-500/10 bg-orange-900/5 rounded-sm text-[10px] font-mono text-orange-400/50 leading-relaxed">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-3 h-3 text-orange-500/60 shrink-0" />
              <span className="text-orange-500/70 font-bold tracking-widest uppercase text-[9px]">Security Architecture</span>
            </div>
            <ul className="space-y-1 ml-5 list-disc">
              <li>Payload encrypted with AES-256-GCM — decryption key lives only in server env vars</li>
              <li>Session tokens signed with HMAC-SHA256 — tampering is detectable without a database</li>
              <li>Time gate enforced server-side — client countdown is cosmetic only</li>
              <li>Challenge passphrase verified with <span className="text-orange-300/60">crypto.timingSafeEqual</span> — no timing oracle</li>
              <li>ML-KEM-768 is NIST Category 3 — equivalent to AES-192 against quantum adversaries</li>
            </ul>
          </div>

        </div>

        {/* ── RIGHT: command reference ────────────────────────────────────── */}
        <div className="border border-orange-900/30 bg-black/30 rounded-sm overflow-hidden">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-orange-900/30 bg-orange-950/20 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-orange-500/70 shrink-0" />
            <span className="text-[10px] font-bold tracking-widest text-orange-400/70 uppercase">Command Reference</span>
          </div>

          <div className="divide-y divide-orange-900/20">
            {CMD_SECTIONS.map((section) => (
              <div key={section.heading} className="px-4 py-4">

                {/* Section label */}
                <div className={`text-[8px] font-bold tracking-widest uppercase mb-3 ${section.color}`}>
                  {section.heading}
                </div>

                <div className="space-y-4">
                  {section.commands.map((c) => (
                    <div key={c.cmd}>
                      {/* Command chips */}
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {c.keys.map((k) => (
                          <code
                            key={k}
                            className={`text-[9px] font-mono px-2 py-0.5 rounded-sm border ${section.borderColor} bg-black/50 text-orange-300/80`}
                          >
                            {k}
                          </code>
                        ))}
                      </div>
                      {/* Description */}
                      <p className="text-[10px] font-mono text-orange-400/50 leading-relaxed">
                        {c.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Panel footer */}
          <div className="px-4 py-2.5 border-t border-orange-900/20 bg-orange-950/10 text-[8px] font-mono text-orange-600/30 tracking-widest">
            WASM KERNELS COMPILED FROM RUST · FIPS 203 · SORBE NODE
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
  const msLeft   = useCountdown(session.expiresAt);
  const expired  = msLeft <= 0;
  const urgent   = msLeft > 0 && msLeft < 10000;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-8">
      <style>{RUST_STYLES}</style>

      {/* Session header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 mb-6 gap-4"
           style={{ borderColor: 'rgba(194,65,12,0.4)', animation: 'cr-borderFlare 3s ease-in-out infinite' }}>
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <KeyRound className="w-8 h-8 shrink-0 text-amber-400 animate-pulse"
              style={{ filter: 'drop-shadow(0 0 12px rgba(251,191,36,1)) drop-shadow(0 0 24px rgba(251,191,36,0.5))' }} />
            <span style={{ animation: 'cr-rustPulse 3s ease-in-out infinite' }}>
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #f97316 0%, #fb923c 35%, #fcd34d 70%, #fdba74 100%)' }}>
                CHALLENGE ACTIVE
              </span>
            </span>
          </h2>
          <div className="font-mono text-[10px] text-orange-600/60 tracking-widest">
            SESSION_ID: {session.sessionId}  ·  {session.algorithm}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-orange-500/40 px-3 py-1 bg-orange-900/10 text-orange-400 rounded-sm font-mono">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"
               style={{ boxShadow: '0 0 8px rgba(249,115,22,0.9)' }} />
          ENCLAVE ACTIVE
        </div>
      </div>

      {/* Countdown + challenge code */}
      <div className={`mb-6 p-6 border rounded-sm font-mono ${
        expired ? 'border-red-900/50 bg-red-950/20' : urgent ? 'border-red-500/40 bg-red-900/10' : 'border-orange-500/30 bg-orange-900/5'
      }`}
      style={!expired && !urgent ? { animation: 'cr-borderFlare 3.5s ease-in-out infinite' } : {}}>
        <div className="grid md:grid-cols-2 gap-8 items-center">

          {/* Timer */}
          <div>
            <div className="text-[9px] tracking-widest text-orange-600/50 uppercase mb-3">
              {expired ? '⚠ SESSION EXPIRED' : 'TIME REMAINING'}
            </div>
            <CountdownDisplay msLeft={msLeft} />
            {urgent && !expired && (
              <div className="mt-2 text-[9px] text-red-400/80 tracking-widest animate-pulse uppercase">
                ⚠ Critical — submit now
              </div>
            )}
          </div>

          {/* Challenge code */}
          <div>
            <div className="text-[9px] tracking-widest text-orange-600/50 uppercase mb-3">
              ECHO PASSPHRASE
            </div>
            <div
              className={`text-4xl font-bold tracking-[0.3em] px-4 py-3 border rounded-sm text-center transition-all duration-300 ${
                expired
                  ? 'text-red-500/40 border-red-900/30 bg-black/20'
                  : 'text-orange-200 border-orange-500/40 bg-black/60'
              }`}
              style={!expired ? { textShadow: '0 0 14px rgba(249,115,22,0.6), 0 0 30px rgba(249,115,22,0.25)', filter: 'drop-shadow(0 0 8px rgba(249,115,22,0.3))' } : {}}
            >
              {session.code}
            </div>
            <div className="text-[9px] text-orange-600/30 mt-2 text-center">
              {expired ? 'type run classified to restart' : 'case-insensitive · spaces ignored'}
            </div>
          </div>

        </div>
      </div>

      {/* Terminal instruction */}
      {!expired && (
        <div className="mb-6 p-4 border border-amber-900/30 bg-amber-950/10 rounded-sm font-mono">
          <div className="text-[9px] tracking-widest text-amber-600/50 uppercase mb-2 flex items-center gap-2">
            <Activity className="w-3 h-3" /> TERMINAL COMMAND
          </div>
          <div className="text-sm text-amber-300/80 mb-1">
            Type in the terminal input below:
          </div>
          <div className="bg-black/60 border border-amber-900/30 px-3 py-2 rounded-sm inline-block">
            <span className="text-amber-600/50">{'>'} </span>
            <span className="text-amber-300">verify </span>
            <span className="text-orange-300 font-bold tracking-widest">{session.code}</span>
          </div>
        </div>
      )}

      {/* Mock KEM metadata */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
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
        <div className="p-4 border border-red-900/40 bg-red-950/20 rounded-sm font-mono text-center">
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
  const typed = useTypewriter(session.content, true);
  const decryptedAt = new Date(session.decryptedAt).toLocaleTimeString('en-US', { hour12: false });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-8">
      <style>{RUST_STYLES}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 mb-6 gap-4"
           style={{ borderColor: 'rgba(249,115,22,0.35)', animation: 'cr-borderFlare 3s ease-in-out infinite' }}>
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <Unlock className="w-8 h-8 shrink-0 text-orange-400"
              style={{ filter: 'drop-shadow(0 0 12px rgba(249,115,22,1)) drop-shadow(0 0 24px rgba(249,115,22,0.5))' }} />
            <span style={{ animation: 'cr-rustPulse 3s ease-in-out infinite' }}>
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(135deg, #f97316 0%, #fb923c 35%, #fcd34d 70%, #fdba74 100%)' }}>
                DECRYPTED
              </span>
            </span>
          </h2>
          <div className="font-mono text-[10px] text-orange-600/60 tracking-widest">
            SESSION_ID: {session.sessionId}  ·  AT: {decryptedAt}
            {session.remainingMs > 0 && (
              <span className="text-orange-500/50">  ·  {(session.remainingMs / 1000).toFixed(1)}s remaining when decrypted</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-orange-400/40 px-3 py-1 bg-orange-900/15 text-orange-300 rounded-sm font-mono">
          <ShieldCheck className="w-3 h-3" />
          AES-GCM AUTH PASSED
        </div>
      </div>

      {/* Attestation row */}
      <div className="flex flex-wrap gap-2 mb-6 font-mono text-[9px]">
        {['HMAC-SHA256 ✓', 'TIME GATE ✓', 'CHALLENGE ✓', 'AES-256-GCM ✓'].map(label => (
          <span key={label} className="border border-orange-500/25 bg-orange-900/10 text-orange-400/70 px-2 py-1 rounded-sm tracking-widest uppercase">
            {label}
          </span>
        ))}
      </div>

      {/* Decrypted content */}
      <div className="mb-6 border border-orange-500/30 bg-black/70 rounded-sm overflow-hidden">
        <div className="border-b border-orange-900/40 px-4 py-2 flex items-center gap-2 bg-orange-900/10">
          <div className="w-2 h-2 rounded-full bg-orange-400"
               style={{ boxShadow: '0 0 6px rgba(249,115,22,0.9)' }} />
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

      {/* Re-run note */}
      <div className="text-[9px] font-mono text-orange-600/30 text-center">
        Session consumed · run <span className="text-orange-500/50">run classified</span> to generate a new session
      </div>

    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
// Props:
//   session: null
//           | { status: 'pending' }
//           | { status: 'challenged', token, code, expiresAt, sessionId, ... }
//           | { status: 'unlocked',  content, sessionId, decryptedAt, remainingMs }
const ClassifiedTab = ({ session }) => {
  if (!session || session.status === 'locked')     return <LockedPhase />;
  if (session.status === 'pending')                return <PendingPhase />;
  if (session.status === 'challenged')             return <ChallengedPhase session={session} />;
  if (session.status === 'unlocked')               return <UnlockedPhase session={session} />;
  return <LockedPhase />;
};

export default React.memo(ClassifiedTab);

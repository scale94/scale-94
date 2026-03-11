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
                 :            'text-green-400';

  const barColor = expired  ? 'bg-red-600'
                 : urgent   ? 'bg-red-500'
                 : warning  ? 'bg-yellow-500'
                 :            'bg-green-500';

  return (
    <div className="space-y-2">
      {/* Numeric display */}
      <div className={`font-mono text-5xl font-bold tabular-nums tracking-tight ${colorCls}`}
           style={{ fontVariantNumeric: 'tabular-nums' }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        <span className="text-2xl opacity-60">.{tenths}</span>
      </div>
      {/* Depletion bar */}
      <div className="h-1 bg-green-900/20 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-100`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Phase: LOCKED ─────────────────────────────────────────────────────────────
function LockedPhase() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto mt-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-green-900/40 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <KeyRound className="w-8 h-8 shrink-0 text-green-400"
              style={{ filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.6))' }} />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-cyan-400">
              CRYPTOGRAPHY
            </span>
          </h2>
          <div className="text-sm font-bold tracking-widest text-green-400/70 uppercase">
            POST-QUANTUM CRYPTOGRAPHY // ML-KEM-768 // FIPS 203
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-green-900/40 px-3 py-1 bg-black/40 text-green-500/60 rounded-sm font-mono">
          <Lock className="w-3 h-3" />
          ENCLAVE LOCKED
        </div>
      </div>

      {/* Initiate prompt */}
      <div className="mb-6 p-5 border border-green-500/20 bg-green-900/5 rounded-sm font-mono text-center">
        <div className="text-green-400/50 text-[10px] tracking-widest uppercase mb-3">
          CLASSIFIED PAYLOAD — AES-256-GCM ENCRYPTED
        </div>
        <div className="text-green-300/60 text-sm mb-2">
          Initiate time-locked decryption sequence from the terminal:
        </div>
        <div className="inline-block bg-black/60 border border-green-500/30 px-4 py-2 rounded-sm mt-1">
          <span className="text-green-500/60">{'>'} </span>
          <span className="text-green-300 font-bold">run classified</span>
        </div>
        <div className="text-green-500/30 text-[9px] mt-3">
          60-second challenge window · ML-KEM-768 session · single-use
        </div>
      </div>

      {/* Math block */}
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
          <div><span className="text-cyan-400/70 w-6 inline-block">A</span> public matrix ∈ ℤ<sub>q</sub><sup>k×k</sup></div>
          <div><span className="text-yellow-400/70 w-6 inline-block">s</span> secret vector ∈ ℤ<sub>q</sub><sup>k</sup> — private key core</div>
          <div><span className="text-orange-400/70 w-6 inline-block">e</span> error term — computationally hides s</div>
          <div><span className="text-green-300/70 w-6 inline-block">t</span> public key component (encapsulation key)</div>
          <div className="pt-1 text-green-500/40">q = 3329  ·  k = 3 (ML-KEM-768)  ·  best attack = O(2¹²⁸) quantum ops</div>
        </div>
      </div>

      {/* Key sizes */}
      <div className="mb-6">
        <div className="text-[9px] tracking-widest text-green-500/60 uppercase mb-3 font-mono">
          ML-KEM-768 KEY SIZES (FIPS 203 TABLE 2)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {KEY_SIZES.map(({ label, bytes, note }) => (
            <div key={label} className="border border-green-900/30 bg-black/40 p-3 rounded-sm flex items-center justify-between gap-3">
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

      {/* Security notes */}
      <div className="px-4 py-3 border border-green-500/10 bg-green-900/5 rounded-sm text-[10px] font-mono text-green-400/50 leading-relaxed">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-3 h-3 text-green-500/60 shrink-0" />
          <span className="text-green-500/70 font-bold tracking-widest uppercase text-[9px]">Security Architecture</span>
        </div>
        <ul className="space-y-1 ml-5 list-disc">
          <li>Payload encrypted with AES-256-GCM — decryption key lives only in server env vars</li>
          <li>Session tokens signed with HMAC-SHA256 — tampering is detectable without a database</li>
          <li>Time gate enforced server-side — client countdown is cosmetic only</li>
          <li>Challenge passphrase verified with <span className="text-green-300/60">crypto.timingSafeEqual</span> — no timing oracle</li>
          <li>ML-KEM-768 is NIST Category 3 — equivalent to AES-192 against quantum adversaries</li>
        </ul>
      </div>

    </div>
  );
}

// ── Phase: PENDING ────────────────────────────────────────────────────────────
function PendingPhase() {
  return (
    <div className="animate-in fade-in duration-300 max-w-5xl mx-auto mt-8">
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-6 h-6 border-2 border-green-500/40 border-t-green-400 rounded-full animate-spin" />
        <div className="text-green-400/60 font-mono text-sm tracking-widest uppercase">
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

      {/* Session header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-green-900/40 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <KeyRound className="w-8 h-8 shrink-0 text-green-400 animate-pulse"
              style={{ filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.8))' }} />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-300 to-cyan-400">
              CHALLENGE ACTIVE
            </span>
          </h2>
          <div className="font-mono text-[10px] text-green-500/60 tracking-widest">
            SESSION_ID: {session.sessionId}  ·  {session.algorithm}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-green-500/40 px-3 py-1 bg-green-900/10 text-green-400 rounded-sm font-mono">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
          ENCLAVE ACTIVE
        </div>
      </div>

      {/* Countdown + challenge code */}
      <div className={`mb-6 p-6 border rounded-sm font-mono ${
        expired ? 'border-red-900/50 bg-red-950/20' : urgent ? 'border-red-500/40 bg-red-900/10' : 'border-green-500/30 bg-green-900/5'
      }`}>
        <div className="grid md:grid-cols-2 gap-8 items-center">

          {/* Timer */}
          <div>
            <div className="text-[9px] tracking-widest text-green-500/50 uppercase mb-3">
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
            <div className="text-[9px] tracking-widest text-green-500/50 uppercase mb-3">
              ECHO PASSPHRASE
            </div>
            <div
              className={`text-4xl font-bold tracking-[0.3em] px-4 py-3 border rounded-sm text-center transition-all duration-300 ${
                expired
                  ? 'text-red-500/40 border-red-900/30 bg-black/20'
                  : 'text-green-300 border-green-500/40 bg-black/60'
              }`}
              style={!expired ? { filter: 'drop-shadow(0 0 12px rgba(74,222,128,0.4))' } : {}}
            >
              {session.code}
            </div>
            <div className="text-[9px] text-green-500/30 mt-2 text-center">
              {expired ? 'type run classified to restart' : 'case-insensitive · spaces ignored'}
            </div>
          </div>

        </div>
      </div>

      {/* Terminal instruction */}
      {!expired && (
        <div className="mb-6 p-4 border border-cyan-900/30 bg-cyan-950/10 rounded-sm font-mono">
          <div className="text-[9px] tracking-widest text-cyan-500/50 uppercase mb-2 flex items-center gap-2">
            <Activity className="w-3 h-3" /> TERMINAL COMMAND
          </div>
          <div className="text-sm text-cyan-300/80 mb-1">
            Type in the terminal input below:
          </div>
          <div className="bg-black/60 border border-cyan-900/30 px-3 py-2 rounded-sm inline-block">
            <span className="text-cyan-500/50">{'>'} </span>
            <span className="text-cyan-300">verify </span>
            <span className="text-green-300 font-bold tracking-widest">{session.code}</span>
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
          <div key={label} className="border border-green-900/30 bg-black/40 p-3 rounded-sm text-center font-mono">
            <div className="text-[9px] text-green-500/40 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-lg font-bold text-green-400 tabular-nums">{value}</div>
            <div className="text-[8px] text-green-500/30 uppercase tracking-widest">{unit}</div>
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

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-green-500/30 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <Unlock className="w-8 h-8 shrink-0 text-green-400"
              style={{ filter: 'drop-shadow(0 0 12px rgba(74,222,128,1))' }} />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 via-emerald-200 to-cyan-300">
              DECRYPTED
            </span>
          </h2>
          <div className="font-mono text-[10px] text-green-500/60 tracking-widest">
            SESSION_ID: {session.sessionId}  ·  AT: {decryptedAt}
            {session.remainingMs > 0 && (
              <span className="text-green-400/50">  ·  {(session.remainingMs / 1000).toFixed(1)}s remaining when decrypted</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs border border-green-400/40 px-3 py-1 bg-green-900/15 text-green-300 rounded-sm font-mono">
          <ShieldCheck className="w-3 h-3" />
          AES-GCM AUTH PASSED
        </div>
      </div>

      {/* Attestation row */}
      <div className="flex flex-wrap gap-2 mb-6 font-mono text-[9px]">
        {['HMAC-SHA256 ✓', 'TIME GATE ✓', 'CHALLENGE ✓', 'AES-256-GCM ✓'].map(label => (
          <span key={label} className="border border-green-500/25 bg-green-900/10 text-green-400/70 px-2 py-1 rounded-sm tracking-widest uppercase">
            {label}
          </span>
        ))}
      </div>

      {/* Decrypted content */}
      <div className="mb-6 border border-green-500/30 bg-black/70 rounded-sm overflow-hidden">
        <div className="border-b border-green-900/40 px-4 py-2 flex items-center gap-2 bg-green-900/10">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
          <span className="text-[9px] font-mono text-green-500/60 tracking-widest uppercase">
            CLASSIFIED PAYLOAD — PLAINTEXT
          </span>
        </div>
        <pre className="p-5 text-sm font-mono text-green-300/90 leading-relaxed whitespace-pre-wrap break-words">
          {typed}
          {typed.length < (session.content?.length ?? 0) && (
            <span className="animate-pulse text-green-400">█</span>
          )}
        </pre>
      </div>

      {/* Re-run note */}
      <div className="text-[9px] font-mono text-green-500/30 text-center">
        Session consumed · run <span className="text-green-400/50">run classified</span> to generate a new session
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

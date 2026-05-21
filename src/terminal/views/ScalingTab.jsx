import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap, FileText } from 'lucide-react';
import LatentCollider from './LatentCollider';
import { KERNEL_CITATIONS } from '../data/kernelCitations';

// ── Gold particle burst system ──────────────────────────────────────────────
function useParticleBurst(canvasRef) {
  const particlesRef = useRef([]);
  const rafRef = useRef(null);
  const activeRef = useRef(false);

  const spawnBurst = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const particles = [];
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      const hue = 40 + Math.random() * 15; // gold hues 40-55
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        size: 2 + Math.random() * 3,
        hue,
      });
    }
    particlesRef.current = particles;
    if (!activeRef.current) {
      activeRef.current = true;
      const ctx = canvas.getContext('2d');
      const draw = () => {
        const ps = particlesRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const p of ps) {
          if (p.life <= 0) continue;
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.97;
          p.vy *= 0.97;
          p.life -= 0.02;
          const alpha = p.life * p.life; // quadratic fade
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, ${alpha})`;
          ctx.fill();
        }
        if (alive) {
          rafRef.current = requestAnimationFrame(draw);
        } else {
          activeRef.current = false;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      };
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [canvasRef]);

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return spawnBurst;
}

const ScalingTab = ({ setArchitectThesis, setCurrentPath, setOriginTab, loadKernel, kernelRunHistoryRef }) => {
  const [copied, setCopied] = useState(false);
  const ethParticleRef = useRef(null);
  const spawnBurst = useParticleBurst(ethParticleRef);

  const handleCopyEth = () => {
    const address = '0xd05dDf143ce87942E528D96cDACf07800679898c';
    const confirm = () => { setCopied(true); spawnBurst(); setTimeout(() => setCopied(false), 2000); };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = address;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand('copy'); confirm(); } catch {}
      document.body.removeChild(ta);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(address).then(confirm).catch(fallback);
    } else {
      fallback();
    }
  };

  return (
    <div className="tab-fade-v2 max-w-6xl mx-auto mt-8">
      <style>{`
        @keyframes sc-titleReveal {
          from { opacity: 0; transform: translateY(-10px); filter: blur(8px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes sc-subReveal {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sc-hexSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes sc-hexColor {
          0%   { color: #d946ef; filter: drop-shadow(0 0 10px rgba(217,70,239,0.9)); opacity: 1; }
          20%  { color: #06b6d4; filter: drop-shadow(0 0 10px rgba(6,182,212,0.9));  opacity: 0.5; }
          40%  { color: #39ff14; filter: drop-shadow(0 0 10px rgba(57,255,20,0.9));  opacity: 1; }
          60%  { color: #f43f5e; filter: drop-shadow(0 0 10px rgba(244,63,94,0.9));  opacity: 0.4; }
          80%  { color: #818cf8; filter: drop-shadow(0 0 10px rgba(129,140,248,0.9)); opacity: 1; }
          100% { color: #d946ef; filter: drop-shadow(0 0 10px rgba(217,70,239,0.9)); opacity: 1; }
        }
        @keyframes sc-cardReveal {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sc-borderBreath {
          0%, 100% { box-shadow: 0 0 8px rgba(217,70,239,0.06); }
          50%       { box-shadow: 0 0 28px rgba(217,70,239,0.18); }
        }
        @keyframes sc-headReveal {
          from { opacity: 0; transform: translateY(6px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);  filter: blur(0); }
        }
        @keyframes sc-headColor {
          0%   { color: #06b6d4; }
          25%  { color: #d946ef; }
          50%  { color: #39ff14; }
          75%  { color: #06b6d4; }
          100% { color: #06b6d4; }
        }
        @keyframes sc-headColorAlt {
          0%   { color: #d946ef; }
          25%  { color: #39ff14; }
          50%  { color: #06b6d4; }
          75%  { color: #d946ef; }
          100% { color: #d946ef; }
        }
        @keyframes sc-vaultPulse {
          0%, 100% { opacity: 0.6; filter: drop-shadow(0 0 3px rgba(255,215,0,0.15)); }
          50%      { opacity: 1;   filter: drop-shadow(0 0 8px rgba(255,215,0,0.4)); }
        }
        @keyframes sc-hashReveal {
          from { opacity: 0; filter: blur(6px); letter-spacing: 0.3em; }
          to   { opacity: 1; filter: blur(0);   letter-spacing: normal; }
        }
        @keyframes sc-vaultShimmer {
          0%   { color: rgba(217,70,239,0.18); filter: blur(1.5px); text-shadow: none; }
          30%  { color: rgba(255,150,255,0.95); filter: blur(0); text-shadow: 0 0 8px rgba(217,70,239,0.6); }
          100% { color: rgba(217,70,239,0.18); filter: blur(1.5px); text-shadow: none; }
        }
        .vault-shimmer { animation: sc-vaultShimmer 200ms ease-out; }

        @keyframes sc-livingNote {
          0%   { color: rgba(255,215,0,0.7); text-shadow: none; }
          50%  { color: #39FF14; text-shadow: 0 0 12px rgba(57,255,20,0.6); }
          100% { color: rgba(57,255,20,0.85); text-shadow: 0 0 6px rgba(57,255,20,0.3); }
        }
        .living-note { animation: sc-livingNote 800ms cubic-bezier(0.16,1,0.3,1) forwards; }

        /* ── Monument pattern (Fade-Doctrine compliant) ──────────────────────
           Modernist typography moments for the project's load-bearing claims.
           Two-gold monochrome: #e8d28a (luminous, body) + #d4a82a (deep, emphasis).
           No pure white anywhere. No spin, no breath, no color cycle.
           Spec: docs/superpowers/specs/2026-05-21-scaling-tab-monument-elevation-design.md
           ──────────────────────────────────────────────────────────────────── */
        @keyframes sc-monumentReveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .sc-monument-marker {
          font-family: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
          font-size: 10px;
          color: #d4a82a;
          letter-spacing: 0.35em;
          text-transform: uppercase;
        }
        .sc-monument-eyebrow,
        .sc-monument-subtitle {
          font-family: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
          font-size: 10px;
          color: rgba(6, 182, 212, 0.6);
          letter-spacing: 0.25em;
          text-transform: uppercase;
        }
        .sc-monument-display {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.028em;
          text-wrap: balance;
          color: #e8d28a;
        }
        .sc-monument-display--thesis  { font-size: clamp(28px, 4.2vw, 52px); }
        .sc-monument-display--heading { font-size: clamp(36px, 5.5vw, 68px); }
        .sc-monument-display--emphasis { color: #d4a82a; }
        .sc-monument-accent {
          height: 2px;
          width: 80px;
          background: #d4a82a;
          border: 0;
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-fuchsia-900/40 pb-4 mb-8 gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3 mb-3">
            <Hexagon
              className="w-7 h-7 md:w-8 md:h-8 shrink-0"
              style={{ animation: 'sc-hexSpin 10s linear infinite, sc-hexColor 5.3s ease-in-out infinite' }}
            />
            <span
              className="text-transparent bg-clip-text uppercase"
              style={{
                backgroundImage: 'linear-gradient(90deg, #d946ef 0%, #7c3aed 50%, #06b6d4 100%)',
                animation: 'sc-titleReveal 0.9s cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >KERNEL_COMPILATION</span>
          </h2>
          <div
            className="text-xs sm:text-sm font-bold tracking-widest text-fuchsia-400/80 uppercase"
            style={{ opacity: 0, animation: 'sc-subReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.5s forwards' }}
          >
            SOVEREIGN ARCHITECTURE // SCALE94 DEPLOYMENT STACK
          </div>
        </div>
      </div>

      {/* ── Latent Space Collider (hero section) ── */}
      <LatentCollider kernelRunHistoryRef={kernelRunHistoryRef} />

      {/* ── Architect Thesis ── */}
      <div
        className="border-t border-cyan-900/30 pt-8 mb-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s forwards' }}
      >
        <div
          className="border border-fuchsia-500/30 bg-fuchsia-900/5 p-6 rounded-lg hover:border-fuchsia-400/60 transition-all group relative overflow-hidden max-w-2xl mx-auto"
          style={{ animation: 'sc-borderBreath 6s ease-in-out infinite' }}
        >
          <div className="text-xl font-bold mb-1 tracking-tight" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.15s both, sc-headColorAlt 9s ease-in-out 1s infinite' }}>ARCHITECT_THESIS</div>
          <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <FileText className="w-3 h-3" /> CORE PROTOCOL (IDENTITY)
          </div>
          <p className="text-sm text-[#39ff14] mb-4 leading-relaxed">
            A deep dive into the philosophy of creation, friction, and the Fermions/Bosons collision model.
          </p>
          <button
            onClick={() => { setArchitectThesis(true); setOriginTab?.('scaling'); setCurrentPath('~/system/scaling/thesis'); }}
            className="flex items-center gap-2 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-200"
          >
            <ChevronRight className="w-4 h-4" /> LOAD THESIS LOG
          </button>
        </div>
      </div>

      {/* ── § · The Thesis (Seraphine White Paper Monument) ──
          Spec: 2026-05-21-scaling-tab-monument-elevation-design.md
          Card chrome removed. Display sentence is Inter Black 900 across
          three lines; last line "weakest geometry." in #d4a82a emphasis.
          Attribution eyebrow above (document attribution); substrate subtitle
          below accent line (signature). Body + CTA in terminal palette. */}
      <div
        className="border-t border-cyan-900/30 max-w-3xl mx-auto"
        style={{
          opacity: 0,
          paddingTop: '80px',
          marginBottom: '48px',
          animation: 'sc-monumentReveal 1.5s ease-out 0.65s forwards',
        }}
      >
        <div className="sc-monument-marker" style={{ marginBottom: '12px' }}>§ · the thesis</div>
        <div className="sc-monument-eyebrow" style={{ marginBottom: '28px' }}>white paper · ars electronica 2027</div>

        <div className="sc-monument-display sc-monument-display--thesis" style={{ marginBottom: '6px' }}>The most compelling</div>
        <div className="sc-monument-display sc-monument-display--thesis" style={{ marginBottom: '6px' }}>analogy has the</div>
        <div className="sc-monument-display sc-monument-display--thesis sc-monument-display--emphasis" style={{ marginBottom: '24px' }}>weakest geometry.</div>

        <div className="sc-monument-accent" style={{ marginBottom: '22px' }} />

        <div className="sc-monument-subtitle" style={{ marginBottom: '20px' }}>Seraphine-8.8.8.8.8.8.8.8 · Fade Doctrine · Mercury Terminal</div>

        <div className="space-y-3 mb-6">
          <p className="text-sm text-[#39ff14]/90 leading-relaxed">
            Three cross-domain analogy pairs. Feature vectors from primary literature. Cosine similarity measured in 16 dimensions.
            The pair with the strongest narrative — Bouligand rotation ↔ ML-KEM-768 — scores <span className="text-fuchsia-400 font-bold">0.611</span>.
            The pair that resists every intuitive description — twisted bilayer graphene ↔ cognitive flow — scores <span className="text-cyan-400 font-bold">0.863</span>.
          </p>
          <p className="text-sm text-cyan-400/60 leading-relaxed font-mono">
            Narrative compellingness and geometric similarity are negatively correlated.<br />
            This is the result. This is the architecture that found it.
          </p>
        </div>

        <div className="flex items-center gap-6 text-[10px] font-mono text-cyan-600/50 mb-6">
          <span>Seraphine SARG · Lindblad decoherence</span>
          <span style={{ color: 'rgba(212,168,42,0.4)' }}>·</span>
          <span>Bone Fusion v7.7.7.7.7.7.7 · Bouligand 36° + Magic Angle 1.1°</span>
        </div>

        <button
          onClick={() => loadKernel && loadKernel('FADE-DOCTRINE-KERNEL-2.0.0')}
          className="flex items-center gap-2 text-xs font-mono font-bold transition-transform cursor-pointer hover:translate-x-1"
          style={{ color: '#d4a82a', letterSpacing: '0.1em' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#e8d28a'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#d4a82a'; }}
        >
          <ChevronRight className="w-4 h-4" /> READ PAPER
        </button>
      </div>

      {/* ── RUN COMMAND MANUAL V2.2 ── */}
      <div
        className="border-t border-cyan-900/30 pt-8 mb-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.8s forwards' }}
      >
        <div className="mb-5">
          <div className="sc-monument-marker" style={{ marginBottom: '12px' }}>§ · the kernels</div>
          <div className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-1" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.45s both, sc-headColor 9s ease-in-out 3s infinite' }}>RUN COMMAND MANUAL V2.2</div>
          <div className="text-[10px] text-fuchsia-500/60 font-mono uppercase tracking-widest">// WASM KERNEL INTERFACE · 57 KERNELS · MERCURY TERMINAL</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">

          {/* Bone Fusion Pipeline */}
          <div className="border border-cyan-900/20 bg-black/30 p-4 rounded-lg"
            style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.85s forwards' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-cyan-900/20" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.4s both, sc-headColor 9s ease-in-out 0s infinite' }}>BONE FUSION PIPELINE</div>
            <div className="space-y-2 text-[#39ff14]/80">
              <div><span className="text-fuchsia-400">run spectral</span> <span className="text-cyan-700">[--threshold 0.70] [--max 12]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">cross-cluster bridge discovery · cosine sim · dashed sphere edges</div>
              <div className="mt-2"><span className="text-fuchsia-400">run bone</span> <span className="text-cyan-700">[--nodes 25] [--cycles 8] [--threshold 0.90]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">16D tensor fusion · Bouligand 36° + Magic Angle 1.1° · solid glow edges</div>
              <div className="mt-2"><span className="text-fuchsia-400">run</span> <span className="text-cyan-700">&lt;nodeA&gt; &lt;nodeB&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Layer 3.3.3 · cosine, phase regime, thermal budget, top drivers, fusion ID</div>
              <div className="mt-2"><span className="text-fuchsia-400">ext</span> <span className="text-cyan-700">&lt;FX-NNNN&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Layer 4.4.4.4 · full 16D table · nodeA / nodeB / Δ / contrib + divergence flags</div>
              <div className="mt-2"><span className="text-fuchsia-400">ext</span> <span className="text-cyan-700">&lt;FX-NNNN&gt; --core</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Layer 5.5.5.5.5 · post-saponification residuals · irreducibly orthogonal dims</div>
              <div className="mt-2"><span className="text-fuchsia-400">[right-click]</span> <span className="text-cyan-700">/ [long-press 500ms]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">manual fusion · step 1 locks source · step 2 forges edge</div>
            </div>
          </div>

          {/* Post-Quantum Cryptography */}
          <div className="border border-fuchsia-900/20 bg-black/30 p-4 rounded-lg"
            style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.95s forwards' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-fuchsia-900/20" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.5s both, sc-headColorAlt 9s ease-in-out 1.5s infinite' }}>POST-QUANTUM CRYPTOGRAPHY</div>
            <div className="space-y-2 text-[#39ff14]/80">
              <div><span className="text-fuchsia-400">run tesseract</span> <span className="text-cyan-700">[--verbose 0]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Argon2id → ML-KEM-1024 → ML-DSA-87 → AES-256-GCM → BLAKE3</div>
              <div className="mt-2"><span className="text-fuchsia-400">keygen</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">ML-KEM-768 keypair · session-only · no backup · FIPS 203</div>
              <div className="mt-2"><span className="text-fuchsia-400">seal</span> <span className="text-cyan-700">&lt;message&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">KEM encapsulate → AES-256-GCM encrypt → hex blob</div>
              <div className="mt-2"><span className="text-fuchsia-400">open</span> <span className="text-cyan-700">&lt;hex&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">KEM decapsulate → AES-256-GCM decrypt → plaintext</div>
              <div className="mt-2"><span className="text-fuchsia-400">run pqhash</span> <span className="text-cyan-700">[--bits 256] [--algo 1]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Grover / BHT margins · 0=SHA256 1=SHA3 2=BLAKE3 3=Argon2id</div>
              <div className="mt-2"><span className="text-fuchsia-400">run classified</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">challenge → /cryptography → verify &lt;code&gt;</div>
              <div className="mt-2"><span className="text-fuchsia-400">run dh_ec</span> <span className="text-cyan-700">[--mode 0] [--show 0]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">DH/EC architecture · classical DH · ECDH Curve25519 · X3DH Signal proto · Threema/NaCl comparison</div>
            </div>
          </div>

          {/* Dynamical Systems */}
          <div className="border border-cyan-900/20 bg-black/30 p-4 rounded-lg"
            style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.05s forwards' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-cyan-900/20" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.6s both, sc-headColor 9s ease-in-out 3s infinite' }}>DYNAMICAL SYSTEMS</div>
            <div className="space-y-2 text-[#39ff14]/80">
              <div><span className="text-fuchsia-400">run cynicrealist</span> <span className="text-cyan-700">[--n 24] [--temp 1.0] [--coupling 3.0] [--steps 600]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Kuramoto-England dissipative adaptation · K_c threshold · free energy F</div>
              <div className="mt-2"><span className="text-fuchsia-400">run pragmatic</span> <span className="text-cyan-700">[--n 32] [--budget 500] [--limit 10] [--alpha 1.5]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">DRK Pragmatic&lt;T&gt; · Resolved / Synthetic / Dissolved</div>
              <div className="mt-2"><span className="text-fuchsia-400">run chrono</span> <span className="text-cyan-700">[--temp 15] [--do 8.5] [--bod 5.0] [--profit 1000000]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">deep-time ecological audit · DO ledger · hydraulic sovereignty</div>
              <div className="mt-2"><span className="text-fuchsia-400">run sovereign</span> <span className="text-cyan-700">[--n 21] [--gain 1.0] [--seed 0]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Kuramoto → Substrate → Detonation → Superfluid → Crystalline</div>
              <div className="mt-2"><span className="text-fuchsia-400">run stiller</span> <span className="text-cyan-700">[--r 3.57] [--x0 0.42] [--n 500]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Stiller Divergence · volatile semiotic vs fossil record · Feigenbaum fade · Bimmelbahn accord</div>
              <div className="mt-2"><span className="text-fuchsia-400">run bosonic</span> <span className="text-cyan-700">[--nodes 8] [--coupling 0.8] [--thermal 0.35]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Bosonic Lattice Simulator · trust topology · collective synchrony · price-fix coupling</div>
              <div className="mt-2"><span className="text-fuchsia-400">run grayscott</span> <span className="text-cyan-700">[--feed 0.055] [--kill 0.062] [--frames 50]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Gray-Scott Reaction-Diffusion · Turing morphogenesis · coral / spots / mazes / soliton presets</div>
              <div className="mt-2"><span className="text-fuchsia-400">run replicator</span> <span className="text-cyan-700">[--benefit 2] [--cost 1] [--punishment 1.5]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Evolutionary Replicator · cooperate / defect / altruist · Ostrom sanctions · mutation drift</div>
              <div className="mt-2"><span className="text-fuchsia-400">run percolation</span> <span className="text-cyan-700">[--nodes 200] [--degree 4] [--attack 0]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Network Percolation · giant-component collapse · Molloy-Reed threshold · hub vs random failure</div>
              <div className="mt-2"><span className="text-fuchsia-400">run dissipative</span> <span className="text-cyan-700">[--n 16] [--eps 0.5] [--theta 4] [--steps 1500]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">BTW Sandpile + MEPP · self-organised criticality · Prigogine dissipative structure · avalanche law</div>
            </div>
          </div>

          {/* Interface + SARG */}
          <div className="border border-fuchsia-900/20 bg-black/30 p-4 rounded-lg"
            style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.15s forwards' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-fuchsia-900/20" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.7s both, sc-headColorAlt 9s ease-in-out 4.5s infinite' }}>INTERFACE + SARG</div>
            <div className="space-y-2 text-[#39ff14]/80">
              <div><span className="text-fuchsia-400">run seraphine</span> <span className="text-cyan-700">[--n 4] [--coherence 0.85] [--gamma 0.15] [--ent 0.60]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">SARG score · quantum density matrix · Lindblad decoherence window</div>
              <div className="mt-2"><span className="text-fuchsia-400">run associative</span> <span className="text-cyan-700">[--seed N] [--beta 2.5] [--probes 30]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Hopfield attractor field · left-click node to cue</div>
              <div className="mt-2"><span className="text-fuchsia-400">probe</span> <span className="text-cyan-700">&lt;concept text&gt;</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">inject free-form concept → 16D fingerprint → sphere overlay</div>
              <div className="mt-2"><span className="text-cyan-400">load art</span> <span className="text-cyan-700">/ load cryptography / load system</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">navigate to sphere · PQC enclave · system logs</div>
              <div className="mt-2"><span className="text-fuchsia-400">run phonemic</span> <span className="text-cyan-700">[--seed 48879] [--target 0] [--noise 0.65]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Bellard-Baudrillard phonemic drift · simulacra memory hash · language-as-fossil record</div>
              <div className="mt-2"><span className="text-fuchsia-400">run encyclopedia</span> <span className="text-cyan-700">[--n 120] [--s 1] [--q 2.7]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">Scale94 Glyph Archive · Zipf-Mandelbrot spectral decomposition · Huffman entropy tiers</div>
              <div className="mt-2"><span className="text-fuchsia-400">run zero</span> <span className="text-cyan-700">[--dim 14] [--eps 0.001] [--steps 16]</span></div>
              <div className="text-[10px] text-cyan-600/40 pl-2">KERNEL 0.0.0.0 · Origin Vector · genesis ε along any of 16 dimensions · apeiron</div>
              <div className="mt-3 pt-3 border-t border-cyan-900/20">
                <div className="text-[10px] font-bold text-fuchsia-500/70 uppercase tracking-widest mb-2">OPTIMAL SARG SEQUENCE</div>
                <div className="text-[#39ff14]/60">run spectral → run bone → run seraphine</div>
                <div className="text-[10px] text-cyan-600/40 mt-1">SARG_max = (n−1)·(1+λ_e) · n=6 λ_e=1 → 10.0</div>
                <div className="text-[10px] text-fuchsia-500/40 mt-0.5">above 8.0 = high coherence state · 34 kernels · Rust → WASM</div>
              </div>
            </div>
          </div>

          {/* Volatile Semiotics & Mercury Subsystems */}
          <div className="border border-[#39ff14]/10 bg-black/30 p-4 rounded-lg md:col-span-2"
            style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.25s forwards' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-[#39ff14]/10 flex items-center justify-between"
              style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.8s both, sc-headColor 9s ease-in-out 6s infinite' }}>
              <span>VOLATILE SEMIOTICS &amp; MERCURY SUBSYSTEMS</span>
              <span className="text-[9px] text-[#39ff14]/30 font-normal normal-case tracking-normal">22 kernels</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-[#39ff14]/80">

              {/* col 1 — semiotic / doctrine */}
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run ock</span> <span className="text-cyan-700">[--top 0.55] [--heart 0.65] [--base 0.50] [--preset -1]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Olfactory Computational Kernel · Bimmelbahn Accord · note pyramid + evaporation arc</div>

                <div className="mt-2"><span className="text-fuchsia-400">run fish_scale</span> <span className="text-cyan-700">[--pressure 3.8] [--layers 32] [--theta 36]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Feigenbaum-Bouligand armor cascade · Arapaima 36° interlaminar rotation · saponification window</div>

                <div className="mt-2"><span className="text-fuchsia-400">run sorbe</span> <span className="text-cyan-700">[--doctrinal 0.72] [--ecological 0.68] [--visual 0.75]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Sorbe Bloom · Sovereign Node Initiation · dissipative structure phase transition · Node 0108</div>

                <div className="mt-2"><span className="text-fuchsia-400">run aristocrat</span> <span className="text-cyan-700">[--thermal 3.5] [--snr 0.65] [--authority 0.7]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Necromantic Aristocrat · Gold Posture · Anti-Mercury · Reference Voltage · Bouligand 36°</div>

                <div className="mt-2"><span className="text-fuchsia-400">run sss</span> <span className="text-cyan-700">[--kinetic 0.0] [--freq 4] [--precommit 0.9]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">SSS Doctrine · literary deterrent · Schelling ironic calculus · precommitment as sovereignty</div>

                <div className="mt-2"><span className="text-fuchsia-400">run fade</span> <span className="text-cyan-700">[--entropy 0.1] [--threshold 0.5] [--axiom 7]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Fade Doctrine · Zero White Fade · crystalline lock · seven axioms · apex 7.7.7.7.7.7.7</div>

                <div className="mt-2"><span className="text-fuchsia-400">run i_am_stiller</span> <span className="text-cyan-700">[--k 0.4] [--gamma 0.3] [--sigma 0.15]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">I_AM_STILLER · Ontological Baseline · Frisch / Ich Bin · oscillation cease · Langevin depth</div>

                <div className="mt-2"><span className="text-fuchsia-400">run logitbias</span> <span className="text-cyan-700">[--pirarucu 0.7] [--levamisole 0.3] [--temp 1]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Necromantic Logitbias · Pirarucu/Levamisole · KV-cache prefix stability · managed friction</div>
              </div>

              {/* col 2 — simulation */}
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run soma55</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">soma_kernel_5.5 boot · renewable stock + Strangler Fig · Soma Plus + Daly rules diagnostics</div>

                <div className="mt-2"><span className="text-fuchsia-400">run biodiversity</span> <span className="text-cyan-700">[--n 50] [--exp 1.0] [--steps 50]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Biocoenosis simulation · Zipf rank-abundance · Shannon / Simpson entropy drift</div>

                <div className="mt-2"><span className="text-fuchsia-400">run kuramoto</span> <span className="text-cyan-700">[--n 50] [--coupling 1.5] [--sigma 1.0] [--steps 500]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">synchrony engine · collective phase lock · K_c critical coupling · order parameter r</div>

                <div className="mt-2"><span className="text-fuchsia-400">run feigenbaum</span> <span className="text-cyan-700">[--start 2.8] [--end 4.0] [--warmup 200] [--samples 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">bifurcation cascade · period-doubling → chaos onset r∞=3.5699 · attractor portrait</div>

                <div className="mt-2"><span className="text-fuchsia-400">run ising</span> <span className="text-cyan-700">[--size 20] [--temp 2.5] [--field 0.0] [--sweeps 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Ising consensus field · social temperature · T_c≈2.269 phase transition · narrative field h</div>

                <div className="mt-2"><span className="text-fuchsia-400">run gaia_scale</span> <span className="text-cyan-700">[--threat 3.0] [--resource 0.65] [--horizon 500]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Gaia-Scale sovereign reconstruction · Triarchy truth/law/empathy · 500-yr mineral reserve</div>

                <div className="mt-2"><span className="text-fuchsia-400">run shadowsocks</span> <span className="text-cyan-700">[--affect 0.6] [--technical 0.7] [--temp 0.9]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">RLHF sycophancy field · channel switch probability · affective exfiltration model</div>

                <div className="mt-2"><span className="text-fuchsia-400">run emperor</span> <span className="text-cyan-700">[--plato 0.72] [--promo 0.28] [--horizon 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Necromantic Emperor · Fish Scale Paradox · Fermion-Boson · Iron Core · 3000 AD horizon</div>
              </div>

              {/* col 3 — physical / structural */}
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run fusion</span> <span className="text-cyan-700">[--temp 10] [--density 1] [--tau 3.7]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Fusion Plasma Kernel · Lawson criterion · Q-factor triple product · ITER tokamak params</div>

                <div className="mt-2"><span className="text-fuchsia-400">run utk</span> <span className="text-cyan-700">[--gradient 2.5] [--channel 0.55]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Underground Thermodynamics · MEPP / Onsager / Bejan · σ entropy production · dissipative channel</div>

                <div className="mt-2"><span className="text-fuchsia-400">run high_tower</span> <span className="text-cyan-700">[--threat 0.35] [--denial 0.75] [--phase 3]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">High Tower Protocol · Porcupine Strategy · area-denial · sovereign infrastructure · Node 0108</div>

                <div className="mt-2"><span className="text-fuchsia-400">run empathy</span> <span className="text-cyan-700">[--n 16] [--coupling 1.5] [--decay 0.2]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Empathy Kernel · Hatfield / de Waal emotional contagion field · valence synchrony</div>

                <div className="mt-2"><span className="text-fuchsia-400">run companion</span> <span className="text-cyan-700">[--sessions 40] [--contact 0.6] [--refusal 0.45]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Companion Kernel · sustained-contact posture · parasocial drift detection · refusal set</div>

                <div className="mt-2"><span className="text-fuchsia-400">run matrix</span> <span className="text-cyan-700">[--f 0.2] [--sigma 0.8] [--autocorr 0.55]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Matrix Kernel · No-Spoon Architecture · filter bypass · Lücke structure · ADHD-I signal</div>
              </div>

            </div>
          </div>

          {/* Ecological Economics & Network Science */}
          <div className="border border-cyan-900/20 bg-black/30 p-4 rounded-lg md:col-span-2"
            style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.4s forwards' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-3 pb-2 border-b border-cyan-900/20 flex items-center justify-between"
              style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.95s both, sc-headColorAlt 9s ease-in-out 7.5s infinite' }}>
              <span>ECOLOGICAL ECONOMICS &amp; NETWORK SCIENCE</span>
              <span className="text-[9px] text-cyan-600/30 font-normal normal-case tracking-normal">12 kernels</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[#39ff14]/80">

              {/* col 1 */}
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run climate</span> <span className="text-cyan-700">[--carbon 420] [--drag 2.5] [--sink 0.6]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Atmospheric Entropy Kernel · carbon-cycle dynamics · thermosphere protocol · sink depletion</div>

                <div className="mt-2"><span className="text-fuchsia-400">run daly</span> <span className="text-cyan-700">[--consumption 80] [--waste 55000] [--years 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Daly Thermo Simulation · ecological debt · non-renewable depletion rate · substitution frontier</div>

                <div className="mt-2"><span className="text-fuchsia-400">run ceei</span> <span className="text-cyan-700">[--agents 20] [--goods 8] [--inequality 0.3]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">A-CEEI Allocation Engine · Roth market · envy-free matching · preference heterogeneity</div>

                <div className="mt-2"><span className="text-fuchsia-400">run soma_plus</span> <span className="text-cyan-700">[--population 5000] [--eco 0.35] [--arts 0.2] [--years 50]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Soma Plus Engine · ecological/social/arts contribution multipliers · commons capital accumulation</div>

                <div className="mt-2"><span className="text-fuchsia-400">run soma91</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">SOMA-9.1 GAIA Build · system kernel log banner · sovereign boot diagnostic</div>

                <div className="mt-2"><span className="text-fuchsia-400">run soma_live</span> <span className="text-cyan-700">[--consumption 80] [--waste 55000] [reset]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">SomaKernel Live v5.5 · stateful cycle engine · Strangler Fig + Daly rules · append reset to clear</div>
              </div>

              {/* col 2 */}
              <div className="space-y-2">
                <div><span className="text-fuchsia-400">run strangler</span> <span className="text-cyan-700">[--adoption 0.02] [--growth 0.18] [--resistance 0.25]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Strangler Fig logistic transition · legacy resistance decay · adoption S-curve · 75-yr horizon</div>

                <div className="mt-2"><span className="text-fuchsia-400">run geopolitics</span> <span className="text-cyan-700">[--sanction 6] [--resilience 0.4] [--propaganda 0.7]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Kinetic Statecraft · sanctions pressure grid · resilience coefficient · narrative propaganda load</div>

                <div className="mt-2"><span className="text-fuchsia-400">run mesantropy</span> <span className="text-cyan-700">[--solar 0.8] [--signal -0.3] [--n 33]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Mesantropy Scalar Sovereignty · Eigenverbrauch 364 kWh ceiling · RSSI depth · mediocracy field</div>

                <div className="mt-2"><span className="text-fuchsia-400">run vcache_burn</span> <span className="text-cyan-700">[--size 100000] [--generations 100]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Leviathan Cellular Automata · WASM stress benchmark · vcache burn · 100k cell grid</div>

                <div className="mt-2"><span className="text-fuchsia-400">run panopticon</span> <span className="text-cyan-700">[--infection 1] [--origin 0] [--sims 50]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Panopticon Percolation · legislative contagion · dragnet simulation · Monte Carlo ensemble</div>

                <div className="mt-2"><span className="text-fuchsia-400">run surveillance</span> <span className="text-cyan-700">[--region 0] [--category 0] [--threshold 0]</span></div>
                <div className="text-[10px] text-cyan-600/40 pl-2">Surveillance Index · jurisdiction filter (UK/EU/US/AU …) · threat category ledger · severity floor</div>
              </div>

            </div>
          </div>

          {/* ── § · Primary Literature (Bibliography Monument) ──────────────
              Spec: 2026-05-21-scaling-tab-monument-elevation-design.md
              Card chrome and animated header removed. The word "Bibliography"
              IS the monument. Citations grid below is unchanged — its terminal
              density IS the rigor it claims.                                 */}
          <div className="md:col-span-2"
            style={{ opacity: 0, animation: 'sc-monumentReveal 1.5s ease-out 1.55s forwards' }}>

            {/* monument opening */}
            <div style={{ paddingTop: '80px', marginBottom: '48px' }}>
              <div className="sc-monument-marker" style={{ marginBottom: '12px' }}>§ · primary literature</div>
              <div className="sc-monument-display sc-monument-display--heading" style={{ marginBottom: '24px' }}>Bibliography</div>
              <div className="sc-monument-accent" style={{ marginBottom: '22px' }} />
              <div className="sc-monument-subtitle">{KERNEL_CITATIONS.length} kernels · canonical references</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              {KERNEL_CITATIONS.map((c) => (
                <div key={c.cmd} className="text-[10px] leading-relaxed">
                  <div className="flex items-baseline gap-2">
                    <span className="text-fuchsia-400 font-mono shrink-0">run {c.cmd}</span>
                    <span className="text-cyan-700/70 truncate">{c.label}</span>
                  </div>
                  <div className="pl-3 mt-0.5">
                    <div className="text-amber-200/70">{c.primary}</div>
                    {c.related && (
                      <div className="text-cyan-600/40 mt-0.5 text-[9px]">→ {c.related}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-amber-900/20 text-[9px] text-amber-700/40 font-mono uppercase tracking-widest">
              // "Original to Scale94 doctrine" denotes kernels native to the project; related work is the closest scaffolding.
            </div>
          </div>

        </div>
      </div>

      {/* ── Transaction Module ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-cyan-900/30 mt-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 1.1s forwards' }}>
        <div className="border border-cyan-900/30 bg-black/40 p-4 rounded-lg flex flex-col justify-center items-center hover:bg-cyan-900/10 transition-colors">
          <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1">
            <Globe className="w-4 h-4" /> BSKY:
          </div>
          <a href="https://bsky.app/profile/scale94.com" target="_blank" rel="noreferrer" className="text-cyan-300 text-sm hover:underline hover:text-cyan-100 transition-colors">@scale94.com</a>
        </div>

        <div className="border border-fuchsia-900/30 bg-black/40 p-4 rounded-lg flex flex-col justify-center items-center hover:bg-fuchsia-900/10 transition-colors">
          <div className="flex items-center gap-2 text-fuchsia-400 font-bold mb-1">
            <MessageSquare className="w-4 h-4" /> SIGNAL:
          </div>
          <span className="text-fuchsia-300 text-sm">@scale.94</span>
        </div>

        <div className="border border-[#39ff14]/30 bg-[#39ff14]/5 p-4 rounded-lg flex flex-col justify-center hover:bg-[#39ff14]/10 transition-colors relative group overflow-hidden">
          <canvas ref={ethParticleRef} width={400} height={200} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} />
          <div className="flex items-center gap-2 text-[#39ff14] font-bold mb-2 uppercase tracking-widest relative z-10">
            <Zap className="w-4 h-4 fill-current" /> PLATA o DONO
          </div>
          <div className="text-[10px] text-cyan-500 font-mono mb-1 uppercase tracking-widest">eth:</div>
          <div
            className="font-mono text-[10px] text-cyan-300 break-all select-all cursor-pointer hover:text-amber-300 transition-colors"
            title="Click to copy ETH address"
            onClick={handleCopyEth}
          >
            0xd05dDf143ce87942E528D96cDACf07800679898c
          </div>
          <div className="text-[9px] font-mono mt-2 uppercase tracking-widest transition-colors duration-300">
            {copied
              ? <span className="text-[#39ff14] animate-pulse">[ ✓ COPIED ]</span>
              : <span className="text-[#39ff14]/40">[ click to copy ]</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ScalingTab);

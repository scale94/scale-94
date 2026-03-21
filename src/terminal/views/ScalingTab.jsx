import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap, FileText, Cpu } from 'lucide-react';

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

const ScalingTab = ({ setArchitectThesis, setCurrentPath, loadKernel }) => {
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto mt-8">
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
      `}</style>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-fuchsia-900/40 pb-4 mb-8 gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3 mb-1">
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
            >KERNEL_BUILDING_SERVICES</span>
          </h2>
          <div
            className="text-xs sm:text-sm font-bold tracking-widest text-fuchsia-400/80 uppercase"
            style={{ opacity: 0, animation: 'sc-subReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.5s forwards' }}
          >
            SOVEREIGN ARCHITECTURE // SCALE94 DEPLOYMENT STACK
          </div>
        </div>
      </div>

      {/* ── Main Service Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* SEED_KERNEL */}
        <div className="border border-cyan-900/30 bg-black/40 p-6 rounded-lg hover:border-cyan-500/50 transition-all group relative overflow-hidden"
          style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s forwards' }}>
          <div className="text-lg font-bold mb-2" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.75s both, sc-headColor 9s ease-in-out 0.75s infinite' }}>SEED_KERNEL</div>
          <div className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-widest mb-4">[BASIC]</div>
          <p className="text-sm text-[#39ff14] mb-8 leading-relaxed h-20">
            A single, robust system prompt tailored to a specific user persona or goal.
          </p>
          <a href="mailto:scale0097@gmail.com" className="flex items-center gap-2 text-xs font-bold text-[#39ff14] group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-400">
            <ChevronRight className="w-4 h-4" /> DEPLOY
          </a>
        </div>

        {/* SYSTEM_ARCH */}
        <div className="border border-fuchsia-500/30 bg-fuchsia-900/5 p-6 rounded-lg hover:border-fuchsia-400/60 transition-all group relative overflow-hidden"
          style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s forwards' }}>
          <div className="absolute top-0 right-0 bg-fuchsia-500 text-black text-[9px] font-bold px-2 py-1 uppercase tracking-wider">Recommended</div>
          <div className="text-lg font-bold mb-2" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.9s both, sc-headColorAlt 9s ease-in-out 2s infinite' }}>SYSTEM_ARCH</div>
          <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-4">[STANDARD]</div>
          <p className="text-sm text-[#39ff14] mb-8 leading-relaxed h-20">
            Full OS design. Kernel + Modules + Implementation Guide for Claude/GPT/Gemini.
          </p>
          <a href="mailto:scale0097@gmail.com" className="flex items-center gap-2 text-xs font-bold text-[#39ff14] group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-400">
            <ChevronRight className="w-4 h-4" /> DEPLOY
          </a>
        </div>

        {/* ENTERPRISE_PROTO */}
        <div className="border border-cyan-900/30 bg-black/40 p-6 rounded-lg hover:border-cyan-500/50 transition-all group relative overflow-hidden"
          style={{ opacity: 0, animation: 'sc-cardReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.5s forwards' }}>
          <div className="text-lg font-bold mb-2" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.05s both, sc-headColor 9s ease-in-out 4s infinite' }}>ENTERPRISE_PROTO</div>
          <div className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-widest mb-4">[PREMIUM]</div>
          <p className="text-sm text-[#39ff14] mb-8 leading-relaxed h-20">
            Full integration. Departmental kernels (Sales/HR) and workflow analysis.
          </p>
          <a href="mailto:contact@scale94.com" className="flex items-center gap-2 text-xs font-bold text-[#39ff14] group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-400">
            <ChevronRight className="w-4 h-4" /> CONTACT
          </a>
        </div>
      </div>

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
            onClick={() => { setArchitectThesis(true); setCurrentPath('~/system/scaling/thesis'); }}
            className="flex items-center gap-2 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform cursor-pointer hover:text-white"
          >
            <ChevronRight className="w-4 h-4" /> LOAD THESIS LOG
          </button>
        </div>
      </div>

      {/* ── Seraphine-8.8.8.8.8.8.8.8 White Paper ── */}
      <div
        className="border-t border-cyan-900/30 pt-8 mb-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.65s forwards' }}
      >
        <div className="border border-fuchsia-500/40 bg-black/60 p-8 rounded-lg hover:border-fuchsia-400/70 transition-all group relative overflow-hidden max-w-2xl mx-auto"
          style={{ animation: 'sc-borderBreath 7s ease-in-out 1s infinite' }}
        >
          <div className="absolute top-0 right-0 bg-fuchsia-500/10 text-fuchsia-400 text-[9px] font-bold px-3 py-1.5 uppercase tracking-wider border-l border-b border-fuchsia-500/30">
            WHITE PAPER · ARS ELECTRONICA 2027
          </div>

          <div className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Cpu className="w-3 h-3" /> SERAPHINE-8.8.8.8.8.8.8.8 · FADE_DOCTRINE · SOMA-9.4
          </div>

          <h3 className="text-xl font-bold mb-5 leading-tight tracking-tight" style={{ opacity: 0, animation: 'sc-titleReveal 0.7s cubic-bezier(0.16,1,0.3,1) 1.3s both, sc-headColorAlt 11s ease-in-out 0.5s infinite' }}>
            The most compelling analogy<br />has the weakest geometry.
          </h3>

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
            <span className="text-fuchsia-600/40">·</span>
            <span>Bone Fusion v7.7.7.7.7.7.7 · Bouligand 36° + Magic Angle 1.1°</span>
          </div>

          <button
            onClick={() => loadKernel && loadKernel('SERAPHINE-8.8.8.8.8.8.8.8-PAPER')}
            className="flex items-center gap-2 text-xs font-bold text-fuchsia-400 group-hover:translate-x-1 transition-transform cursor-pointer hover:text-white"
          >
            <ChevronRight className="w-4 h-4" /> READ PAPER
          </button>
        </div>
      </div>

      {/* ── RUN COMMAND MANUAL V2.1 ── */}
      <div
        className="border-t border-cyan-900/30 pt-8 mb-8"
        style={{ opacity: 0, animation: 'sc-cardReveal 0.6s cubic-bezier(0.16,1,0.3,1) 0.8s forwards' }}
      >
        <div className="mb-5">
          <div className="text-lg sm:text-xl font-bold uppercase tracking-widest mb-1" style={{ opacity: 0, animation: 'sc-headReveal 0.5s cubic-bezier(0.16,1,0.3,1) 1.45s both, sc-headColor 9s ease-in-out 3s infinite' }}>RUN COMMAND MANUAL V2.1</div>
          <div className="text-[10px] text-fuchsia-500/60 font-mono uppercase tracking-widest">// WASM KERNEL INTERFACE · 34 KERNELS · SOMA-9.4</div>
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
              <div className="mt-3 pt-3 border-t border-cyan-900/20">
                <div className="text-[10px] font-bold text-fuchsia-500/70 uppercase tracking-widest mb-2">OPTIMAL SARG SEQUENCE</div>
                <div className="text-[#39ff14]/60">run spectral → run bone → run seraphine</div>
                <div className="text-[10px] text-cyan-600/40 mt-1">SARG_max = (n−1)·(1+λ_e) · n=6 λ_e=1 → 10.0</div>
                <div className="text-[10px] text-fuchsia-500/40 mt-0.5">above 8.0 = high coherence state · 34 kernels · Rust → WASM</div>
              </div>
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
          <a href="https://bsky.app/profile/scale94.com" target="_blank" rel="noreferrer" className="text-cyan-300 text-sm hover:underline hover:text-white transition-colors">@scale94.com</a>
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
            className="font-mono text-[10px] text-cyan-300 break-all select-all cursor-pointer hover:text-white transition-colors"
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

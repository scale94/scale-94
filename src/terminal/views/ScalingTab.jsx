import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap } from 'lucide-react';
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

const ScalingTab = ({ setArchitectThesis, setCurrentPath, setOriginTab, loadKernel, kernelRunHistoryRef, onPolarity }) => {
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
      <LatentCollider kernelRunHistoryRef={kernelRunHistoryRef} onPolarity={onPolarity} />

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
            CORE PROTOCOL (IDENTITY)
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

      {/* ── § · Primary Literature (Bibliography Monument) ── */}
      <div
        className="border-t border-cyan-900/30"
        style={{ opacity: 0, animation: 'sc-monumentReveal 1.5s ease-out 1.55s forwards' }}
      >
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

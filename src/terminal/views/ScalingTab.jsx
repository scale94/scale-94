import React, { useEffect } from 'react';
import { emit as emitObs } from '../../observatory/observatoryBus';
import { Hexagon } from 'lucide-react';
import LatentCollider from './LatentCollider';

const ScalingTab = ({ setArchitectThesis, setCurrentPath, setOriginTab, loadKernel, kernelRunHistoryRef, onPolarity }) => {
  // Observatory witness: the saponification arc was approached (dead channel, now wired).
  useEffect(() => { emitObs('gaze', 'scaling_visit', {}); }, []);
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
            >SAPONIFICATION</span>
          </h2>
          <div
            className="text-xs sm:text-sm font-bold tracking-widest text-fuchsia-400/80 uppercase"
            style={{ opacity: 0, animation: 'sc-subReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.5s forwards' }}
          >
            OLFACTORY SYNTHESIS
          </div>
        </div>
      </div>

      {/* ── Latent Space Collider (hero section) ── */}
      <LatentCollider kernelRunHistoryRef={kernelRunHistoryRef} onPolarity={onPolarity} />

    </div>
  );
};

export default React.memo(ScalingTab);

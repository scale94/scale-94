// KuramotoVisualizer.jsx — Live Kuramoto synchrony canvas
// Ars Electronica 2027 — sensory layer: doctrine → simulation → visual
//
// Runs the same mean-field ODE as kuramoto.rs in a RAF loop:
//   dθ_i/dt = ω_i + K·r·sin(ψ − θ_i)
//
// Visual: N oscillators on a ring, HSL-colored by phase.
// Coherence halo grows with order parameter r.
// Edge lines connect nodes by phase proximity — a solidarity web.
import React, { useEffect, useRef, useCallback } from 'react';

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = ((a - b) % TWO_PI + TWO_PI) % TWO_PI;
  if (d > Math.PI) d = TWO_PI - d;
  return d;
}

export default function KuramotoVisualizer({ params, onDismiss }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const rafRef    = useRef(null);

  // Initialise simulation state from params
  const initSim = useCallback(() => {
    const n     = Math.max(3, Math.min(100, Math.round(params.n)));
    const k     = params.k;
    const sigma = params.sigma;

    // Uniform random initial phases
    const phases = Array.from({ length: n }, () => Math.random() * TWO_PI);

    // Natural frequencies — Box-Muller Gaussian(0, σ²), then zero-mean
    const freqs = [];
    while (freqs.length < n) {
      const u1  = Math.max(Math.random(), 1e-12);
      const u2  = Math.random();
      const mag = sigma * Math.sqrt(-2 * Math.log(u1));
      const ang = TWO_PI * u2;
      freqs.push(mag * Math.cos(ang));
      if (freqs.length < n) freqs.push(mag * Math.sin(ang));
    }
    freqs.length = n;
    const meanF = freqs.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) freqs[i] -= meanF;

    stateRef.current = { phases, freqs, n, k, sigma, r: 0, frame: 0 };
  }, [params]);

  // RAF draw loop
  useEffect(() => {
    initSim();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;
    const cx  = W / 2;
    const cy  = H / 2;

    const ringR   = Math.min(W, H) * 0.37;
    const DT      = 0.028;
    const STEPS   = 3; // simulation steps per frame

    const draw = () => {
      const s = stateRef.current;
      if (!s) return;
      const { phases, freqs, n, k } = s;
      s.frame++;

      // ── Step simulation ───────────────────────────────────────────────────
      let r = 0, psi = 0;
      for (let step = 0; step < STEPS; step++) {
        let sinSum = 0, cosSum = 0;
        for (let i = 0; i < n; i++) {
          sinSum += Math.sin(phases[i]);
          cosSum += Math.cos(phases[i]);
        }
        const inv = 1 / n;
        r   = Math.sqrt((sinSum * inv) ** 2 + (cosSum * inv) ** 2);
        psi = Math.atan2(sinSum, cosSum);
        s.r = r;
        for (let i = 0; i < n; i++) {
          phases[i] += DT * (freqs[i] + k * r * Math.sin(psi - phases[i]));
        }
      }

      // ── Draw ─────────────────────────────────────────────────────────────

      // Trail fade (not hard clear — gives motion blur / comet tails)
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 0, W, H);

      // Central coherence halo — grows as r → 1
      const haloR = r * ringR * 0.55 + 8;
      const grd   = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
      grd.addColorStop(0,   `rgba(255,215,0,${0.09 * r})`);
      grd.addColorStop(0.5, `rgba(255,140,0,${0.05 * r})`);
      grd.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, TWO_PI);
      ctx.fill();

      // Pre-compute positions (node i sits at its fixed ring angle)
      const pos = Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * TWO_PI - Math.PI / 2;
        return { x: cx + ringR * Math.cos(angle), y: cy + ringR * Math.sin(angle) };
      });

      // Edge solidarity web — only draw if phase proximity exceeds threshold
      // Batched into a single path per ~hue bucket for fewer draw calls.
      // Capped at 600 edges to prevent frame drops on lower-end devices.
      ctx.lineWidth = 0.6;
      let edgeCount = 0;
      for (let i = 0; i < n && edgeCount < 600; i++) {
        for (let j = i + 1; j < n && edgeCount < 600; j++) {
          const diff  = angleDiff(phases[i], phases[j]);
          const alpha = Math.max(0, 1 - diff / (Math.PI * 0.45));
          if (alpha < 0.05) continue;
          const hue = (((phases[i] + phases[j]) * 0.5 * 180 / Math.PI) % 360 + 360) % 360;
          ctx.strokeStyle = `hsla(${hue},70%,60%,${alpha * 0.28})`;
          ctx.beginPath();
          ctx.moveTo(pos[i].x, pos[i].y);
          ctx.lineTo(pos[j].x, pos[j].y);
          ctx.stroke();
          edgeCount++;
        }
      }

      // Node circles — colored by phase
      const nodeR = 2.8 + r * 1.8;
      for (let i = 0; i < n; i++) {
        const hue = ((phases[i] * 180 / Math.PI) % 360 + 360) % 360;
        const { x, y } = pos[i];

        // Outer glow ring (only when partially coherent)
        if (r > 0.25) {
          ctx.beginPath();
          ctx.arc(x, y, nodeR + 3.5, 0, TWO_PI);
          ctx.fillStyle = `hsla(${hue},80%,65%,${r * 0.12})`;
          ctx.fill();
        }

        // Node core
        ctx.beginPath();
        ctx.arc(x, y, nodeR, 0, TWO_PI);
        ctx.fillStyle = `hsl(${hue},80%,65%)`;
        ctx.fill();
      }

      // ── HUD text ─────────────────────────────────────────────────────────
      const status = r > 0.85 ? 'SYNCHRONIZED'
                   : r > 0.5  ? 'PARTIALLY_LOCKED'
                   : r > 0.2  ? 'CLUSTERING'
                   :            'INCOHERENT';
      const statusColor = r > 0.85 ? '#FFD700'
                        : r > 0.5  ? '#06b6d4'
                        : '#39ff14';

      ctx.textAlign = 'center';
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText(`r = ${r.toFixed(3)}   K = ${k.toFixed(2)}   N = ${n}`, cx, H - 14);

      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = statusColor;
      ctx.fillText(status, cx, H - 4);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [params, initSim]);

  // ESC to dismiss
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss]);

  const { n, k, sigma } = params;

  return (
    <div
      className="hidden md:flex flex-col"
      style={{
        position:     'fixed',
        bottom:       '16px',
        right:        '16px',
        zIndex:       48,
        background:   'rgba(0,0,0,0.93)',
        border:       '1px solid rgba(255,215,0,0.25)',
        borderRadius: '8px',
        boxShadow:    '0 0 32px rgba(255,215,0,0.08), 0 4px 32px rgba(0,0,0,0.6)',
        animation:    'kv-appear 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
      }}
    >
      <style>{`
        @keyframes kv-appear {
          from { opacity: 0; transform: scale(0.88) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>

      {/* Header bar */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '5px 10px',
        borderBottom:   '1px solid rgba(255,215,0,0.15)',
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontSize:       '9px',
        fontWeight:     700,
        letterSpacing:  '0.12em',
        color:          '#FFD700',
        userSelect:     'none',
      }}>
        <span>KURAMOTO_SYNC_FIELD</span>
        <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: '12px' }}>
          N={n} K={k} σ={sigma}
        </span>
        <button
          onClick={onDismiss}
          title="Dismiss (Esc)"
          style={{
            marginLeft:  '12px',
            background:  'none',
            border:      'none',
            color:       'rgba(255,255,255,0.3)',
            cursor:      'pointer',
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize:    '10px',
            padding:     '0 2px',
            lineHeight:  1,
          }}
        >[×]</button>
      </div>

      <canvas
        ref={canvasRef}
        width={290}
        height={290}
        style={{ display: 'block', borderRadius: '0 0 7px 7px' }}
      />
    </div>
  );
}

import React from 'react';
import { Lock, Shield, Eye, Database, ShieldAlert, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react';

// ── Threat vector data — mirrors the surveillance kernel's worldview ──────────
const VECTORS = [
  {
    id:       'VERCEL_ANALYTICS',
    label:    'Vercel Analytics',
    category: 'behavioral_telemetry',
    sev:      2,
    status:   'ACTIVE',
    actor:    'Vercel Inc.',
    detail:   'Aggregate page-view counts and referrer data. No user fingerprinting or cross-site tracking. Standard SaaS infrastructure telemetry — not under operator control.',
    scope:    'INFRASTRUCTURE_LAYER',
  },
  {
    id:       'SERVER_LOG_RETENTION',
    label:    'Server Log Collection',
    category: 'traffic_retention',
    sev:      2,
    status:   'ACTIVE',
    actor:    'Vercel Inc.',
    detail:   'IP address and User-Agent strings logged at the edge per request. Retained by infrastructure provider for DDoS mitigation and system integrity. Operator has no direct access.',
    scope:    'EDGE_NODE',
  },
  {
    id:       'COOKIE_STATUS',
    label:    'Cookie / localStorage Tracking',
    category: 'behavioral_tracking',
    sev:      0,
    status:   'NULL',
    actor:    'scale-9.4',
    detail:   'Zero cookies set. No localStorage behavioral tracking. Session history is ephemeral — cleared on tab close or refresh. No persistent client-side identity constructed.',
    scope:    'CLIENT_ENCLAVE',
  },
  {
    id:       'LOCAL_EXECUTION',
    label:    'Terminal Command Processing',
    category: 'local_execution',
    sev:      0,
    status:   'CONTAINED',
    actor:    'Browser Sandbox',
    detail:   'All terminal input is processed locally within the browser\'s JS sandbox. Commands do not transit to any operator server. WASM kernels execute in a memory-isolated context.',
    scope:    'CLIENT_ENCLAVE',
  },
  {
    id:       'CLASSIFIED_CHALLENGE',
    label:    'Classified Enclave Auth',
    category: 'ephemeral_session',
    sev:      1,
    status:   'EPHEMERAL',
    actor:    'scale-9.4 API',
    detail:   'The /cryptography flow issues a short-lived HMAC-signed session token (60s TTL). No user identity is stored. No payload data is logged server-side. Token is discarded after verification.',
    scope:    'API_LAYER',
  },
  {
    id:       'EXTERNAL_LINK_EXPOSURE',
    label:    'External Link Egress',
    category: 'third_party_handoff',
    sev:      2,
    status:   'USER_INITIATED',
    actor:    'GitHub / Bluesky / Third Parties',
    detail:   'Navigating external links (GitHub, Bluesky) hands off your session to third-party jurisdictions. Each platform operates under its own data collection regime — outside this operator\'s scope.',
    scope:    'PERIMETER',
  },
];

const SEV_MAP = {
  0: { border: 'border-green-500/40',  bg: 'bg-green-950/10',   text: 'text-green-400',  badge: 'bg-green-900/20 text-green-300 border border-green-700/20',   label: 'CLEAR',    icon: CheckCircle  },
  1: { border: 'border-cyan-500/40',   bg: 'bg-cyan-950/10',    text: 'text-cyan-400',   badge: 'bg-cyan-900/20 text-cyan-300 border border-cyan-700/20',       label: 'LOW',      icon: CheckCircle  },
  2: { border: 'border-yellow-500/40', bg: 'bg-yellow-950/10',  text: 'text-yellow-400', badge: 'bg-yellow-900/20 text-yellow-300 border border-yellow-700/20', label: 'MODERATE', icon: AlertTriangle },
  3: { border: 'border-orange-500/50', bg: 'bg-orange-950/15',  text: 'text-orange-400', badge: 'bg-orange-900/30 text-orange-300 border border-orange-700/30', label: 'ELEVATED', icon: AlertTriangle },
  4: { border: 'border-red-500/60',    bg: 'bg-red-950/20',     text: 'text-red-400',    badge: 'bg-red-900/40 text-red-300 border border-red-700/40',           label: 'HIGH',     icon: XCircle      },
  5: { border: 'border-red-500/80',    bg: 'bg-red-950/30',     text: 'text-red-400',    badge: 'bg-red-900/50 text-red-300 border border-red-700/50',           label: 'CRITICAL', icon: XCircle      },
};

// Panopticon Index: Σ(sev²) / (n × 25) × 100
const panopticonScore = Math.round(
  VECTORS.reduce((acc, v) => acc + v.sev * v.sev, 0) / (VECTORS.length * 25) * 100
);

// ─────────────────────────────────────────────────────────────────────────────

const PrivacyTab = ({ systemArticles = {} }) => {
  const privacy = systemArticles['PRIVACY-PROTOCOL'];
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <style>{`
        @keyframes pt-reveal {
          from { opacity: 0; transform: translateY(-8px); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
        }
        @keyframes pt-iconReveal {
          0%   { opacity: 0; transform: rotate(-45deg) scale(0.5); filter: drop-shadow(0 0 20px #f43f5e); }
          100% { opacity: 1; transform: rotate(0deg)  scale(1);   filter: drop-shadow(0 0 8px rgba(244,63,94,0.6)); }
        }
        @keyframes pt-scoreGlow {
          0%, 100% { text-shadow: 0 0 10px currentColor, 0 0 20px rgba(34,211,238,0.3); }
          50%       { text-shadow: 0 0 20px currentColor, 0 0 40px rgba(34,211,238,0.5); }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-rose-900/50 pb-4 mb-8">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <Lock
              className="w-8 h-8 shrink-0 text-rose-400"
              style={{ animation: 'pt-iconReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards' }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(135deg, #f43f5e 0%, #e879f9 35%, #818cf8 65%, #22d3ee 100%)',
                animation: 'pt-reveal 1.2s cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >PRIVACY_PROTOCOL</span>
          </h2>
          <div
            className="text-sm font-bold tracking-widest text-rose-400"
            style={{ opacity: 0, animation: 'pt-reveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s forwards' }}
          >
            DIRECTIVE: DATA_SOVEREIGNTY // CLASSIFICATION: OPEN
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center gap-2 text-xs border border-rose-500/40 px-3 py-1 bg-rose-900/10 text-rose-300 rounded-sm">
            <Shield className="w-3 h-3" /> DATA POLICY
          </div>
          <div className="flex items-center gap-2 text-xs border border-cyan-500/40 px-3 py-1 bg-cyan-900/10 text-cyan-300 rounded-sm">
            <Eye className="w-3 h-3" /> TRANSPARENCY ACTIVE
          </div>
        </div>
      </div>

      {/* ── Data Flow Diagram ──────────────────────────────────────────────── */}
      <div className="mb-8 border border-rose-900/20 bg-black/30 rounded-sm p-4">
        <div className="text-[9px] font-mono tracking-widest text-rose-400/40 uppercase mb-3 flex items-center gap-2">
          <Eye className="w-2.5 h-2.5" /> DATA FLOW ARCHITECTURE
        </div>
        <svg viewBox="0 0 800 120" className="w-full" style={{ height: 120 }} xmlns="http://www.w3.org/2000/svg">
          {/* Nodes */}
          {[
            { x: 80,  label: 'Browser', color: '#06b6d4' },
            { x: 280, label: 'Vercel Edge', color: '#f43f5e' },
            { x: 500, label: 'CDN', color: '#f43f5e' },
            { x: 700, label: 'Client Sandbox', color: '#06b6d4' },
          ].map((node, i) => (
            <g key={node.label}>
              <rect x={node.x - 60} y={35} width={120} height={40} rx={6} ry={6}
                fill="rgba(0,0,0,0.6)" stroke={node.color} strokeWidth="1" opacity="0.8" />
              <text x={node.x} y={60} textAnchor="middle" fill={node.color} fontSize="11" fontFamily="monospace" fontWeight="bold">
                {node.label}
              </text>
            </g>
          ))}
          {/* Arrows between nodes */}
          {[
            { x1: 140, x2: 220, noData: false },
            { x1: 340, x2: 440, noData: false },
            { x1: 560, x2: 640, noData: true },
          ].map((arrow, i) => (
            <g key={i}>
              <line x1={arrow.x1} y1={55} x2={arrow.x2} y2={55}
                stroke={arrow.noData ? 'rgba(6,182,212,0.4)' : 'rgba(244,63,94,0.3)'}
                strokeWidth="1.5" strokeDasharray={arrow.noData ? '4 3' : 'none'}
                markerEnd="url(#arrowhead)" />
              {arrow.noData && (
                <g>
                  <line x1={(arrow.x1 + arrow.x2) / 2 - 6} y1={48}
                        x2={(arrow.x1 + arrow.x2) / 2 + 6} y2={62}
                        stroke="#06b6d4" strokeWidth="2" opacity="0.6" />
                  <text x={(arrow.x1 + arrow.x2) / 2} y={42} textAnchor="middle"
                        fill="#06b6d4" fontSize="8" fontFamily="monospace" opacity="0.6">
                    NO DATA
                  </text>
                </g>
              )}
            </g>
          ))}
          {/* Labels below */}
          <text x={180} y={95} textAnchor="middle" fill="rgba(244,63,94,0.3)" fontSize="8" fontFamily="monospace">
            IP + UA logged
          </text>
          <text x={400} y={95} textAnchor="middle" fill="rgba(244,63,94,0.3)" fontSize="8" fontFamily="monospace">
            static assets
          </text>
          <text x={600} y={95} textAnchor="middle" fill="rgba(6,182,212,0.5)" fontSize="8" fontFamily="monospace">
            WASM local exec
          </text>
          {/* Arrow marker definition */}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(244,63,94,0.4)" />
            </marker>
          </defs>
        </svg>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── Base protocol card (from .md) ──────────────────────────────────── */}
        <div
          style={{
            padding: '1.5px',
            background: 'linear-gradient(135deg, #f43f5e 0%, #d946ef 40%, #06b6d4 100%)',
            borderRadius: '6px',
          }}
        >
          <div className="bg-black/90 backdrop-blur-sm px-8 py-8 rounded-[5px]">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-rose-900/30 text-[10px] font-bold tracking-widest font-mono uppercase">
              <Database className="w-3 h-3 text-rose-400" />
              <span className="text-rose-400">LOG: PRIVACY-PROTOCOL</span>
              <span className="text-rose-500/60">//</span>
              <span className="text-cyan-400">NODE: scale-9.4</span>
              <span className="ml-auto text-rose-300">STATUS: ACTIVE</span>
            </div>
            <div
              className="prose prose-invert prose-sm max-w-none font-mono leading-relaxed
                prose-headings:text-rose-300 prose-headings:font-bold prose-headings:tracking-wide
                prose-p:text-[#39ff14] prose-p:leading-relaxed
                prose-a:text-rose-400 prose-a:no-underline hover:prose-a:text-rose-200
                prose-strong:text-rose-300
                prose-code:text-[#39ff14] prose-code:bg-transparent"
              dangerouslySetInnerHTML={{ __html: privacy?.html ?? '<p class="text-rose-900/60 tracking-widest font-bold uppercase text-xs">PRIVACY PROTOCOL DATA STREAM UNAVAILABLE — NODE UNREACHABLE</p>' }}
            />
            <div className="mt-10 pt-6 border-t border-rose-900/20 flex justify-between items-center text-[10px] font-bold tracking-widest text-rose-400/60 uppercase font-mono">
              <span>END OF PROTOCOL // SOMA-9</span>
              <span className="text-cyan-400/50">SORBE NODE :: OSTROM_PROTOCOL</span>
            </div>
          </div>
        </div>

        {/* ── Panopticon Threat Assessment ───────────────────────────────────── */}
        <div className="border border-orange-900/30 bg-black/40 rounded-sm overflow-hidden">

          {/* Section header */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-orange-900/30 bg-orange-950/10">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <div className="text-sm font-bold tracking-widest text-orange-300 uppercase">
                  Panopticon Threat Assessment
                </div>
                <div className="text-[9px] tracking-widest text-orange-400/50 uppercase mt-0.5">
                  DATA EXPOSURE VECTORS // scale-9.4 NODE // SURVEILLANCE_INDEX FRAMEWORK
                </div>
              </div>
            </div>
            {/* Mini score */}
            <div className="text-right shrink-0">
              <div
                className="text-3xl font-bold font-mono tabular-nums text-cyan-400"
                style={{ animation: 'pt-scoreGlow 3s ease-in-out infinite' }}
              >
                {panopticonScore}
              </div>
              <div className="text-[8px] tracking-widest text-orange-400/40 uppercase">/ 100 · P-INDEX</div>
            </div>
          </div>

          {/* Context blurb */}
          <div className="px-6 py-4 border-b border-orange-900/20 text-xs font-mono text-orange-400/60 leading-relaxed">
            <span className="text-orange-500">{'>_'}</span>{' '}
            The Panopticon is no longer architectural — it is infrastructural. This assessment maps the data exposure surface of{' '}
            <span className="text-orange-300 font-bold">scale-9.4</span> using the same severity framework as the{' '}
            <span className="text-orange-300 font-bold">SURVEILLANCE_INDEX</span> kernel.
            Threat score: <span className="text-cyan-400 font-bold">Σ(sev²) / (n × 25) × 100</span>.
            A score of <span className="text-cyan-400 font-bold">{panopticonScore}/100</span> reflects an operator-controlled surface of near-zero active surveillance — the residual exposure is infrastructure-layer, outside this node's jurisdiction.
          </div>

          {/* Vector cards */}
          <div className="divide-y divide-orange-900/20">
            {VECTORS.map((v) => {
              const style = SEV_MAP[v.sev] ?? SEV_MAP[2];
              const Icon  = style.icon;
              return (
                <div key={v.id} className={`px-6 py-4 ${v.sev === 0 ? '' : style.bg}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${style.text}`} />
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-orange-200 tracking-wide">{v.label}</span>
                        <span className={`text-[8px] font-bold tracking-widest px-2 py-0.5 rounded-sm ${style.badge}`}>
                          {v.sev > 0 ? `${v.sev}/5` : '0/5'} · {style.label}
                        </span>
                        <span className="text-[8px] font-mono text-orange-400/30 border border-orange-900/30 px-1.5 py-0.5 rounded-sm">
                          {v.scope}
                        </span>
                        <span className="ml-auto text-[8px] font-mono text-orange-400/40">
                          {v.status}
                        </span>
                      </div>
                      {/* Category + actor */}
                      <div className="text-[9px] font-mono text-orange-400/40 mb-1.5">
                        <span className="text-orange-400/60">{v.category.replace(/_/g, ' ')}</span>
                        <span className="text-orange-400/20 mx-1">·</span>
                        <span>ACTOR: {v.actor}</span>
                      </div>
                      {/* Detail */}
                      <div className="text-[11px] font-mono text-orange-300/70 leading-relaxed">
                        {v.detail}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Axiomatic conflict note */}
          <div className="px-6 py-5 border-t border-orange-900/30 bg-orange-950/5">
            <div className="text-[9px] font-bold tracking-widest text-orange-400/50 uppercase mb-2 flex items-center gap-2">
              <Activity className="w-3 h-3" /> THE AXIOMATIC CONFLICT
            </div>
            <p className="text-[11px] font-mono text-orange-300/60 leading-relaxed">
              The legacy state mandates that survival requires absolute visibility. This node rejects that axiom.
              Absolute state visibility produces entropic stasis — the antithesis of a functioning biocoenosis.
              The architecture of <span className="text-orange-300">scale-9.4</span> is designed to minimize
              the data surface while remaining a legible, transparent node on the open network.
              What cannot be collected cannot be subpoenaed, sold, or breached.
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-orange-900/20 flex flex-wrap justify-between items-center gap-2 text-[9px] font-mono text-orange-400/30 tracking-widest uppercase">
            <span>SURVEILLANCE_INDEX_FRAMEWORK v1.0 // GREY-C0 / NAVIGATORS GUILD</span>
            <span>CONTACT: scale0097@gmail.com</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default React.memo(PrivacyTab);

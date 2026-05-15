import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Globe, ChevronRight, Zap, RefreshCw, Radio } from 'lucide-react';

// ── Mini AT Protocol network graph ──────────────────────────────────────────
function ATProtoGraph() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 280, H = 180;

    // Nodes: label, initial x, y, color
    const nodes = [
      { label: 'PDS',      x: 60,  y: 90,  color: '#38bdf8', vx: 0, vy: 0 },
      { label: 'Relay',    x: 140, y: 50,  color: '#67e8f9', vx: 0, vy: 0 },
      { label: 'AppView',  x: 220, y: 90,  color: '#bae6fd', vx: 0, vy: 0 },
      { label: 'Client',   x: 220, y: 150, color: '#7dd3fc', vx: 0, vy: 0 },
      { label: 'FeedGen',  x: 60,  y: 150, color: '#0ea5e9', vx: 0, vy: 0 },
    ];
    // Edges: [from, to]
    const edges = [[0,1],[1,2],[2,3],[1,4]];
    // Target positions for spring forces
    const targets = nodes.map(n => ({ x: n.x, y: n.y }));

    let raf;
    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);

      // Apply gentle spring physics + slight oscillation
      const time = t * 0.001;
      nodes.forEach((n, i) => {
        const tx = targets[i].x + Math.sin(time + i * 1.3) * 5;
        const ty = targets[i].y + Math.cos(time + i * 0.9) * 4;
        n.vx += (tx - n.x) * 0.03;
        n.vy += (ty - n.y) * 0.03;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      });

      // Draw edges
      for (const [a, b] of edges) {
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.strokeStyle = 'rgba(56,189,248,0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw nodes
      for (const n of nodes) {
        // glow
        ctx.beginPath();
        ctx.arc(n.x, n.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = n.color.replace(')', ',0.08)').replace('rgb', 'rgba');
        ctx.fill();
        // solid circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
        // label
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(186,230,253,0.7)';
        ctx.fillText(n.label, n.x, n.y + 22);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas ref={canvasRef} width={280} height={180}
      className="hidden md:block shrink-0"
      style={{ width: 280, height: 180 }} />
  );
}

// ── Bluesky butterfly icon ─────────────────────────────────────────────────────
export const ButterflyIcon = ({ className, style }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"
    className={className} style={style} aria-hidden="true">
    <path d="M11.5 11C9.5 9.5 5.5 7 2.5 8.5C0.5 9.5 1 12 4 13C6.5 13.8 9.5 13 11.5 11Z" />
    <path d="M12.5 11C14.5 9.5 18.5 7 21.5 8.5C23.5 9.5 23 12 20 13C17.5 13.8 14.5 13 12.5 11Z" />
    <path d="M11.5 13.5C9 14 4 15 3 18C2.5 19.5 4.5 21 7.5 19.5C9.5 18.5 11 16.5 11.5 13.5Z" />
    <path d="M12.5 13.5C15 14 20 15 21 18C21.5 19.5 19.5 21 16.5 19.5C14.5 18.5 13 16.5 12.5 13.5Z" />
    <ellipse cx="12" cy="12.5" rx="0.9" ry="3.5" />
    <path d="M11.4 9.5 Q10 7.5 8.5 6"  strokeWidth="0.8" stroke="currentColor" fill="none" strokeLinecap="round" />
    <path d="M12.6 9.5 Q14 7.5 15.5 6" strokeWidth="0.8" stroke="currentColor" fill="none" strokeLinecap="round" />
  </svg>
);

// ── GraphTracks config ─────────────────────────────────────────────────────────
const GT_BASE    = 'https://api.graphtracks.com';
const GT_NETWORK = 'BlueSky';
const GT_DID     = import.meta.env.VITE_GRAPHTRACKS_DID || null;
const GT_KEY     = import.meta.env.VITE_GRAPHTRACKS_KEY || null;

// ── Resource manifest ──────────────────────────────────────────────────────────
// // PROTOCOL_LAYER — core spec + identity infrastructure
const PROTOCOL_RESOURCES = [
  {
    label: 'BLUESKY PROFILE',
    href:  'https://bsky.app/profile/scale94.com',
    sub:   'bsky.app / @scale94.com',
    tag:   'SOCIAL_NODE',
    icon:  'butterfly',
    accent: { border: 'border-sky-500/25', bg: 'bg-sky-950/15', hover: 'hover:border-sky-400/50 hover:bg-sky-950/30', text: 'text-sky-300', dim: 'text-sky-400/40' },
  },
  {
    label: 'AT PROTOCOL',
    href:  'https://atproto.com',
    sub:   'atproto.com — open protocol spec',
    tag:   'PROTOCOL',
    icon:  'globe',
    accent: { border: 'border-blue-500/25', bg: 'bg-blue-950/15', hover: 'hover:border-blue-400/50 hover:bg-blue-950/30', text: 'text-blue-300', dim: 'text-blue-400/40' },
  },
  {
    label: 'LEXICON',
    href:  'https://atproto.com/guides/lexicon',
    sub:   'schema language for AT Protocol',
    tag:   'SCHEMA',
    icon:  'globe',
    accent: { border: 'border-blue-400/20', bg: 'bg-blue-950/10', hover: 'hover:border-blue-300/40 hover:bg-blue-950/25', text: 'text-blue-200', dim: 'text-blue-400/35' },
  },
  {
    label: 'DID / IDENTITY',
    href:  'https://atproto.com/guides/identity',
    sub:   'decentralized identifiers + handles',
    tag:   'IDENTITY',
    icon:  'globe',
    accent: { border: 'border-indigo-500/25', bg: 'bg-indigo-950/15', hover: 'hover:border-indigo-400/50 hover:bg-indigo-950/30', text: 'text-indigo-300', dim: 'text-indigo-400/40' },
  },
  {
    label: 'DATA REPOS',
    href:  'https://atproto.com/guides/data-repos',
    sub:   'personal data server repository spec',
    tag:   'STORAGE',
    icon:  'globe',
    accent: { border: 'border-indigo-400/20', bg: 'bg-indigo-950/10', hover: 'hover:border-indigo-300/40 hover:bg-indigo-950/25', text: 'text-indigo-200', dim: 'text-indigo-400/35' },
  },
];

// // DEV_TOOLKIT — client libraries, APIs, self-hosting
const TOOLKIT_RESOURCES = [
  {
    label: 'TYPESCRIPT SDK',
    href:  'https://github.com/bluesky-social/atproto/tree/main/packages/api',
    sub:   '@atproto/api — official TS client',
    tag:   'SDK',
    icon:  'zap',
    accent: { border: 'border-cyan-500/25', bg: 'bg-cyan-950/15', hover: 'hover:border-cyan-400/50 hover:bg-cyan-950/30', text: 'text-cyan-300', dim: 'text-cyan-400/40' },
  },
  {
    label: 'JETSTREAM',
    href:  'https://github.com/bluesky-social/jetstream',
    sub:   'firehose → lightweight JSON stream',
    tag:   'FIREHOSE',
    icon:  'zap',
    accent: { border: 'border-cyan-400/20', bg: 'bg-cyan-950/10', hover: 'hover:border-cyan-300/40 hover:bg-cyan-950/25', text: 'text-cyan-200', dim: 'text-cyan-400/35' },
  },
  {
    label: 'PDS SELF-HOST',
    href:  'https://github.com/bluesky-social/pds',
    sub:   'run your own Personal Data Server',
    tag:   'INFRA',
    icon:  'globe',
    accent: { border: 'border-sky-600/20', bg: 'bg-sky-950/10', hover: 'hover:border-sky-500/40 hover:bg-sky-950/25', text: 'text-sky-200', dim: 'text-sky-500/35' },
  },
  {
    label: 'BLUESKY DOCS',
    href:  'https://docs.bsky.app',
    sub:   'docs.bsky.app — developer reference',
    tag:   'REFERENCE',
    icon:  'globe',
    accent: { border: 'border-sky-500/25', bg: 'bg-sky-950/15', hover: 'hover:border-sky-400/50 hover:bg-sky-950/30', text: 'text-sky-300', dim: 'text-sky-400/40' },
  },
  {
    label: 'GRAPHTRACKS',
    href:  'https://graphtracks.com',
    sub:   'Bluesky network analytics API',
    tag:   'ANALYTICS',
    icon:  'zap',
    accent: { border: 'border-indigo-500/25', bg: 'bg-indigo-950/15', hover: 'hover:border-indigo-400/50 hover:bg-indigo-950/30', text: 'text-indigo-300', dim: 'text-indigo-400/40' },
  },
  {
    label: 'SEMBLE',
    href:  'https://semble.so/profile/psingletary.com/collections/3mabuiycpg626',
    sub:   'AT://links — apps built on ATProto',
    tag:   'COLLECTION',
    icon:  'zap',
    accent: { border: 'border-orange-500/25', bg: 'bg-orange-950/10', hover: 'hover:border-orange-400/50 hover:bg-orange-950/20', text: 'text-orange-300', dim: 'text-orange-400/40' },
  },
];

// // ECOSYSTEM_APPS — clients, feeds, and social tools built on ATProto
const ECOSYSTEM_RESOURCES = [
  {
    label: 'WHITEWIND',
    href:  'https://whtwnd.com',
    sub:   'blogging platform on ATProto',
    tag:   'BLOGGING',
    icon:  'globe',
    accent: { border: 'border-violet-500/25', bg: 'bg-violet-950/15', hover: 'hover:border-violet-400/50 hover:bg-violet-950/30', text: 'text-violet-300', dim: 'text-violet-400/40' },
  },
  {
    label: 'FRONTPAGE',
    href:  'https://frontpage.fyi',
    sub:   'HN-style link aggregator on ATProto',
    tag:   'AGGREGATOR',
    icon:  'zap',
    accent: { border: 'border-emerald-500/25', bg: 'bg-emerald-950/15', hover: 'hover:border-emerald-400/50 hover:bg-emerald-950/30', text: 'text-emerald-300', dim: 'text-emerald-400/40' },
  },
  {
    label: 'SKYFEED',
    href:  'https://skyfeed.app',
    sub:   'custom Bluesky feed builder',
    tag:   'FEEDS',
    icon:  'zap',
    accent: { border: 'border-teal-500/25', bg: 'bg-teal-950/15', hover: 'hover:border-teal-400/50 hover:bg-teal-950/30', text: 'text-teal-300', dim: 'text-teal-400/40' },
  },
  {
    label: 'SMOKE SIGNAL',
    href:  'https://smokesignal.events',
    sub:   'events protocol on ATProto',
    tag:   'EVENTS',
    icon:  'globe',
    accent: { border: 'border-rose-500/25', bg: 'bg-rose-950/15', hover: 'hover:border-rose-400/50 hover:bg-rose-950/30', text: 'text-rose-300', dim: 'text-rose-400/40' },
  },
  {
    label: 'GRAYSKY',
    href:  'https://graysky.app',
    sub:   'open-source mobile Bluesky client',
    tag:   'CLIENT',
    icon:  'butterfly',
    accent: { border: 'border-purple-500/25', bg: 'bg-purple-950/15', hover: 'hover:border-purple-400/50 hover:bg-purple-950/30', text: 'text-purple-300', dim: 'text-purple-400/40' },
  },
];

const latest = (arr) =>
  Array.isArray(arr) && arr.length ? (arr[arr.length - 1]?.value ?? '—') : '—';

const relativeTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

// ── Component ──────────────────────────────────────────────────────────────────
const BSKY_HANDLE = 'scale94.com';

const BskyTab = () => {
  const [bskyStats, setBskyStats] = useState(null);
  const [topPosts,  setTopPosts]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [fetchErr,  setFetchErr]  = useState(null);
  const [lastSync,  setLastSync]  = useState(null);
  const [commits,   setCommits]   = useState([]);
  const [commitsLoading, setCommitsLoading] = useState(true);

  const apiEnabled = Boolean(GT_DID && GT_KEY);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      // Always fetch profile stats from the public Bluesky API (no key needed)
      const profile = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${BSKY_HANDLE}`
      ).then(r => r.json());
      setBskyStats({
        followers: profile.followersCount ?? '—',
        following: profile.followsCount   ?? '—',
        posts:     profile.postsCount     ?? '—',
      });

      // Top-posts require GraphTracks
      if (apiEnabled) {
        const headers = { 'X-API-Key': GT_KEY };
        const base    = `${GT_BASE}/v1/api/networks/${GT_NETWORK}/accounts/${GT_DID}`;
        const top = await fetch(`${base}/top-posts`, { headers }).then(r => r.json());
        setTopPosts(Array.isArray(top) ? top.slice(0, 6) : []);
      }

      setLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      setFetchErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    fetch('https://api.github.com/repos/bluesky-social/atproto/commits?per_page=8')
      .then(r => r.json())
      .then(data => setCommits(Array.isArray(data) ? data : []))
      .catch(() => setCommits([]))
      .finally(() => setCommitsLoading(false));
  }, []);

  return (
    <div className="tab-fade-v2 max-w-6xl mx-auto mt-8">

      <style>{`
        @keyframes bk-float {
          0%, 100% { transform: translateY(0px) rotate(-1deg);  filter: drop-shadow(0 0 10px rgba(56,189,248,0.7)); }
          50%       { transform: translateY(-5px) rotate(1deg); filter: drop-shadow(0 0 18px rgba(56,189,248,1)); }
        }
        @keyframes bk-titleReveal {
          from { opacity: 0; letter-spacing: 0.35em; }
          to   { opacity: 1; letter-spacing: 0.025em; }
        }
        @keyframes bk-subReveal {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes bk-statGlow {
          0%, 100% { text-shadow: 0 0 8px rgba(56,189,248,0.6), 0 0 16px rgba(56,189,248,0.2); }
          50%       { text-shadow: 0 0 18px rgba(56,189,248,1),  0 0 36px rgba(34,211,238,0.5), 0 0 56px rgba(56,189,248,0.15); }
        }
        @keyframes bk-scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes bk-cardReveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bk-ping-slow {
          0%   { transform: scale(1);    opacity: 0.8; }
          70%  { transform: scale(1.8);  opacity: 0; }
          100% { transform: scale(1.8);  opacity: 0; }
        }
        .bk-scanline-overlay::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent 50%, rgba(56,189,248,0.03) 50%);
          background-size: 100% 4px;
          pointer-events: none;
          z-index: 1;
        }
        .bk-sweep::before {
          content: '';
          position: absolute;
          left: 0; right: 0;
          height: 60px;
          background: linear-gradient(to bottom, transparent, rgba(56,189,248,0.04), transparent);
          animation: bk-scanline 4s linear infinite;
          pointer-events: none;
          z-index: 2;
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-sky-900/30 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <ButterflyIcon
              className="w-10 h-10 shrink-0 text-sky-400"
              style={{ animation: 'bk-float 3.2s ease-in-out infinite' }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #BAE6FD, #38BDF8, #67E8F9)',
                animation: 'bk-titleReveal 0.7s cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >
              BSKY_NETWORK
            </span>
          </h2>
          <div
            className="text-[10px] font-bold tracking-[0.3em] text-sky-400/50 uppercase flex items-center gap-2"
            style={{ opacity: 0, animation: 'bk-subReveal 0.5s ease 0.4s forwards' }}
          >
            <Radio className="w-2.5 h-2.5" />
            AT PROTOCOL // BLUESKY SOCIAL STREAM
          </div>
        </div>

        <ATProtoGraph />

        <div className="flex items-center gap-3 shrink-0">
          {lastSync && (
            <span className="text-[9px] text-sky-400/30 font-mono tabular-nums tracking-widest">
              SYNCED {lastSync}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-[9px] font-bold tracking-widest text-sky-400/50 hover:text-sky-300 border border-sky-900/40 px-2.5 py-1.5 transition-colors uppercase disabled:opacity-40 hover:border-sky-500/30"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
            SYNC
          </button>
          <div className={`flex items-center gap-2 text-[9px] font-bold tracking-widest border px-3 py-1.5 uppercase ${
            bskyStats
              ? 'border-sky-500/30 bg-sky-950/20 text-sky-400'
              : 'border-gray-700/20 bg-black/20 text-gray-600'
          }`}>
            <div className="relative flex items-center justify-center">
              <div className={`w-1.5 h-1.5 rounded-full ${bskyStats ? 'bg-sky-400' : 'bg-gray-600'}`} />
              {bskyStats && (
                <div className="absolute w-1.5 h-1.5 rounded-full bg-sky-400"
                  style={{ animation: 'bk-ping-slow 2s cubic-bezier(0,0,0.2,1) infinite' }} />
              )}
            </div>
            {bskyStats ? 'LIVE' : 'STATIC'}
          </div>
        </div>
      </div>

      {/* ── Profile dossier ─────────────────────────────────────────────────── */}
      <div className="bk-scanline-overlay bk-sweep border border-sky-900/30 bg-gradient-to-br from-sky-950/20 via-black/60 to-blue-950/10 p-6 mb-6 relative overflow-hidden hover:border-sky-500/30 transition-all duration-300">
        {/* corner brackets */}
        <span className="absolute top-0 left-0 w-4 h-4 border-t border-l border-sky-500/40 pointer-events-none" />
        <span className="absolute top-0 right-0 w-4 h-4 border-t border-r border-sky-500/40 pointer-events-none" />
        <span className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-sky-500/40 pointer-events-none" />
        <span className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-sky-500/40 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-4 sm:gap-6 items-center">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-black border-2 border-sky-500/40 flex items-center justify-center"
              style={{ boxShadow: '0 0 24px rgba(56,189,248,0.15), inset 0 0 16px rgba(56,189,248,0.05)' }}>
              <ButterflyIcon className="w-8 h-8 text-sky-400"
                style={{ animation: 'bk-float 3.2s ease-in-out infinite' }} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-sky-400 border-2 border-black"
              style={{ boxShadow: '0 0 8px rgba(56,189,248,0.9)' }} />
          </div>

          {/* Identity block */}
          <div className="min-w-0">
            <div className="text-[9px] font-bold tracking-[0.3em] text-sky-400/40 uppercase mb-1.5">
              NODE_IDENTITY
            </div>
            <div className="text-xl font-bold text-sky-200 tracking-tight mb-0.5">scale_9.4</div>
            <div className="text-[11px] text-sky-400/50 font-mono mb-1">@scale94.com</div>
            <div className="text-[9px] text-sky-400/20 font-mono truncate max-w-xs mb-3">
              DID: {GT_DID || 'did:plc:··············'}
            </div>
            <a
              href="https://bsky.app/profile/scale94.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-sky-400/70 border border-sky-500/25 px-2.5 py-1.5 hover:text-sky-200 hover:border-sky-400/50 hover:bg-sky-950/30 transition-all"
            >
              <Globe className="w-2.5 h-2.5" /> OPEN PROFILE
            </a>
          </div>

          {/* Stats — stacks below identity on mobile, sits beside on sm+ */}
          <div className="col-span-2 sm:col-span-1 flex gap-6 sm:gap-8 shrink-0 justify-end">
            {[
              { label: 'FOLLOWERS', value: bskyStats?.followers ?? (loading ? '…' : '—') },
              { label: 'FOLLOWING', value: bskyStats?.following ?? (loading ? '…' : '—') },
              { label: 'POSTS',     value: bskyStats?.posts     ?? (loading ? '…' : '—') },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center sm:items-end gap-1">
                <div
                  className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-sky-300"
                  style={{ animation: 'bk-statGlow 3s ease-in-out infinite' }}
                >
                  {value}
                </div>
                <div className="text-[7px] sm:text-[8px] text-sky-400/30 uppercase tracking-[0.2em]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── dollspace featured credit ────────────────────────────────────────── */}
      <div style={{
        background: '#0a0a0f',
        border: '1px solid #1a1a2e',
        borderRadius: 2,
        padding: '18px 20px',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 2,
          background: 'linear-gradient(180deg, #00ffd5, #b44aff)',
        }} />
        <div style={{
          position: 'absolute', top: 10, right: 14,
          fontSize: 9, letterSpacing: '0.22em', fontWeight: 700,
          color: '#b44aff', opacity: 0.7,
        }}>OPEN_SOURCE // CONTRIB</div>

        <div style={{ paddingLeft: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{
              fontSize: 15, fontWeight: 900, letterSpacing: '0.12em',
              background: 'linear-gradient(90deg, #00ffd5, #b44aff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>dollspace</span>
            <span style={{ fontSize: 9, color: '#00ffd5', opacity: 0.5, letterSpacing: '0.2em' }}>·</span>
            <a
              href="https://dollspace.gay"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 9, color: '#00ffd5', opacity: 0.55, letterSpacing: '0.15em', textDecoration: 'none', fontWeight: 700 }}
            >dollspace.gay</a>
            <a
              href="https://github.com/dollspace-gay/Tesseract-Vault"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 9, color: '#b44aff', opacity: 0.7, letterSpacing: '0.15em', textDecoration: 'none', fontWeight: 700 }}
            >github</a>
          </div>

          <div style={{ fontSize: 11, color: '#e0e0e0', opacity: 0.7, marginBottom: 10, lineHeight: 1.5 }}>
            Repo kindly provided.{' '}
            <a
              href="https://github.com/dollspace-gay/Tesseract-Vault"
              target="_blank" rel="noopener noreferrer"
              style={{ color: '#ff6b9d', textDecoration: 'none', fontWeight: 700 }}
            >Tesseract-Vault</a>
            {' '}— production-grade Rust encryption suite: ML-KEM-1024, ML-DSA-87, AES-256-GCM, Argon2id, BLAKE3.
            WASM-ported as a browser kernel in Scale 9.4.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['run tesseract', 'run vault', 'run blake3', 'run argon2'].map(cmd => (
              <span key={cmd} style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                color: '#00ffd5', background: 'rgba(0,255,213,0.07)',
                border: '1px solid rgba(0,255,213,0.18)',
                padding: '3px 8px', borderRadius: 2,
              }}>{cmd}</span>
            ))}
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
              color: '#b44aff', background: 'rgba(180,74,255,0.07)',
              border: '1px solid rgba(180,74,255,0.18)',
              padding: '3px 8px', borderRadius: 2,
            }}>run tesseract --verbose 1</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(180,74,255,0.1)', margin: '14px 0 14px 10px' }} />

        <div style={{ paddingLeft: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{
              fontSize: 15, fontWeight: 900, letterSpacing: '0.12em',
              background: 'linear-gradient(90deg, #ff6b9d, #b44aff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>nico</span>
            <span style={{ fontSize: 9, color: '#b44aff', opacity: 0.5, letterSpacing: '0.2em' }}>·</span>
            <a
              href="https://github.com/grey-c0"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 9, color: '#b44aff', opacity: 0.7, letterSpacing: '0.15em', textDecoration: 'none', fontWeight: 700 }}
            >github</a>
          </div>

          <div style={{ fontSize: 11, color: '#e0e0e0', opacity: 0.7, marginBottom: 10, lineHeight: 1.5 }}>
            Surveillance legislation tracker.{' '}
            <a
              href="https://github.com/grey-c0/legislation"
              target="_blank" rel="noopener noreferrer"
              style={{ color: '#ff6b9d', textDecoration: 'none', fontWeight: 700 }}
            >grey-c0/legislation</a>
            {' '}— integrated into Scale 9.4 as the live legislative corpus powering the Surveillance tab.
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
              color: '#ff6b9d', background: 'rgba(255,107,157,0.07)',
              border: '1px solid rgba(255,107,157,0.18)',
              padding: '3px 8px', borderRadius: 2,
            }}>run surveillance</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(56,189,248,0.1)', margin: '14px 0 14px 10px' }} />

        <div style={{ paddingLeft: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{
              fontSize: 15, fontWeight: 900, letterSpacing: '0.12em',
              background: 'linear-gradient(90deg, #38bdf8, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>psingletary</span>
            <span style={{ fontSize: 9, color: '#38bdf8', opacity: 0.5, letterSpacing: '0.2em' }}>·</span>
            <a
              href="https://psingletary.com"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 9, color: '#38bdf8', opacity: 0.7, letterSpacing: '0.15em', textDecoration: 'none', fontWeight: 700 }}
            >psingletary.com</a>
          </div>

          <div style={{ fontSize: 11, color: '#e0e0e0', opacity: 0.7, marginBottom: 10, lineHeight: 1.5 }}>
            AT Protocol + Bluesky resource links.
            Curated the full AT Proto and bsky link manifest powering this tab — protocol spec, identity, data repos, dev toolkit, and ecosystem apps.
          </div>
        </div>
      </div>

      {/* ── Analytics engine status ──────────────────────────────────────────── */}
      {fetchErr ? (
        <div className="mb-6 px-4 py-3 border border-red-900/30 bg-red-950/10 text-[10px] font-mono text-red-400/60 flex items-center gap-2">
          <span className="text-red-500/80">✗</span>
          FETCH ERROR: {fetchErr}
          <button onClick={fetchData}
            className="ml-auto text-red-400/50 hover:text-red-300 uppercase text-[9px] tracking-widest border border-red-900/30 px-2 py-0.5">
            RETRY
          </button>
        </div>
      ) : !apiEnabled ? (
        <div className="mb-6 border border-sky-900/20 bg-black/30 text-[10px] font-mono overflow-hidden">
          <div className="px-4 py-2 border-b border-sky-900/15 flex items-center gap-2 text-sky-400/30">
            <span className="text-sky-500/60">&gt;_</span>
            <span className="tracking-widest uppercase">ANALYTICS_ENGINE</span>
            <span className="ml-auto text-sky-400/20 tracking-widest">GRAPHTRACKS — OFFLINE</span>
          </div>
          <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sky-400/30">└─</span>
              <span className="text-sky-400/40">VITE_GRAPHTRACKS_KEY</span>
              <code className="text-cyan-400/70 bg-cyan-950/20 border border-cyan-900/20 px-1.5 py-0.5">[NOT SET]</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sky-400/30">└─</span>
              <span className="text-sky-400/40">VITE_GRAPHTRACKS_DID</span>
              <code className="text-cyan-400/70 bg-cyan-950/20 border border-cyan-900/20 px-1.5 py-0.5">{GT_DID || '[NOT SET]'}</code>
            </div>
            <a
              href="https://github.com/graphtracks/docs"
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-sky-400/30 hover:text-sky-300/60 transition-colors hover:underline underline-offset-2 tracking-widest uppercase"
            >
              graphtracks/docs ↗
            </a>
          </div>
        </div>
      ) : null}

      {/* ── Top posts (live only) ────────────────────────────────────────────── */}
      {apiEnabled && topPosts.length > 0 && (
        <div className="mb-8">
          <div className="text-[9px] font-bold tracking-[0.3em] text-sky-400/40 uppercase mb-4 flex items-center gap-2 border-b border-sky-900/15 pb-2">
            <Zap className="w-2.5 h-2.5 text-cyan-500/60" />
            TOP_POSTS — ENGAGEMENT SIGNAL
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {topPosts.map((post, i) => {
              const text    = post.details?.record?.text ?? '';
              const thumb   = post.details?.embed?.images?.[0]?.thumb ?? null;
              const alt     = post.details?.embed?.images?.[0]?.alt   ?? '';
              const postUrl = `https://bsky.app/profile/${BSKY_HANDLE}/post/${post.post_id}`;
              const date    = post.indexedAt ? relativeTime(post.indexedAt) : '';
              return (
                <div key={post.post_id ?? i}
                  className="border border-sky-900/25 bg-black/40 p-4 hover:border-sky-500/35 hover:bg-sky-950/10 transition-all group relative overflow-hidden flex flex-col"
                  style={{ animation: `bk-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05 + 0.1}s both` }}
                >
                  <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sky-500/20 pointer-events-none" />

                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[9px] font-mono text-sky-400/25 uppercase tracking-[0.2em]">
                      SIGNAL_{String(i + 1).padStart(2, '00')}
                    </div>
                    {date && <div className="text-[9px] font-mono text-sky-400/20">{date}</div>}
                  </div>

                  {/* Image thumbnail */}
                  {thumb && (
                    <div className="mb-3 overflow-hidden border border-sky-900/20">
                      <img src={thumb} alt={alt}
                        className="w-full object-cover max-h-36 opacity-70 group-hover:opacity-90 transition-opacity"
                      />
                    </div>
                  )}

                  {/* Post text */}
                  {text && (
                    <p className="text-[11px] text-sky-200/60 mb-3 leading-relaxed flex-1 whitespace-pre-wrap">
                      {text}
                    </p>
                  )}

                  {/* Footer: stats + open link */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-sky-900/15">
                    <div className="flex gap-4 text-[9px] font-mono text-sky-400/30">
                      {post.likes    != null && <span>♡ {post.likes}</span>}
                      {post.reposts  != null && <span>⟳ {post.reposts}</span>}
                      {post.replies  != null && <span>⌁ {post.replies}</span>}
                    </div>
                    <a
                      href={postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[9px] font-bold tracking-widest text-sky-400/30 hover:text-sky-300/70 border border-sky-900/30 hover:border-sky-500/40 px-2 py-0.5 transition-all uppercase"
                      onClick={e => e.stopPropagation()}
                    >
                      ↗ bsky
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Protocol layer ────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="text-[9px] font-bold tracking-[0.3em] text-sky-400/40 uppercase mb-3 border-b border-sky-900/15 pb-2 flex items-center gap-2">
          <span className="text-sky-500/40">//</span>
          PROTOCOL_LAYER
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {PROTOCOL_RESOURCES.map(({ label, href, sub, tag, icon, accent }, i) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              className={`border ${accent.border} ${accent.bg} ${accent.hover} p-3 transition-all group flex flex-col gap-1.5 relative overflow-hidden`}
              style={{ animation: `bk-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06 + 0.1}s both` }}
            >
              <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-current opacity-20 pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {icon === 'butterfly' ? <ButterflyIcon className={`w-3 h-3 ${accent.text}`} />
                    : icon === 'zap'    ? <Zap className={`w-3 h-3 ${accent.text} fill-current`} />
                    :                    <Globe className={`w-3 h-3 ${accent.text}`} />}
                  <span className={`text-[10px] font-bold ${accent.text} tracking-wide`}>{label}</span>
                </div>
              </div>
              <span className={`text-[9px] ${accent.dim} font-mono leading-snug`}>{sub}</span>
              <span className={`text-[8px] ${accent.dim} mt-auto tracking-widest opacity-50`}>{tag}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Dev toolkit ───────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-[9px] font-bold tracking-[0.3em] text-sky-400/40 uppercase mb-3 border-b border-sky-900/15 pb-2 flex items-center gap-2">
          <span className="text-sky-500/40">//</span>
          DEV_TOOLKIT
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {TOOLKIT_RESOURCES.map(({ label, href, sub, tag, icon, accent }, i) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              className={`border ${accent.border} ${accent.bg} ${accent.hover} p-3 transition-all group flex flex-col gap-1.5 relative overflow-hidden`}
              style={{ animation: `bk-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06 + 0.2}s both` }}
            >
              <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-current opacity-20 pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {icon === 'butterfly' ? <ButterflyIcon className={`w-3 h-3 ${accent.text}`} />
                    : icon === 'zap'    ? <Zap className={`w-3 h-3 ${accent.text} fill-current`} />
                    :                    <Globe className={`w-3 h-3 ${accent.text}`} />}
                  <span className={`text-[10px] font-bold ${accent.text} tracking-wide`}>{label}</span>
                </div>
              </div>
              <span className={`text-[9px] ${accent.dim} font-mono leading-snug`}>{sub}</span>
              <span className={`text-[8px] ${accent.dim} mt-auto tracking-widest opacity-50`}>{tag}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Ecosystem apps ────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-[9px] font-bold tracking-[0.3em] text-sky-400/40 uppercase mb-3 border-b border-sky-900/15 pb-2 flex items-center gap-2">
          <span className="text-sky-500/40">//</span>
          ECOSYSTEM_APPS
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {ECOSYSTEM_RESOURCES.map(({ label, href, sub, tag, icon, accent }, i) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              className={`border ${accent.border} ${accent.bg} ${accent.hover} p-3 transition-all group flex flex-col gap-1.5 relative overflow-hidden`}
              style={{ animation: `bk-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06 + 0.3}s both` }}
            >
              <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-current opacity-20 pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {icon === 'butterfly' ? <ButterflyIcon className={`w-3 h-3 ${accent.text}`} />
                    : icon === 'zap'    ? <Zap className={`w-3 h-3 ${accent.text} fill-current`} />
                    :                    <Globe className={`w-3 h-3 ${accent.text}`} />}
                  <span className={`text-[10px] font-bold ${accent.text} tracking-wide`}>{label}</span>
                </div>
              </div>
              <span className={`text-[9px] ${accent.dim} font-mono leading-snug`}>{sub}</span>
              <span className={`text-[8px] ${accent.dim} mt-auto tracking-widest opacity-50`}>{tag}</span>
            </a>
          ))}
        </div>
      </div>

      {/* ── atproto commit feed ───────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-[9px] font-bold tracking-[0.3em] text-sky-400/40 uppercase mb-3 border-b border-sky-900/15 pb-2 flex items-center gap-2">
          <span className="text-sky-500/40">//</span>
          ATPROTO_COMMITS
          <span className="ml-auto text-sky-400/20 normal-case tracking-normal font-mono">bluesky-social/atproto</span>
        </div>
        <div className="border border-sky-900/20 bg-black/40 font-mono text-[10px] overflow-hidden">
          <div className="px-3 py-1.5 border-b border-sky-900/15 flex items-center gap-2 text-sky-400/20">
            <span className="text-sky-500/40">&gt;_</span>
            <span className="tracking-widest">git log --oneline origin/main</span>
          </div>
          <div className="divide-y divide-sky-900/10">
            {commitsLoading ? (
              [0,1,2].map(i => (
                <div key={i} className="px-3 py-2 flex items-center gap-3 opacity-30 animate-pulse">
                  <span className="w-14 h-3 bg-sky-900/40 rounded-sm shrink-0" />
                  <span className="flex-1 h-3 bg-sky-900/20 rounded-sm" />
                </div>
              ))
            ) : commits.length === 0 ? (
              <div className="px-3 py-3 text-sky-400/20">— fetch failed or rate limited —</div>
            ) : commits.map((c, i) => {
              const sha     = c.sha?.slice(0, 7) ?? '???????';
              const msg     = (c.commit?.message ?? '').split('\n')[0].slice(0, 72);
              const author  = c.commit?.author?.name ?? '—';
              const dateStr = c.commit?.author?.date;
              const rel     = dateStr ? relativeTime(dateStr) : '';
              return (
                <a
                  key={sha}
                  href={c.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 flex items-start gap-3 hover:bg-sky-950/20 transition-colors group"
                  style={{ animation: `bk-cardReveal 0.3s ease ${i * 0.04}s both` }}
                >
                  <span className="text-sky-500/50 shrink-0 group-hover:text-sky-400/80 transition-colors tabular-nums">{sha}</span>
                  <span className="text-sky-300/50 flex-1 min-w-0 truncate group-hover:text-sky-200/70 transition-colors">{msg}</span>
                  <span className="text-sky-400/20 shrink-0 hidden md:block">{author}</span>
                  <span className="text-sky-400/20 shrink-0 tabular-nums">{rel}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Protocol manifest footer ─────────────────────────────────────────── */}
      <div className="border border-sky-900/15 bg-black/20 mb-6">
        <div className="px-4 py-2 border-b border-sky-900/15 text-[9px] font-bold tracking-[0.3em] text-sky-400/30 uppercase flex items-center gap-2">
          <span className="text-sky-500/40">//</span> PROTOCOL_MANIFEST
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-sky-900/15">
          <div className="px-4 py-3 flex flex-col gap-1">
            <div className="text-[9px] text-sky-400/25 font-bold tracking-[0.25em] uppercase mb-0.5">HANDLE</div>
            <div className="text-[11px] font-mono text-sky-300/70">@scale94.com</div>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1">
            <div className="text-[9px] text-sky-400/25 font-bold tracking-[0.25em] uppercase mb-0.5">DID</div>
            <div className="text-[11px] font-mono text-sky-300/40 truncate">
              {GT_DID || 'set VITE_GRAPHTRACKS_DID'}
            </div>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1">
            <div className="text-[9px] text-sky-400/25 font-bold tracking-[0.25em] uppercase mb-0.5">ANALYTICS_ENGINE</div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${apiEnabled ? 'bg-sky-400' : 'bg-gray-700'}`}
                style={apiEnabled ? { boxShadow: '0 0 6px rgba(56,189,248,0.8)' } : {}} />
              <span className="text-[11px] font-mono text-sky-300/50">
                GraphTracks · {GT_NETWORK} · {apiEnabled ? 'CONFIGURED' : 'KEY_REQUIRED'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Open source credit — dollspace-gay/Tesseract-Vault ─────────────── */}
      <div className="border border-sky-900/15 bg-black/20 mb-6 px-4 py-3 flex flex-col gap-1">
        <div className="text-[9px] font-bold tracking-[0.3em] text-sky-400/30 uppercase mb-1 flex items-center gap-2">
          <span className="text-sky-500/40">//</span> OPEN_SOURCE_CREDIT
        </div>
        <div className="text-[10px] font-mono text-sky-300/50 leading-relaxed">
          Post-quantum cryptographic pipeline kernel ported from{' '}
          <a
            href="https://github.com/dollspace-gay/Tesseract-Vault"
            target="_blank"
            rel="noreferrer"
            className="text-sky-300/70 hover:text-sky-300 transition-colors underline underline-offset-2 decoration-sky-500/30"
          >
            github.com/dollspace-gay/Tesseract-Vault
          </a>
          {' '}— architecture by <span className="text-sky-300/70">dollspace-gay</span>.
          Repo kindly provided. WASM adaptation runs in-browser: Argon2id + ML-KEM-1024 + ML-DSA-87 + AES-256-GCM + BLAKE3.
        </div>
        <div className="text-[10px] font-mono text-sky-300/50 leading-relaxed mt-2 pt-2 border-t border-sky-900/15">
          Surveillance legislation corpus via{' '}
          <a
            href="https://github.com/grey-c0/legislation"
            target="_blank"
            rel="noreferrer"
            className="text-sky-300/70 hover:text-sky-300 transition-colors underline underline-offset-2 decoration-sky-500/30"
          >
            github.com/grey-c0/legislation
          </a>
          {' '}— by <span className="text-sky-300/70">nico</span>.
          Integrated as the live legislative corpus powering the Surveillance tab.
        </div>
        <div className="text-[10px] font-mono text-sky-300/50 leading-relaxed mt-2 pt-2 border-t border-sky-900/15">
          AT Protocol + Bluesky resource links via{' '}
          <a
            href="https://psingletary.com"
            target="_blank"
            rel="noreferrer"
            className="text-sky-300/70 hover:text-sky-300 transition-colors underline underline-offset-2 decoration-sky-500/30"
          >
            psingletary.com
          </a>
          {' '}— curated the full bsky/atproto link manifest for this tab.
        </div>
        <div className="text-[9px] font-mono text-sky-400/20 mt-1">
          run tesseract  ·  run vault  ·  run blake3  ·  run pqc_pipeline  ·  run surveillance
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="border-t border-sky-900/15 pt-4 pb-8 text-center">
        <div className="text-[9px] font-mono text-sky-400/20 tracking-widest mb-1">
          BSKY_NETWORK // AT PROTOCOL INTEGRATION — SCALE_9.4
        </div>
        <div className="text-[9px] font-mono text-sky-400/15">
          Analytics via{' '}
          <a href="https://github.com/graphtracks/docs" target="_blank" rel="noreferrer"
            className="hover:text-sky-400/35 transition-colors">
            GraphTracks REST API
          </a>
          {' · '}
          Protocol:{' '}
          <a href="https://atproto.com" target="_blank" rel="noreferrer"
            className="hover:text-sky-400/35 transition-colors">
            atproto.com
          </a>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BskyTab);

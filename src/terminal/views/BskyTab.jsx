import React, { useState, useEffect, useCallback } from 'react';
import { Globe, ChevronRight, Zap, RefreshCw, Radio } from 'lucide-react';

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
const ATPROTO_RESOURCES = [
  {
    label: 'BLUESKY PROFILE',
    href:  'https://bsky.app/profile/scale94.com',
    sub:   'bsky.app / @scale94.com',
    tag:   'SOCIAL_NODE',
    icon:  'butterfly',
    accent: { border: 'border-sky-500/25', bg: 'bg-sky-950/15', hover: 'hover:border-sky-400/50 hover:bg-sky-950/30', text: 'text-sky-300', dim: 'text-sky-400/40', glow: 'rgba(56,189,248,0.4)' },
  },
  {
    label: 'GRAPHTRACKS',
    href:  'https://graphtracks.com',
    sub:   'Bluesky network analytics',
    tag:   'ANALYTICS',
    icon:  'zap',
    accent: { border: 'border-cyan-500/25', bg: 'bg-cyan-950/15', hover: 'hover:border-cyan-400/50 hover:bg-cyan-950/30', text: 'text-cyan-300', dim: 'text-cyan-400/40', glow: 'rgba(34,211,238,0.4)' },
  },
  {
    label: 'AT PROTOCOL',
    href:  'https://atproto.com',
    sub:   'atproto.com — open protocol spec',
    tag:   'PROTOCOL',
    icon:  'globe',
    accent: { border: 'border-blue-500/25', bg: 'bg-blue-950/15', hover: 'hover:border-blue-400/50 hover:bg-blue-950/30', text: 'text-blue-300', dim: 'text-blue-400/40', glow: 'rgba(96,165,250,0.4)' },
  },
  {
    label: 'GRAPHTRACKS DOCS',
    href:  'https://github.com/graphtracks/docs',
    sub:   'OpenAPI spec — REST analytics',
    tag:   'REFERENCE',
    icon:  'globe',
    accent: { border: 'border-indigo-500/25', bg: 'bg-indigo-950/15', hover: 'hover:border-indigo-400/50 hover:bg-indigo-950/30', text: 'text-indigo-300', dim: 'text-indigo-400/40', glow: 'rgba(129,140,248,0.4)' },
  },
];

const latest = (arr) =>
  Array.isArray(arr) && arr.length ? (arr[arr.length - 1]?.value ?? '—') : '—';

// ── Component ──────────────────────────────────────────────────────────────────
const BSKY_HANDLE = 'scale94.com';

const BskyTab = () => {
  const [bskyStats, setBskyStats] = useState(null);
  const [topPosts,  setTopPosts]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [fetchErr,  setFetchErr]  = useState(null);
  const [lastSync,  setLastSync]  = useState(null);

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

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto mt-8">

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

        <div className="relative z-10 grid grid-cols-[auto_1fr_auto] gap-6 items-center">
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

          {/* Stats */}
          <div className="flex gap-8 shrink-0">
            {[
              { label: 'FOLLOWERS', value: bskyStats?.followers ?? (loading ? '…' : '—') },
              { label: 'FOLLOWING', value: bskyStats?.following ?? (loading ? '…' : '—') },
              { label: 'POSTS',     value: bskyStats?.posts     ?? (loading ? '…' : '—') },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-end gap-1">
                <div
                  className="text-2xl font-bold font-mono tabular-nums text-sky-300"
                  style={{ animation: 'bk-statGlow 3s ease-in-out infinite' }}
                >
                  {value}
                </div>
                <div className="text-[8px] text-sky-400/30 uppercase tracking-[0.2em]">{label}</div>
              </div>
            ))}
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
              <code className="text-cyan-400/70 bg-cyan-950/20 border border-cyan-900/20 px-1.5 py-0.5">[NOT SET]</code>
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
            {topPosts.map((post, i) => (
              <div key={post.id ?? i}
                className="border border-sky-900/25 bg-black/40 p-4 hover:border-sky-500/35 hover:bg-sky-950/10 transition-all group relative overflow-hidden"
                style={{ animation: `bk-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05 + 0.1}s both` }}
              >
                <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-sky-500/20 pointer-events-none" />
                <div className="text-[9px] font-mono text-sky-400/25 mb-2 uppercase tracking-[0.2em]">
                  SIGNAL_{String(i + 1).padStart(2, '0')}
                </div>
                {post.text && (
                  <p className="text-[11px] text-sky-200/50 mb-3 line-clamp-3 leading-relaxed">
                    {post.text}
                  </p>
                )}
                <div className="flex gap-4 text-[9px] font-mono text-sky-400/30">
                  {post.likes   != null && <span>♡ {post.likes}</span>}
                  {post.reposts != null && <span>⟳ {post.reposts}</span>}
                  {post.replies != null && <span>⌁ {post.replies}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Network resource manifest ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-[9px] font-bold tracking-[0.3em] text-sky-400/40 uppercase mb-4 border-b border-sky-900/15 pb-2 flex items-center gap-2">
          <span className="text-sky-500/40">//</span>
          NETWORK_RESOURCES
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {ATPROTO_RESOURCES.map(({ label, href, sub, tag, icon, accent }, i) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className={`border ${accent.border} ${accent.bg} ${accent.hover} p-4 transition-all group flex flex-col gap-2 relative overflow-hidden`}
              style={{ animation: `bk-cardReveal 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.07 + 0.1}s both` }}
            >
              <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-current opacity-20 pointer-events-none" />
              <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-current opacity-20 pointer-events-none" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {icon === 'butterfly'
                    ? <ButterflyIcon className={`w-3.5 h-3.5 ${accent.text}`} />
                    : icon === 'zap'
                    ? <Zap className={`w-3.5 h-3.5 ${accent.text} fill-current`} />
                    : <Globe className={`w-3.5 h-3.5 ${accent.text}`} />
                  }
                  <span className={`text-[11px] font-bold ${accent.text} tracking-wide`}>{label}</span>
                </div>
                <span className={`text-[8px] ${accent.dim} font-mono tracking-widest`}>{tag}</span>
              </div>

              <span className={`text-[10px] ${accent.dim} font-mono leading-snug`}>{sub}</span>

              <span className={`text-[9px] ${accent.dim} mt-auto flex items-center gap-1 uppercase tracking-widest group-hover:opacity-80 transition-opacity`}>
                <ChevronRight className="w-2.5 h-2.5" /> OPEN
              </span>
            </a>
          ))}
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
        <div className="text-[9px] font-mono text-sky-400/20 mt-1">
          run tesseract  ·  run vault  ·  run blake3  ·  run pqc_pipeline
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

import React, { useState, useEffect, useCallback } from 'react';
import { Globe, ChevronRight, Zap, RefreshCw } from 'lucide-react';

// ── Bluesky butterfly icon (custom SVG — lucide-react has no butterfly) ────────
// Shaped after the Bluesky brand butterfly: two upper + two lower filled wings + body
export const ButterflyIcon = ({ className, style }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {/* Upper left wing */}
    <path d="M11.5 11C9.5 9.5 5.5 7 2.5 8.5C0.5 9.5 1 12 4 13C6.5 13.8 9.5 13 11.5 11Z" />
    {/* Upper right wing */}
    <path d="M12.5 11C14.5 9.5 18.5 7 21.5 8.5C23.5 9.5 23 12 20 13C17.5 13.8 14.5 13 12.5 11Z" />
    {/* Lower left wing */}
    <path d="M11.5 13.5C9 14 4 15 3 18C2.5 19.5 4.5 21 7.5 19.5C9.5 18.5 11 16.5 11.5 13.5Z" />
    {/* Lower right wing */}
    <path d="M12.5 13.5C15 14 20 15 21 18C21.5 19.5 19.5 21 16.5 19.5C14.5 18.5 13 16.5 12.5 13.5Z" />
    {/* Body */}
    <ellipse cx="12" cy="12.5" rx="0.9" ry="3.5" />
    {/* Antennae */}
    <path d="M11.4 9.5 Q10 7.5 8.5 6" strokeWidth="0.8" stroke="currentColor" fill="none" strokeLinecap="round" />
    <path d="M12.6 9.5 Q14 7.5 15.5 6" strokeWidth="0.8" stroke="currentColor" fill="none" strokeLinecap="round" />
  </svg>
);

// ── GraphTracks API config ──────────────────────────────────────────────────────
// Network must be exactly 'BlueSky' per GraphTracks API spec.
// Set VITE_GRAPHTRACKS_KEY and VITE_GRAPHTRACKS_DID in your .env to enable live data.
// DID example for @scale94.com: resolve via
//   https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=scale94.com
const GT_BASE    = 'https://api.graphtracks.com';
const GT_NETWORK = 'BlueSky';
const GT_DID     = import.meta.env.VITE_GRAPHTRACKS_DID || null;
const GT_KEY     = import.meta.env.VITE_GRAPHTRACKS_KEY || null;

// ── AT Protocol / Bluesky resource links ───────────────────────────────────────
// Extend this array with Patrick Singletary's recommended atproto links
const ATPROTO_RESOURCES = [
  {
    label: 'BLUESKY PROFILE',
    href:  'https://bsky.app/profile/scale94.com',
    sub:   'bsky.app / @scale94.com',
    icon:  'butterfly',
    color: 'text-sky-400',
  },
  {
    label: 'GRAPHTRACKS',
    href:  'https://graphtracks.com',
    sub:   'Bluesky network analytics',
    icon:  'zap',
    color: 'text-[#39ff14]',
  },
  {
    label: 'AT PROTOCOL',
    href:  'https://atproto.com',
    sub:   'atproto.com — open protocol spec',
    icon:  'globe',
    color: 'text-cyan-400',
  },
  {
    label: 'GRAPHTRACKS API DOCS',
    href:  'https://github.com/graphtracks/docs',
    sub:   'OpenAPI spec — REST analytics',
    icon:  'globe',
    color: 'text-sky-400',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const latest = (arr) =>
  Array.isArray(arr) && arr.length
    ? (arr[arr.length - 1]?.value ?? '—')
    : '—';

// ── Component ──────────────────────────────────────────────────────────────────
const BskyTab = () => {
  const [bskyStats, setBskyStats] = useState(null);   // { followers, following, posts }
  const [topPosts,  setTopPosts]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [fetchErr,  setFetchErr]  = useState(null);
  const [lastSync,  setLastSync]  = useState(null);

  const apiEnabled = Boolean(GT_DID && GT_KEY);

  // ── Fetch live GraphTracks data ─────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!apiEnabled) return;
    setLoading(true);
    setFetchErr(null);
    try {
      const headers = { 'X-API-Key': GT_KEY };
      const base    = `${GT_BASE}/v1/api/networks/${GT_NETWORK}/accounts/${GT_DID}`;

      const [fol, fwd, pts, top] = await Promise.all([
        fetch(`${base}/stats/followers`, { headers }).then(r => r.json()),
        fetch(`${base}/stats/following`, { headers }).then(r => r.json()),
        fetch(`${base}/stats/posts`,     { headers }).then(r => r.json()),
        fetch(`${base}/top-posts`,       { headers }).then(r => r.json()),
      ]);

      setBskyStats({
        followers: latest(fol),
        following: latest(fwd),
        posts:     latest(pts),
      });
      setTopPosts(Array.isArray(top) ? top.slice(0, 6) : []);
      setLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      setFetchErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => {
    if (apiEnabled) fetchData();
  }, [fetchData, apiEnabled]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto mt-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes bk-float {
          0%, 100% { transform: translateY(0px);    filter: drop-shadow(0 0 8px rgba(56,189,248,0.6)); }
          50%       { transform: translateY(-4px);   filter: drop-shadow(0 0 14px rgba(56,189,248,0.9)); }
        }
        @keyframes bk-titleReveal {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bk-subReveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-sky-900/40 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <ButterflyIcon
              className="w-10 h-10 shrink-0 text-sky-400"
              style={{ animation: 'bk-float 3.2s ease-in-out infinite' }}
            />
            <span
              className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-blue-400 to-cyan-400"
              style={{ animation: 'bk-titleReveal 0.6s cubic-bezier(0.16,1,0.3,1) forwards' }}
            >
              BSKY_NETWORK
            </span>
          </h2>
          <div
            className="text-sm font-bold tracking-widest text-sky-400 uppercase"
            style={{ opacity: 0, animation: 'bk-subReveal 0.5s ease 0.4s forwards' }}
          >
            AT PROTOCOL // BLUESKY SOCIAL STREAM
          </div>
        </div>

        {/* Live / sync controls */}
        <div className="flex items-center gap-3 shrink-0">
          {lastSync && (
            <span className="text-[9px] text-sky-400/40 font-mono tabular-nums">
              SYNCED {lastSync}
            </span>
          )}
          {apiEnabled && (
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-sky-400/60 hover:text-sky-300 border border-sky-900/40 px-2 py-1 rounded-sm transition-colors uppercase disabled:opacity-40"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
              SYNC
            </button>
          )}
          <div className={`flex items-center gap-2 text-xs border px-3 py-1 rounded-sm ${
            apiEnabled
              ? 'border-sky-500/30 bg-sky-900/10 text-sky-400'
              : 'border-gray-700/30 bg-gray-900/10 text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              apiEnabled
                ? 'bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                : 'bg-gray-600'
            }`} />
            {apiEnabled ? 'LIVE' : 'STATIC'}
          </div>
        </div>
      </div>

      {/* ── Profile hero ────────────────────────────────────────────────────── */}
      <div className="border border-sky-900/30 bg-sky-900/5 rounded-lg p-6 mb-6 flex flex-col md:flex-row items-start md:items-center gap-6 hover:border-sky-500/40 transition-all">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-black border border-sky-500/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(56,189,248,0.15)]">
          <ButterflyIcon className="w-8 h-8 text-sky-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-sky-300 tracking-tight mb-0.5">scale_9.4</div>
          <div className="text-sm text-sky-400/50 font-mono mb-3">@scale94.com · AT Protocol</div>
          <a
            href="https://bsky.app/profile/scale94.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-white border border-sky-500/30 px-3 py-1.5 rounded-sm hover:bg-sky-900/30 transition-all uppercase tracking-wide"
          >
            <Globe className="w-3 h-3" /> OPEN ON BLUESKY
          </a>
        </div>

        {/* Live stats or placeholder */}
        <div className="flex gap-6 shrink-0">
          {[
            { label: 'Followers', value: bskyStats?.followers ?? (apiEnabled ? '…' : '—') },
            { label: 'Following', value: bskyStats?.following ?? (apiEnabled ? '…' : '—') },
            { label: 'Posts',     value: bskyStats?.posts     ?? (apiEnabled ? '…' : '—') },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold font-mono tabular-nums text-sky-300">
                {value}
              </div>
              <div className="text-[9px] text-sky-400/40 uppercase tracking-widest mt-1">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── GraphTracks API status banner ────────────────────────────────────── */}
      {!apiEnabled ? (
        <div className="mb-6 px-4 py-3 border border-sky-900/20 bg-black/30 rounded-sm text-xs font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sky-500">{'>_'}</span>
          <span className="text-sky-400/50">ANALYTICS ENGINE:</span>
          <span className="text-sky-300 font-bold tracking-widest">GRAPHTRACKS</span>
          <span className="text-sky-400/30">—</span>
          <span className="text-sky-400/50">set</span>
          <code className="text-[#39ff14] bg-black/40 px-1 rounded">VITE_GRAPHTRACKS_KEY</code>
          <span className="text-sky-400/30">+</span>
          <code className="text-[#39ff14] bg-black/40 px-1 rounded">VITE_GRAPHTRACKS_DID</code>
          <span className="text-sky-400/50">in .env to unlock live follower + post stats</span>
          <a
            href="https://github.com/graphtracks/docs"
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-sky-400/40 hover:text-sky-300 transition-colors hover:underline underline-offset-2"
          >
            graphtracks/docs ↗
          </a>
        </div>
      ) : fetchErr ? (
        <div className="mb-6 px-4 py-3 border border-red-900/30 bg-red-950/10 rounded-sm text-xs font-mono text-red-400/70 flex items-center gap-2">
          <span className="text-red-500">✗</span>
          GRAPHTRACKS ERROR: {fetchErr}
          <button onClick={fetchData} className="ml-auto text-red-400/50 hover:text-red-300 uppercase text-[9px] tracking-widest border border-red-900/30 px-2 py-0.5 rounded-sm">
            RETRY
          </button>
        </div>
      ) : null}

      {/* ── Top Posts grid (live API only) ───────────────────────────────────── */}
      {apiEnabled && topPosts.length > 0 && (
        <div className="mb-8">
          <div className="text-[10px] font-bold tracking-widest text-sky-400/50 uppercase mb-4 flex items-center gap-2 border-b border-sky-900/20 pb-2">
            <Zap className="w-3 h-3 text-sky-500" /> TOP POSTS — ENGAGEMENT SIGNAL
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {topPosts.map((post, i) => (
              <div
                key={post.id ?? i}
                className="border border-sky-900/30 bg-black/40 p-4 rounded-sm hover:border-sky-500/40 hover:bg-sky-900/5 transition-all group cursor-default"
              >
                <div className="text-[10px] font-mono text-sky-400/30 mb-2 uppercase tracking-widest">
                  SIGNAL_{String(i + 1).padStart(2, '0')}
                </div>
                {post.text && (
                  <p className="text-xs text-sky-200/60 mb-3 line-clamp-3 leading-relaxed">
                    {post.text}
                  </p>
                )}
                <div className="flex gap-4 text-[10px] font-mono text-sky-400/40">
                  {post.likes    != null && <span>♡ {post.likes}</span>}
                  {post.reposts  != null && <span>⟳ {post.reposts}</span>}
                  {post.replies  != null && <span>⌁ {post.replies}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AT Protocol resource grid ─────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-[10px] font-bold tracking-widest text-sky-400/50 uppercase mb-4 border-b border-sky-900/20 pb-2">
          AT_PROTOCOL // NETWORK RESOURCES
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {ATPROTO_RESOURCES.map(({ label, href, sub, icon, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="border border-sky-900/30 bg-black/40 p-4 rounded-sm hover:border-sky-500/50 hover:bg-sky-900/5 transition-all group flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                {icon === 'butterfly'
                  ? <ButterflyIcon className={`w-4 h-4 ${color}`} />
                  : icon === 'zap'
                  ? <Zap className={`w-4 h-4 ${color} fill-current`} />
                  : <Globe className={`w-4 h-4 ${color}`} />
                }
                <span className={`text-sm font-bold ${color} group-hover:brightness-125 transition-all`}>
                  {label}
                </span>
              </div>
              <span className="text-xs text-sky-400/40 font-mono leading-snug">{sub}</span>
              <span className="text-[9px] text-sky-400/30 mt-auto flex items-center gap-1 uppercase tracking-wide group-hover:text-sky-400/60 transition-colors">
                <ChevronRight className="w-3 h-3" /> OPEN LINK
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Signal / contact row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="border border-sky-900/20 bg-black/30 p-4 rounded-sm flex flex-col gap-2">
          <div className="text-[9px] font-bold tracking-widest text-sky-400/40 uppercase mb-1">
            CONTACT // BSKY
          </div>
          <div className="text-sm font-mono text-sky-300">@scale94.com</div>
          <div className="text-[10px] text-sky-400/30 font-mono">
            DID: {GT_DID || 'set VITE_GRAPHTRACKS_DID'}
          </div>
        </div>
        <div className="border border-fuchsia-900/20 bg-black/30 p-4 rounded-sm flex flex-col gap-2">
          <div className="text-[9px] font-bold tracking-widest text-fuchsia-400/40 uppercase mb-1">
            ANALYTICS ENGINE
          </div>
          <div className="text-sm font-bold text-fuchsia-400">GraphTracks API</div>
          <div className="text-[10px] text-fuchsia-400/30 font-mono">
            Network: {GT_NETWORK} · Status: {apiEnabled ? 'CONFIGURED' : 'KEY_REQUIRED'}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div className="border-t border-sky-900/20 pt-6 pb-8 text-center">
        <div className="text-[10px] font-mono text-sky-400/25 tracking-widest mb-1">
          BSKY_NETWORK // AT PROTOCOL INTEGRATION — SCALE_9.4
        </div>
        <div className="text-[9px] font-mono text-sky-400/20">
          Analytics via{' '}
          <a
            href="https://github.com/graphtracks/docs"
            target="_blank"
            rel="noreferrer"
            className="hover:text-sky-400/40 transition-colors"
          >
            GraphTracks REST API
          </a>
          {' · '}
          Protocol:{' '}
          <a
            href="https://atproto.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-sky-400/40 transition-colors"
          >
            atproto.com
          </a>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BskyTab);

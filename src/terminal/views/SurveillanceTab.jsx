import React, { useState, useMemo, useCallback } from 'react';
import { ShieldAlert, ChevronRight, Globe, Filter, AlertTriangle, X, Activity } from 'lucide-react';
import WorldMap from '../components/WorldMap';
import { toMapXY } from '../data/worldMapPolys';

// ── Region lon/lat centres (projected via geoNaturalEarth1) ─────────────────
const REGION_LONLAT = {
  UK: [-3, 54], EU: [10, 50], US: [-98, 38], AU: [134, -25],
  CA: [-96, 60], DE: [10, 51], FR: [2, 46], SE: [15, 62],
  IE: [-8, 53], NL: [5.3, 52.1], NZ: [172, -41], BE: [4, 50.8],
};

// ── Pixel nudges for the dense European cluster ───────────────────────────────
// At global scale, UK/EU/DE/NL/BE/IE/FR all project within ~30×17 viewBox px.
// These offsets spread dots into readable positions without distorting the map.
const REGION_NUDGE = {
  IE: [-30,   2],   // far west
  UK: [-14, -16],   // northwest
  NL: [  8, -18],   // north
  BE: [ -2,  14],   // south of center
  DE: [ 20,  -8],   // northeast
  EU: [ 28,  10],   // east (virtual label — sits outside the tight cluster)
  FR: [-10,  22],   // southwest
  SE: [  6, -22],   // high north
};

// ── Severity colour palette (mirrors import-legislation.js threat palette) ──
const SEV = {
  5: { border: 'border-red-500/70',    bg: 'bg-red-950/30',    text: 'text-red-400',    badge: 'bg-red-900/50 text-red-300 border border-red-700/50',    label: 'CRITICAL' },
  4: { border: 'border-orange-500/60', bg: 'bg-orange-950/20', text: 'text-orange-400', badge: 'bg-orange-900/40 text-orange-300 border border-orange-700/40', label: 'HIGH' },
  3: { border: 'border-yellow-500/50', bg: 'bg-yellow-950/15', text: 'text-yellow-400', badge: 'bg-yellow-900/30 text-yellow-300 border border-yellow-700/30', label: 'ELEVATED' },
  2: { border: 'border-cyan-500/50',   bg: 'bg-cyan-950/10',   text: 'text-cyan-400',   badge: 'bg-cyan-900/30 text-cyan-300 border border-cyan-700/30',     label: 'MODERATE' },
  1: { border: 'border-green-500/40',  bg: 'bg-green-950/10',  text: 'text-green-400',  badge: 'bg-green-900/20 text-green-300 border border-green-700/20',   label: 'LOW' },
};
const SEV_DEFAULT = {
  border: 'border-gray-700/50', bg: 'bg-gray-900/20', text: 'text-gray-400',
  badge: 'bg-gray-800/60 text-gray-400 border border-gray-600/30', label: 'UNKNOWN',
};

// Region codes match run_surveillance_index() region_code param in lib.rs
const REGIONS = [
  ['ALL', 'All Regions'],
  ['UK',  'United Kingdom'],
  ['EU',  'European Union'],
  ['US',  'United States'],
  ['AU',  'Australia'],
  ['CA',  'Canada'],
  ['DE',  'Germany'],
  ['FR',  'France'],
  ['SE',  'Sweden'],
  ['IE',  'Ireland'],
  ['NL',  'Netherlands'],
  ['NZ',  'New Zealand'],
  ['BE',  'Belgium'],
];

// Category codes match category_code param in lib.rs
const CATS = [
  ['ALL',                       'All Categories'],
  ['encryption_backdoor',       'Encryption Backdoor'],
  ['digital_id',                'Digital ID'],
  ['biometric_collection',      'Biometrics'],
  ['data_retention',            'Data Retention'],
  ['worker_surveillance',       'Worker Surveillance'],
  ['platform_mandated_scanning','Platform Scanning'],
  ['traffic_retention',         'Traffic Retention'],
  ['age_verification',          'Age Verification'],
];

// Parse categories field — can be an array or comma-separated string
const parseCats = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.length) return raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  return [];
};

// ── Raw hex colors for SVG threat dots ──────────────────────────────────────
const SEV_HEX = { 5: '#ef4444', 4: '#f97316', 3: '#eab308', 2: '#06b6d4', 1: '#22c55e' };

// ── Component ──────────────────────────────────────────────────────────────
const SurveillanceTab = ({ legislationArticles = [], onOpenLaw }) => {
  const [region,   setRegion]   = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [minSev,   setMinSev]   = useState(0);

  // ── Panopticon Index — Σ(sev²) / (n × 25) × 100 ─────────────────────────
  const panopticonIndex = useMemo(() => {
    if (!legislationArticles.length) return 0;
    const sum = legislationArticles.reduce((acc, a) => {
      const s = parseInt(a.severity, 10) || 0;
      return acc + s * s;
    }, 0);
    return Math.min(100, Math.round(sum / (legislationArticles.length * 25) * 100));
  }, [legislationArticles]);

  // ── Filtered + sorted law list ────────────────────────────────────────────
  const filtered = useMemo(() => {
    return legislationArticles
      .filter(a => {
        const sev = parseInt(a.severity, 10) || 0;
        if (sev < minSev) return false;
        if (region !== 'ALL') {
          const loc = (a.location || '').toUpperCase();
          // EU match: accept both "European Union" countries and "EU" label
          if (region === 'EU') {
            if (!loc.includes('EU') && !loc.includes('EUROPEAN')) return false;
          } else {
            if (!loc.toUpperCase().includes(region)) return false;
          }
        }
        if (category !== 'ALL') {
          if (!parseCats(a.categories).includes(category)) return false;
        }
        return true;
      })
      .sort((a, b) => (parseInt(b.severity, 10) || 0) - (parseInt(a.severity, 10) || 0));
  }, [legislationArticles, region, category, minSev]);

  // Quick-count stats
  const critCount  = legislationArticles.filter(a => parseInt(a.severity, 10) >= 5).length;
  const highCount  = legislationArticles.filter(a => parseInt(a.severity, 10) === 4).length;
  const filtersOn  = region !== 'ALL' || category !== 'ALL' || minSev > 0;
  const resetFilters = () => { setRegion('ALL'); setCategory('ALL'); setMinSev(0); };

  // ── Threat map: per-region max severity ───────────────────────────────────
  const regionThreats = useMemo(() => {
    const map = {};
    for (const a of legislationArticles) {
      const loc = (a.location || '').toUpperCase();
      const sev = parseInt(a.severity, 10) || 0;
      for (const [code] of REGIONS) {
        if (code === 'ALL') continue;
        const match = code === 'EU'
          ? (loc.includes('EU') || loc.includes('EUROPEAN'))
          : loc.includes(code);
        if (match) {
          map[code] = Math.max(map[code] || 0, sev);
        }
      }
    }
    return map;
  }, [legislationArticles]);

  return (
    <div className="tab-fade-v2 max-w-6xl mx-auto mt-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes sv-alertSnap {
          0%   { opacity: 0; transform: scale(1.08) translateX(-4px); filter: brightness(3) blur(2px); }
          20%  { opacity: 1; filter: brightness(2); }
          60%  { transform: scale(1.01) translateX(0); filter: brightness(1.3); }
          100% { opacity: 1; transform: scale(1); filter: brightness(1); }
        }
        @keyframes sv-iconSnap {
          0%   { opacity: 0; transform: scale(0.5) rotate(-15deg); filter: drop-shadow(0 0 32px #ef4444); }
          40%  { opacity: 1; transform: scale(1.15) rotate(3deg); filter: drop-shadow(0 0 20px #ef4444); }
          70%  { transform: scale(0.97) rotate(-1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0);   filter: drop-shadow(0 0 8px rgba(239,68,68,0.7)); }
        }
        @keyframes sv-iconIdlePulse {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(239,68,68,0.6)); }
          50%       { filter: drop-shadow(0 0 16px rgba(239,68,68,1)) drop-shadow(0 0 32px rgba(239,68,68,0.3)); }
        }
        @keyframes sv-subReveal {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes sv-scoreGlow {
          0%, 100% { text-shadow: 0 0 10px currentColor, 0 0 20px rgba(239,68,68,0.3); }
          50%       { text-shadow: 0 0 20px currentColor, 0 0 40px rgba(239,68,68,0.5), 0 0 60px rgba(239,68,68,0.15); }
        }
        @keyframes sv-critBorder {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50%       { box-shadow: 0 0 12px 2px rgba(239,68,68,0.2), inset 0 0 12px rgba(239,68,68,0.04); }
        }
        .sv-card-crit { animation: sv-critBorder 2.5s ease-in-out infinite; }
        .sv-card-crit:hover { box-shadow: 0 0 20px rgba(239,68,68,0.3) !important; }
        .sv-card:hover { box-shadow: 0 0 16px rgba(251,146,60,0.18); }
      `}</style>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-red-900/40 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <ShieldAlert
              className="w-8 h-8 shrink-0 text-red-400"
              style={{ animation: 'sv-iconSnap 0.5s cubic-bezier(0.16,1,0.3,1) forwards, sv-iconIdlePulse 3s ease-in-out 0.6s infinite' }}
            />
            <span
              className="text-transparent bg-clip-text uppercase"
              style={{
                backgroundImage: 'linear-gradient(90deg, #dc2626 0%, #ea580c 50%, #d97706 100%)',
                animation: 'sv-alertSnap 0.4s cubic-bezier(0.2,0,0.4,1) forwards',
              }}
            >PANOPTICON_INDEX</span>
          </h2>
          <div
            className="text-sm font-bold tracking-widest text-orange-400 uppercase"
            style={{ opacity: 0, animation: 'sv-subReveal 0.4s ease 0.35s forwards' }}
          >
            SURVEILLANCE LEGISLATION TRACKER // ACTIVE CORPUS
          </div>
        </div>
        {/* Live Panopticon score */}
        <div className="flex items-end gap-4">
          <div className="text-right">
            <div
              className="text-5xl font-bold font-mono tabular-nums"
              style={{
                color: panopticonIndex >= 80 ? '#f87171' : panopticonIndex >= 60 ? '#fb923c' : '#facc15',
                animation: legislationArticles.length ? 'sv-scoreGlow 2.5s ease-in-out infinite' : 'none',
              }}
            >
              {legislationArticles.length ? panopticonIndex : '—'}
            </div>
            <div className="text-[9px] tracking-widest text-orange-400/50 uppercase">/ 100 · Panopticon Index</div>
          </div>
          <div className="flex items-center gap-2 text-xs border border-red-500/30 px-3 py-1 bg-red-900/10 text-red-400 rounded-sm">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
            INDEXING ACTIVE
          </div>
        </div>
      </div>

      {/* ── Attribution banner ─────────────────────────────────────────────── */}
      <div className="mb-6 px-4 py-3 border border-orange-500/20 bg-orange-900/5 rounded-sm text-xs font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-orange-500">{'>_'}</span>
        <span className="text-orange-400/70">DATA SOURCE:</span>
        <span className="text-orange-300 font-bold tracking-widest">@grey-c0 / Navigators Guild</span>
        <span className="text-orange-400/30">—</span>
        <a
          href="https://github.com/grey-c0/legislation"
          target="_blank"
          rel="noreferrer"
          className="text-orange-400/60 hover:text-orange-300 transition-colors underline-offset-2 hover:underline"
        >
          grey-c0/legislation
        </a>
        <span className="text-orange-400/30">·</span>
        <a
          href="https://grey-c0.github.io/legislation/"
          target="_blank"
          rel="noreferrer"
          className="text-orange-400/60 hover:text-orange-300 transition-colors underline-offset-2 hover:underline"
        >
          grey-c0.github.io/legislation
        </a>
        <span className="text-orange-400/30 hidden md:inline">·</span>
        <span className="text-orange-400/50 hidden md:inline">Integrated via scale_9.4 CAS pipeline</span>
        <span className="ml-auto text-orange-400/50 tabular-nums font-bold">{legislationArticles.length} LAWS INDEXED</span>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Laws',    value: legislationArticles.length, color: 'text-orange-400' },
          { label: 'Critical 5/5', value: critCount,                  color: 'text-red-400'    },
          { label: 'High 4/5',     value: highCount,                  color: 'text-orange-300' },
          { label: 'In Filter',    value: filtered.length,            color: 'text-cyan-400'   },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-orange-900/30 bg-black/40 p-3 rounded-sm text-center">
            <div className={`text-2xl font-bold font-mono tabular-nums ${color}`}>{value}</div>
            <div className="text-[9px] tracking-widest text-orange-400/40 uppercase mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Threat map SVG ─────────────────────────────────────────────────── */}
      {legislationArticles.length > 0 && (
        <div className="mb-6 border border-orange-900/20 bg-black/30 rounded-sm p-3 overflow-hidden">
          <div className="text-[9px] font-mono tracking-widest text-orange-400/40 uppercase mb-2 flex items-center gap-2">
            <Globe className="w-2.5 h-2.5" /> THREAT DISTRIBUTION MAP
          </div>
          <WorldMap palette="orange" height={200} scanDur={6}>
            {Object.entries(regionThreats).map(([code, maxSev]) => {
              const lonlat = REGION_LONLAT[code];
              if (!lonlat) return null;
              const [bx, by] = toMapXY(lonlat[0], lonlat[1]);
              const nudge   = REGION_NUDGE[code] || [0, 0];
              const cx = bx + nudge[0];
              const cy = by + nudge[1];
              const r     = 4 + maxSev * 2;
              const color = SEV_HEX[maxSev] || '#6b7280';
              return (
                <g key={code}>
                  {/* Leader line from nudged dot back to true geographic position */}
                  {(nudge[0] !== 0 || nudge[1] !== 0) && (
                    <line x1={bx} y1={by} x2={cx} y2={cy}
                      stroke={color} strokeWidth="0.6" strokeDasharray="2,2" opacity="0.3" />
                  )}
                  <circle cx={cx} cy={cy} r={r + 4} fill={color} opacity="0.15">
                    <animate attributeName="r" values={`${r + 2};${r + 8};${r + 2}`} dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={cx} cy={cy} r={r} fill={color} opacity="0.85">
                    <animate attributeName="r" values={`${r};${r + 2};${r}`} dur="2.5s" repeatCount="indefinite" />
                  </circle>
                  <text x={cx} y={cy + r + 11} textAnchor="middle" fill={color} fontSize="9" fontFamily="monospace" opacity="0.6">
                    {code}
                  </text>
                </g>
              );
            })}
          </WorldMap>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 border border-orange-900/20 bg-black/30 rounded-sm items-end">
        {/* Region select */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold tracking-widest text-orange-400/50 uppercase flex items-center gap-1">
            <Globe className="w-2.5 h-2.5" /> Region
          </label>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="bg-black/60 border border-orange-500/30 text-orange-300 text-xs font-mono px-2 py-1.5 rounded-sm focus:outline-none focus:border-orange-400 cursor-pointer"
          >
            {REGIONS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
          </select>
        </div>

        {/* Category select */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold tracking-widest text-orange-400/50 uppercase flex items-center gap-1">
            <Filter className="w-2.5 h-2.5" /> Category
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-black/60 border border-orange-500/30 text-orange-300 text-xs font-mono px-2 py-1.5 rounded-sm focus:outline-none focus:border-orange-400 cursor-pointer"
          >
            {CATS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
          </select>
        </div>

        {/* Severity slider */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold tracking-widest text-orange-400/50 uppercase flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" /> Min Severity &nbsp;
            <span className="text-orange-300">{minSev}/5</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range" min={0} max={5} step={1} value={minSev}
              onChange={e => setMinSev(Number(e.target.value))}
              className="w-28 accent-orange-500 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-orange-400/60">
              {['ALL', '1', '2', '3', '4', 'CRIT'][minSev]}
            </span>
          </div>
        </div>

        {/* Reset button */}
        {filtersOn && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-orange-400/50 hover:text-orange-300 border border-orange-900/30 px-2 py-1.5 rounded-sm transition-colors uppercase self-end"
          >
            <X className="w-2.5 h-2.5" /> RESET
          </button>
        )}

        <div className="ml-auto text-[10px] text-orange-400/30 font-mono self-end tabular-nums">
          {filtered.length} / {legislationArticles.length} laws
        </div>
      </div>

      {/* ── WASM kernel hint ──────────────────────────────────────────────── */}
      <div className="mb-5 px-3 py-2 border border-orange-900/20 bg-black/20 rounded-sm flex flex-wrap items-center gap-3 text-[10px] font-mono text-orange-400/50">
        <Activity className="w-3 h-3 text-orange-500/60 shrink-0" />
        <span>WASM KERNEL:</span>
        <span className="text-orange-400/70 font-bold">run surveillance</span>
        <span className="text-orange-400/30">·</span>
        <span className="text-orange-400/60">run surveillance --region 1</span>
        <span className="text-orange-400/30 hidden md:inline">·</span>
        <span className="text-orange-400/60 hidden md:inline">run surveillance --category 1 --threshold 4</span>
        <span className="ml-auto text-orange-400/30">SURVEILLANCE-INDEX-1.0</span>
      </div>

      {/* ── Law cards grid ────────────────────────────────────────────────── */}
      {!legislationArticles.length ? (
        <div className="py-20 text-center font-mono text-orange-400/30 text-sm tracking-widest animate-pulse">
          INDEXING LEGISLATION CORPUS...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center font-mono text-orange-400/30 text-sm tracking-widest">
          NO LAWS MATCH CURRENT FILTERS
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {filtered.map(law => {
            const sev   = parseInt(law.severity, 10) || 0;
            const style = SEV[sev] || SEV_DEFAULT;
            const cats  = parseCats(law.categories);
            const title = (law.title || law.id || '').toUpperCase();

            return (
              <div
                key={law.id}
                onClick={() => onOpenLaw && onOpenLaw(law)}
                className={`border ${style.border} ${style.bg} p-4 rounded-sm cursor-pointer group transition-all duration-200 hover:brightness-115 ${sev >= 5 ? 'sv-card-crit' : 'sv-card'}`}
              >
                {/* Severity badge + location */}
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className={`text-[8px] font-bold tracking-widest px-2 py-0.5 rounded-sm ${style.badge}`}>
                    {sev > 0 ? `${sev}/5` : '?'} · {style.label}
                  </span>
                  <span className="text-[9px] text-orange-400/40 font-mono truncate max-w-[120px]" title={law.location}>
                    {(law.location || '').toUpperCase()}
                  </span>
                </div>

                {/* Law title */}
                <div className={`font-bold text-sm mb-1 ${style.text} leading-snug break-words line-clamp-2`}>
                  {title}
                </div>

                {/* Legal name (subtitle) */}
                {law.legalName && (
                  <div className="text-[9px] text-orange-400/40 font-mono mb-2 leading-snug break-words line-clamp-1">
                    {law.legalName}
                  </div>
                )}

                {/* Category chips */}
                {cats.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {cats.slice(0, 3).map(c => (
                      <span
                        key={c}
                        className="text-[7px] bg-black/40 border border-orange-900/30 text-orange-400/50 px-1.5 py-0.5 rounded font-mono"
                      >
                        {c.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {cats.length > 3 && (
                      <span className="text-[7px] text-orange-400/30 px-1 py-0.5 font-mono">
                        +{cats.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Read CTA */}
                <div className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-orange-400/40 group-hover:text-orange-300 transition-colors uppercase">
                  <ChevronRight className="w-3 h-3" />
                  READ LEGISLATION
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer credit ─────────────────────────────────────────────────── */}
      <div className="border-t border-orange-900/20 pt-6 pb-8 text-center">
        <div className="text-[10px] font-mono text-orange-400/30 tracking-widest mb-1">
          SURVEILLANCE DATA © @grey-c0 / NAVIGATORS GUILD · INTEGRATED VIA SCALE_9.4 CAS PIPELINE
        </div>
        <div className="text-[9px] font-mono text-orange-400/20">
          <a href="https://github.com/grey-c0/legislation" target="_blank" rel="noreferrer"
            className="hover:text-orange-400/50 transition-colors">
            github.com/grey-c0/legislation
          </a>
          {' · '}
          <a href="https://grey-c0.github.io/legislation/" target="_blank" rel="noreferrer"
            className="hover:text-orange-400/50 transition-colors">
            grey-c0.github.io/legislation
          </a>
          {' '} · PANOPTICON INDEX: Σ(sev²) / (n × 25) × 100
        </div>
      </div>
    </div>
  );
};

export default React.memo(SurveillanceTab);

// EcocideTab.jsx — SOMA-9.4 // ECOCIDE PROTOCOL
// Ecological kernel index — biocoenosis · atmospheric entropy · thermodynamic law
import React, { useState, useMemo } from 'react';
import { Leaf, Activity, AlertTriangle, Filter, ChevronRight, X } from 'lucide-react';

// Tags that qualify an article as ecological / ecocide-relevant
const ECO_TAGS = new Set([
  'Botany','Ecology','Autochthony','Lizard Gap','Biodiversity','Atmospheric',
  'Climate','Thermodynamic','Entropy','Ecological','Biocoenosis','Biology',
  'Sustainability','Ecocide','ecological','biodiversity','atmospheric',
]);

const THREAT_LEVELS = [
  { id: 'ALL',      label: 'All Levels' },
  { id: 'CRITICAL', label: 'Critical',  style: 'text-red-400'    },
  { id: 'HIGH',     label: 'High',      style: 'text-orange-400' },
  { id: 'ELEVATED', label: 'Elevated',  style: 'text-yellow-400' },
  { id: 'ACTIVE',   label: 'Active',    style: 'text-lime-400'   },
];

const ECO_KERNELS = [
  { id: 'BIOCOENOSIS',  label: 'biocoenosis_kernel', status: 'ACTIVE',   color: '#39ff14', desc: 'High-density biodiversity · autochthonous species architecture' },
  { id: 'ATMOSPHERIC',  label: 'atmospheric_entropy', status: 'ACTIVE',   color: '#06b6d4', desc: 'Thermosphere protocol · planetary boundary tracking' },
  { id: 'DALY',         label: 'daly_thermo',         status: 'ACTIVE',   color: '#FFD700', desc: 'Hard constraints engine · soma_kernel_5.5 compliance' },
  { id: 'GRAYSCOTT',    label: 'gray_scott_rd',       status: 'ACTIVE',   color: '#d946ef', desc: 'Reaction-diffusion · spatial pattern formation' },
  { id: 'BIODIVERSITY', label: 'biodiversity_1.0.1',  status: 'INDEXED',  color: '#7ab800', desc: 'Species distribution · ecological network topology' },
];

const isEcoArticle = (a) => {
  if (!a?.tags) return false;
  return a.tags.some(t => ECO_TAGS.has(t));
};

// ── Component ──────────────────────────────────────────────────────────────
const EcocideTab = ({ articles = [], onOpenArticle }) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const ecoArticles = useMemo(() => {
    let list = articles.filter(isEcoArticle);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        (a.title   || '').toLowerCase().includes(q) ||
        (a.subtitle|| '').toLowerCase().includes(q) ||
        (a.tags    || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [articles, search]);

  // Bio-index: proportion of articles with ecological framing
  const bioIndex = articles.length
    ? Math.round((ecoArticles.length / articles.length) * 100)
    : 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <style>{`
        @keyframes ec-reveal {
          0%   { opacity: 0; filter: brightness(3) blur(6px); letter-spacing: 0.4em; }
          40%  { opacity: 1; filter: brightness(1.8) blur(1px); letter-spacing: 0.1em; }
          100% { opacity: 1; filter: brightness(1) blur(0px); letter-spacing: normal; }
        }
        @keyframes ec-shimmer {
          0%,100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        @keyframes ec-leafSpin {
          0%   { opacity: 0; transform: rotate(-60deg) scale(0.4); filter: drop-shadow(0 0 18px #39ff14); }
          100% { opacity: 1; transform: rotate(0deg)  scale(1);   filter: drop-shadow(0 0 7px rgba(57,255,20,0.55)); }
        }
        @keyframes ec-leafGlow {
          0%,100% { filter: drop-shadow(0 0 4px rgba(57,255,20,0.4)); }
          50%      { filter: drop-shadow(0 0 12px rgba(57,255,20,1)) drop-shadow(0 0 24px rgba(122,184,0,0.4)); }
        }
        @keyframes ec-pulse {
          0%,100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes ec-kernelIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b pb-4 mb-8" style={{ borderColor: 'rgba(122,184,0,0.3)' }}>
        <div>
          <h2 className="text-2xl md:text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <Leaf
              className="w-6 h-6 md:w-8 md:h-8 shrink-0"
              style={{
                color: '#7ab800',
                animation: 'ec-leafSpin 0.9s cubic-bezier(0.16,1,0.3,1) forwards, ec-leafGlow 4s ease-in-out 1s infinite',
              }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #39ff14, #7ab800, #06b6d4, #7ab800, #39ff14)',
                backgroundSize: '300% auto',
                animation: 'ec-reveal 1s cubic-bezier(0.16,1,0.3,1) forwards, ec-shimmer 4s ease-in-out 1s infinite',
              }}
            >ecocide_protocol</span>
          </h2>
          <div className="text-sm font-bold tracking-widest" style={{ color: 'rgba(122,184,0,0.55)' }}>
            biocoenosis · atmospheric entropy · thermodynamic law // soma-9.4
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 md:mt-0 text-xs font-bold font-mono tracking-widest flex-wrap">
          <span className="border px-3 py-1 rounded-sm flex items-center gap-1.5"
            style={{ borderColor: 'rgba(57,255,20,0.3)', color: 'rgba(57,255,20,0.7)', background: 'rgba(57,255,20,0.04)' }}>
            <Activity className="w-3 h-3" />
            bio_index: {bioIndex}%
          </span>
          <span className="border px-3 py-1 rounded-sm"
            style={{ borderColor: 'rgba(122,184,0,0.25)', color: 'rgba(122,184,0,0.5)' }}>
            {ecoArticles.length} eco-kernels indexed
          </span>
        </div>
      </div>

      {/* ── Active Eco-Kernels ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="text-xs font-bold tracking-widest mb-3 uppercase" style={{ color: 'rgba(57,255,20,0.45)' }}>
          // active_eco_kernels
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ECO_KERNELS.map((k, i) => (
            <div
              key={k.id}
              className="border rounded-lg px-4 py-3 flex items-center gap-3 group"
              style={{
                borderColor: `${k.color}22`,
                background: `${k.color}08`,
                animation: `ec-kernelIn 0.3s ease-out ${i * 60}ms both`,
              }}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: k.color, boxShadow: `0 0 6px ${k.color}` }} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold font-mono truncate" style={{ color: k.color }}>{k.label}</div>
                <div className="text-xs text-gray-500 truncate mt-0.5">{k.desc}</div>
              </div>
              <span className="text-xs font-bold shrink-0" style={{ color: `${k.color}88` }}>{k.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Search + Filter ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'rgba(122,184,0,0.5)' }} />
          <input
            type="text"
            placeholder="search eco-kernels..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/60 border rounded-sm pl-8 pr-8 py-2 text-xs font-mono text-lime-300 placeholder-lime-900/60 outline-none focus:border-lime-500/50 transition-colors"
            style={{ borderColor: 'rgba(122,184,0,0.25)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3" style={{ color: 'rgba(122,184,0,0.5)' }} />
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {THREAT_LEVELS.map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className="px-3 py-1.5 text-xs font-bold rounded-sm border transition-all"
              style={filter === t.id
                ? { background: 'rgba(57,255,20,0.12)', borderColor: 'rgba(57,255,20,0.5)', color: '#39ff14' }
                : { background: 'transparent', borderColor: 'rgba(122,184,0,0.2)', color: 'rgba(122,184,0,0.5)' }
              }
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Article List ──────────────────────────────────────────────────── */}
      {ecoArticles.length > 0 ? (
        <div className="space-y-3">
          {ecoArticles.map((article, i) => (
            <div
              key={article.id}
              onClick={() => onOpenArticle?.(article)}
              className="border rounded-lg p-4 cursor-pointer group transition-all hover:border-lime-500/40"
              style={{
                borderColor: 'rgba(122,184,0,0.2)',
                background: 'rgba(57,255,20,0.02)',
                animation: `ec-kernelIn 0.25s ease-out ${i * 35}ms both`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-xs font-bold font-mono" style={{ color: 'rgba(57,255,20,0.5)' }}>
                      {article.date || '—'}
                    </span>
                    {article.status && (
                      <span className="text-xs font-bold border px-2 py-0.5 rounded-sm"
                        style={{ borderColor: 'rgba(122,184,0,0.3)', color: 'rgba(122,184,0,0.7)', background: 'rgba(57,255,20,0.04)' }}>
                        {article.status}
                      </span>
                    )}
                    {article.readTime && (
                      <span className="text-xs" style={{ color: 'rgba(122,184,0,0.35)' }}>{article.readTime}</span>
                    )}
                  </div>
                  <div className="font-bold text-sm mb-0.5 group-hover:text-lime-300 transition-colors" style={{ color: '#7ab800' }}>
                    {article.title || article.id}
                  </div>
                  {article.subtitle && (
                    <div className="text-xs mb-2" style={{ color: 'rgba(122,184,0,0.5)' }}>{article.subtitle}</div>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    {(article.tags || []).filter(t => ECO_TAGS.has(t)).map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-sm border font-mono"
                        style={{ borderColor: 'rgba(57,255,20,0.25)', color: 'rgba(57,255,20,0.6)', background: 'rgba(57,255,20,0.05)' }}
                      >{tag}</span>
                    ))}
                    {(article.tags || []).filter(t => !ECO_TAGS.has(t)).slice(0, 2).map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-sm border font-mono"
                        style={{ borderColor: 'rgba(122,184,0,0.15)', color: 'rgba(122,184,0,0.35)', background: 'transparent' }}
                      >{tag}</span>
                    ))}
                  </div>
                </div>
                <ChevronRight
                  className="w-4 h-4 shrink-0 mt-1 group-hover:translate-x-1 transition-transform"
                  style={{ color: 'rgba(57,255,20,0.4)' }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg p-12 text-center" style={{ borderColor: 'rgba(122,184,0,0.15)', background: 'rgba(57,255,20,0.02)' }}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(122,184,0,0.3)', animation: 'ec-pulse 2s ease-in-out infinite' }} />
          <div className="text-sm font-mono" style={{ color: 'rgba(122,184,0,0.4)' }}>
            {search ? `no eco-kernels matching "${search}"` : '// no ecological kernels indexed'}
          </div>
          <div className="text-xs mt-1" style={{ color: 'rgba(122,184,0,0.25)' }}>
            run biocoenosis_kernel to populate the index
          </div>
        </div>
      )}
    </div>
  );
};

export default EcocideTab;

// ─── ALL STATIC IMPORTS MUST APPEAR BEFORE ANY EXECUTABLE CODE ──────────────
// ES module spec §15.2.2: ImportDeclaration cannot follow a Statement.
// Rollup (Vite prod bundler) hoists these, but bundler behaviour diverges from
// esbuild (Vite dev). Keep all imports at the top to guarantee identical
// module evaluation order in both environments.
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, lazy, Suspense } from 'react';

// Locale-independent HH:MM:SS — toLocaleTimeString strips hours on some mobile browsers
const fmtTime = (d = new Date()) =>
  `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;

import { Hexagon, Cpu, Lock, Scale, Eye, ShieldAlert, KeyRound, Waves, Radio, Leaf, Moon } from 'lucide-react';
import AmbientParticles from './components/AmbientParticles';

// Data — static (authored, always bundled)
import kernelBuilds    from './data/kernelBuilds';
import kernelAxioms    from './data/kernelAxioms';       // the 7 axiomatic_core laws
import _somaArticles   from './data/articles.soma';   // hand-curated soma kernel entries
import _miscArticles   from './data/articles.misc';   // hand-curated misc/fiction entries
import autoArticles    from './data/loadArticles';    // Vite glob .md stubs (dev fallback)
import wasmRegistry    from '../wasm/wasm.generated';  // compiled Rust kernel WASM module map — 21 kernels
import { resolveWasmAlias } from './data/mobileWasmMap';
// Data — dynamic (CAS fetch at boot; _generated, _academic, tagIndex, systemArticles
// are no longer static imports — they arrive via /kernel/manifest.json fetch)

const staticArticles = [..._somaArticles, ..._miscArticles];
const staticIds      = new Set(staticArticles.map(a => a.id));

// Mirror of chunkFileName() in import-kernel.js — must stay in sync.
// Converts an article ID to its CAS chunk filename: replaces unsafe chars with '_'.
function chunkFileName(id) {
  return id.replace(/[^a-zA-Z0-9\-._]/g, '_');
}

// Components
import OctagonGrid          from './components/OctagonGrid';
import { WasmErrorBoundary } from './components/WasmErrorBoundary';
import BootSequence         from './components/BootSequence';
import BreachProtocol       from './components/BreachProtocol';
import SanctuaryOverlay     from './components/SanctuaryOverlay';
import MercuryEyeIndicator  from './components/MercuryEyeIndicator';
import KuramotoVisualizer   from './components/KuramotoVisualizer';
import { emit as emitObs } from '../observatory/observatoryBus';
import { notifyNav, getGuidance as getEyeGuidance, subscribeGuidance } from './quintessence/guidanceStore';
import { getSpine as getSpineSnap, subscribeSpine as subscribeSpineSnap } from './quintessence/spineStore';
import { pulseTabFor } from './components/resolveEyeState';

// Hooks
import useSystemLog           from './hooks/useSystemLog';
import { useCommandDispatch } from './hooks/useCommandDispatch';
import { useAutocomplete }    from './hooks/useAutocomplete';
import { useEcologicalRam }   from './hooks/useEcologicalRam';
import { getVerdictCount }    from './ledger/verdictStore';
import { normalizeQuery }     from '../lib/normalize';
import { setPanopticonCorpus } from './lib/panopticon';

// KernelTab — static import (landing tab, always needed, avoids .df.js chunk on Firefox Android)
import KernelTab from './views/KernelTab';

// Views — lazy-loaded so each tab bundle is only fetched when first visited
const ScalingTab       = lazy(() => import('./views/ScalingTab'));
const ManifestoTab     = lazy(() => import('./views/ManifestoTab'));
const PrivacyTab       = lazy(() => import('./views/PrivacyTab'));
const SurveillanceTab  = lazy(() => import('./views/SurveillanceTab'));
const BskyTab          = lazy(() => import('./views/BskyTab'));
const EcocideTab       = lazy(() => import('./views/EcocideTab'));
// ButterflyIcon — inline nav variant (matches BskyTab icon, no extra import needed)
const NavButterflyIcon = ({ size = 'sm' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={size === 'lg' ? 'w-5 h-5' : 'w-3 h-3'} aria-hidden="true">
    <path d="M11.5 11C9.5 9.5 5.5 7 2.5 8.5C0.5 9.5 1 12 4 13C6.5 13.8 9.5 13 11.5 11Z" />
    <path d="M12.5 11C14.5 9.5 18.5 7 21.5 8.5C23.5 9.5 23 12 20 13C17.5 13.8 14.5 13 12.5 11Z" />
    <path d="M11.5 13.5C9 14 4 15 3 18C2.5 19.5 4.5 21 7.5 19.5C9.5 18.5 11 16.5 11.5 13.5Z" />
    <path d="M12.5 13.5C15 14 20 15 21 18C21.5 19.5 19.5 21 16.5 19.5C14.5 18.5 13 16.5 12.5 13.5Z" />
    <ellipse cx="12" cy="12.5" rx="0.9" ry="3.5" />
  </svg>
);
const ClassifiedTab   = lazy(() => import('./views/ClassifiedTab'));
const ArtTab          = lazy(() => import('./views/ArtTab'));
const ArticleView     = lazy(() => import('./views/ArticleView'));
const ThesisView      = lazy(() => import('./views/ThesisView'));
const TransmissionTab = lazy(() => import('./views/TransmissionTab'));
const TagCloudView    = lazy(() => import('./views/TagCloudView'));
const LunarTab        = lazy(() => import('./views/LunarTab'));
const LedgerTab       = lazy(() => import('./views/LedgerTab'));
const KineticStatecraftPanel = lazy(() => import('./views/KineticStatecraftPanel'));
const DalySimPanel           = lazy(() => import('./views/DalySimPanel'));
const MercuryTab      = lazy(() => import('./views/MercuryTab'));

// formatKernelHelp, formatRunHelp, CMD_MANIFEST → src/terminal/commands/runHelpers.js

// ── Polarity ambient glow — color map for terminal background overlay ─────────
const POLARITY_GLOW = {
  SOLAR:    'rgba(255,215,0,0.13)',
  LUNAR:    'rgba(196,181,255,0.12)',
  MERIDIAN: 'rgba(6,182,212,0.10)',
  CHAOTIC:  'rgba(255,40,80,0.14)',
};

const App = () => {
  const [currentPath, setCurrentPath] = useState('~/system/kernel');
  const [activeTab, setActiveTab] = useState('kernel');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [bootSequence, setBootSequence] = useState(true);
  const [bootRevealed, setBootRevealed] = useState(false);
  const [bootAnimDone, setBootAnimDone]  = useState(false);
  // Classified enclave session state
  // null → locked  |  { status:'pending' }  |  { status:'challenged', ... }  |  { status:'unlocked', ... }
  const [classifiedSession, setClassifiedSession] = useState(null);
  const [commandInput, setCommandInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingKernel,  setLoadingKernel]  = useState(null);
  const [loadingSignal,  setLoadingSignal]  = useState(null);
  const [tabGlitch, setTabGlitch] = useState(false);
  const [originTab, setOriginTab] = useState('kernel');
  const [architectThesis, setArchitectThesis] = useState(false);
  const [tagCloudView,    setTagCloudView]    = useState(false);
  const [suggestions, setSuggestions]   = useState([]);
  const [activeSugg,   setActiveSugg]   = useState(-1);
  const [paramHint,    setParamHint]    = useState('');
  const [cmdHistory,   setCmdHistory]   = useState([]);   // most-recent first
  const [historyIdx,   setHistoryIdx]   = useState(-1);   // -1 = live input
  const [savedInput,   setSavedInput]   = useState('');
  const [isOnline,     setIsOnline]     = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  // Breach Protocol minigame
  const [breachOpen,   setBreachOpen]   = useState(false);
  // Sanctuary — Period-3 window · hidden command + lattice-floor offer
  const [sanctuaryOpen, setSanctuaryOpen] = useState(false);
  // Kuramoto live visual field — null when inactive, { active, n, k, sigma } when running
  const [kuramotoViz,     setKuramotoViz]     = useState(null);
  // Associative field attractor — null when inactive, { act, energy, seed, co } when computed
  const [associativeField, setAssociativeField] = useState(null);
  // Spectral bridges — null when inactive, { bridges, drivers, threshold } when computed
  const [spectralBridges, setSpectralBridges] = useState(null);
  // Bone fusions — null when inactive, { fusions, phase, order, peak, threshold } when computed
  const [boneFusions, setBoneFusions] = useState(null);
  const [fusionLog, setFusionLog] = useState([]);   // run <nodeA> <nodeB> history
  // Manual fusions — operator-forged edges via right-click / long-press in /art
  const [manualFusions, setManualFusions] = useState([]);
  // Orthogonal bridges — engine-forged divergent links from DIVERGENCE_ENGINE
  const [orthogonalBridges, setOrthogonalBridges] = useState([]);
  // Enclave keys — { ek, dk } hex strings from keygen, null until generated
  const [enclaveKeys, setEnclaveKeys] = useState(null);
  // Probe node — { query, probeVector, similarities } from text_probe kernel, null until run
  const [probeNode, setProbeNode] = useState(null);
  // Relic malfunction mode — amplifies glitch, streams hex to log
  const [relicMode,    setRelicMode]    = useState(false);
  // Global cross-tab article search overlay (⌘K / Ctrl+K)
  const [globalSearchOpen,  setGlobalSearchOpen]  = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResultIdx,   setSearchResultIdx]   = useState(-1);
  // g-leader nav mode (vim-style, Colemak-DH optimised)
  const [gMode, setGMode] = useState(false);
  const gModeTimerRef = useRef(null);
  // CAS dynamic data — null while manifest fetch is in-flight
  const [dynamicData,  setDynamicData]  = useState(null);
  // Mobile chrome visibility — fades out after 3s of no touch, fades in on touch
  const [mobileChrome, setMobileChrome] = useState(true);
  const { appendSystemLog, setSystemLogs, visibleLogs, logRef } = useSystemLog();
  // RAM — ecological entropy model §1.3: cost maps to planetary footprint
  const { ramPct, ecoCost, applyEcoCost, applyRefill, latticeState, isCritical, isWarning, isRefillReady } = useEcologicalRam({ appendSystemLog });

  // ── CAS dynamic data derivation ──────────────────────────────────────────────
  // Merge priority (highest → lowest):
  //   1. staticArticles    — hand-curated soma + misc (source of truth for IDs)
  //   2. generatedArticles — from manifest fetch; each entry carries loadContent
  //   3. autoArticles      — Vite glob stubs; fallback when no generated entry exists
  //   4. academicArticles  — PHD corpus (PHD-prefixed IDs, zero collision risk)
  // All three useMemos depend directly on `dynamicData` to avoid unstable
  // intermediate references (e.g. `?? []` creates a new array on every render).
  const articles = useMemo(() => {
    const generated   = dynamicData?.generatedArticles   ?? [];
    const academic    = dynamicData?.academicArticles    ?? [];
    const legislation = dynamicData?.legislationArticles ?? [];
    const genIds      = new Set(generated.map(a => a.id));
    return [
      ...staticArticles,
      ...generated.filter(a => !staticIds.has(a.id)),
      ...autoArticles.filter(a => !staticIds.has(a.id) && !genIds.has(a.id)),
      ...academic,
      ...legislation,
    ];
  }, [dynamicData]);

  const tagIndex     = useMemo(() => dynamicData?.tagIndex      ?? {}, [dynamicData]);
  const systemArticles = dynamicData?.systemArticles ?? {};

  // Memoized global search results — avoids re-filtering the full article corpus on every keystroke render
  const globalSearchResults = useMemo(() => {
    const q = globalSearchQuery.trim();
    if (!q) return null;
    const nq = normalizeQuery(q);
    const tokens = nq.split(' ');
    return articles.filter(a => {
      const hay = normalizeQuery([a.title ?? a.id, a.id, ...(a.tags ?? [])].join(' '));
      return tokens.every(t => hay.includes(t));
    }).slice(0, 10);
  }, [globalSearchQuery, articles]);

  // ── Manifest bootstrap ────────────────────────────────────────────────────────
  // Fetch /kernel/manifest.json on mount, then parallel-fetch all hashed datasets.
  // All outputs are pure JSON — no module evaluation, cache-first in the SW.
  useEffect(() => {
    (async () => {
      const now = fmtTime();
      try {
        appendSystemLog({ time: now, msg: 'SYSTEM_KERNEL_LOG: Fetching kernel manifest...' });
        const manifest = await fetch('/kernel/manifest.json?_=' + Date.now()).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        });

        const [kernelsJson, academicJson, tagsJson, systemJson, legislationJson] = await Promise.all([
          manifest.kernels      ? fetch(`/kernel/${manifest.kernels}`).then(r      => r.json()) : Promise.resolve([]),
          manifest.academic     ? fetch(`/kernel/${manifest.academic}`).then(r     => r.json()) : Promise.resolve([]),
          manifest.tags         ? fetch(`/kernel/${manifest.tags}`).then(r         => r.json()) : Promise.resolve({}),
          manifest.system       ? fetch(`/kernel/${manifest.system}`).then(r       => r.json()) : Promise.resolve({}),
          manifest.legislation  ? fetch(`/kernel/${manifest.legislation}`).then(r  => r.json()) : Promise.resolve([]),
        ]);

        // Create fetch-based loadContent for each article (replaces dynamic import())
        const makeLoadContent = (meta) => async () => {
          const r = await fetch(`/kernel/chunks/${chunkFileName(meta.id)}.json`);
          if (!r.ok) throw new Error(`Chunk not found: ${meta.id}`);
          const chunk = await r.json();
          return { ...meta, ...chunk };
        };

        const generatedArticles   = Array.isArray(kernelsJson)     ? kernelsJson.map(a     => ({ ...a, loadContent: makeLoadContent(a) })) : [];
        const academicArticles    = Array.isArray(academicJson)    ? academicJson.map(a    => ({ ...a, loadContent: makeLoadContent(a) })) : [];
        const legislationArticles = Array.isArray(legislationJson) ? legislationJson.map(a => ({ ...a, loadContent: makeLoadContent(a) })) : [];

        const laterTime = fmtTime();
        appendSystemLog({ time: laterTime, msg: `SYSTEM_KERNEL_LOG: Manifest loaded // ${manifest.generated ?? 'no timestamp'}` });
        appendSystemLog({ time: laterTime, msg: `SYSTEM_KERNEL_LOG: ${generatedArticles.length} kernels // ${academicArticles.length} academic // ${legislationArticles.length} legislation // tags index ready` });

        setDynamicData({ generatedArticles, academicArticles, legislationArticles, tagIndex: tagsJson, systemArticles: systemJson, manifest });

        // Register the legislation corpus with the shared panopticon module —
        // SurveillanceTab, PrivacyTab, and the sovereignty assessment all read
        // this single score (spec §1). Until this line runs, index is null
        // (degraded mode: compiles seal without assessment).
        setPanopticonCorpus(legislationArticles);

        // ── WASM integrity check ─────────────────────────────────────────────
        // Fetch the WASM binary and verify its SHA-256 against the manifest entry.
        // Use the same ?v=<hash[:8]> cache-buster that wasm.generated.js uses so
        // the browser never serves a stale binary from its HTTP cache after a build.
        if (manifest.bosonic_lattice?.sha256 && typeof crypto?.subtle?.digest === 'function') {
          try {
            const sha8    = manifest.bosonic_lattice.sha256.slice(0, 8);
            const wasmBuf = await fetch(`/wasm/scale94_kernels_bg.wasm?v=${sha8}`).then(r => r.arrayBuffer());
            const hashBuf = await crypto.subtle.digest('SHA-256', wasmBuf);
            const hex     = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            const vt      = fmtTime();
            if (hex === manifest.bosonic_lattice.sha256) {
              appendSystemLog({ time: vt, msg: `WASM_INTEGRITY: OK // SHA-256 verified`, rust: true });
            } else {
              appendSystemLog({ time: vt, msg: `WASM_INTEGRITY: MISMATCH // expected ${manifest.bosonic_lattice.sha256.slice(0,12)}… got ${hex.slice(0,12)}…` });
            }
          } catch { /* non-fatal — validation best-effort */ }
        }
        getVerdictCount().then(count => {
          if (count > 0) {
            appendSystemLog({ time: fmtTime(), msg: `  OPEN LEDGER: ${count} verdict${count !== 1 ? 's' : ''} in archive`, rust: true });
          }
        });
      } catch (err) {
        console.warn('[KERNEL_LOG] Manifest fetch failed:', err.message);
        const laterTime = fmtTime();
        appendSystemLog({ time: laterTime, msg: 'SYSTEM_KERNEL_LOG: WARNING — manifest unavailable // degraded mode' });
        appendSystemLog({ time: laterTime, msg: '  Kernel registry operating from local cache.' });
        setDynamicData({ generatedArticles: [], academicArticles: [], legislationArticles: [], tagIndex: {}, systemArticles: {}, manifest: {} });
      }
    })();
  }, [appendSystemLog]);

  const mainRef = useRef(null);
  const mobileChromeTimerRef = useRef(null);
  const terminalInputRef = useRef(null);  // ref to the footer terminal input
  // Abort token for handleKernelClick — invalidates in-flight loads when a
  // new one is started (e.g. user rapidly clicks two kernels in quick succession).
  const loadAbortRef = useRef(null);
  // Kernel run history — per-page-load, fed to the alien verdict on Crystallize order.
  // Each entry: { id: string, alias: string, t: number (epoch ms) }
  const kernelRunHistoryRef = useRef([]);
  const [lastKernelAt, setLastKernelAt] = useState(null);
  const [lastPolarityClass, setLastPolarityClass] = useState(null);
  const [lastLoadAt, setLastLoadAt] = useState(null);
  // Persistent WASM struct instances — keyed by wasmEntry.id.
  const activeKernels = useRef({});

  // Mobile chrome auto-hide:
  //   touchstart  → show immediately, cancel any pending hide
  //   touchend / touchcancel → start 3s countdown, then hide
  //   boot complete → start 3s countdown (chrome stays visible during boot)
  const showMobileChrome = useCallback(() => {
    setMobileChrome(true);
    if (mobileChromeTimerRef.current) clearTimeout(mobileChromeTimerRef.current);
  }, []);
  const hideMobileChromeAfterDelay = useCallback(() => {
    if (mobileChromeTimerRef.current) clearTimeout(mobileChromeTimerRef.current);
    mobileChromeTimerRef.current = setTimeout(() => setMobileChrome(false), 3000);
  }, []);
  // Start hide timer after boot completes (not on mount — chrome visible during 5s boot)
  useEffect(() => {
    if (!bootSequence) {
      mobileChromeTimerRef.current = setTimeout(() => setMobileChrome(false), 3000);
    }
    return () => { if (mobileChromeTimerRef.current) clearTimeout(mobileChromeTimerRef.current); };
  }, [bootSequence]);

  // Fiction articles for Transmission tab — updates when CAS data loads
  const transmissionStories = useMemo(() => articles.filter(a => a.type === 'fiction'), [articles]);

  // Legislation articles for Surveillance tab — prefer CAS-fetched entries (have full metadata)
  const legislationArticles = useMemo(
    () => dynamicData?.legislationArticles ?? articles.filter(a => a.type === 'legislation'),
    [dynamicData, articles],
  );

  // The legacy kernel-list ordering + Sophie-search memos (sortedBuilds /
  // filteredBuilds) retired with the KernelTab relic content — the reliquary
  // replaced the list (spec §5.1). kernelBuilds itself stays live for command
  // dispatch; searchFilter stays live for the footer terminal.


  // Boot completion is signalled by BootSequence itself via onDone — App.jsx no
  // longer needs to know the duration. Memoised so the ref is stable across renders.
  const handleBootDone = useCallback(() => {
    setBootSequence(false);
    setBootRevealed(true);
  }, []);

  // Fallback: guarantee bootAnimDone is set after the animation duration (2s + buffer).
  // onAnimationEnd is unreliable on iOS Safari when a CSS transform is active on the
  // same element — the transform creates a containing block that breaks fixed children,
  // so we must clear it promptly regardless of whether the event fires.
  //
  // Mobile: skip the reveal animation entirely (no scale transition) — the GPU cannot
  // composite a full-app scale + canvas rAF loops simultaneously without jank.
  // bootAnimDone resolves in 50ms so AmbientParticles and scroll observers activate
  // promptly. Desktop keeps the full 2200ms fallback window.
  useEffect(() => {
    if (!bootRevealed) return;
    const mobile = window.innerWidth <= 768;
    const t = setTimeout(() => setBootAnimDone(true), mobile ? 50 : 2200);
    return () => clearTimeout(t);
  }, [bootRevealed]);

  // Network status — drives the OFFLINE MODE indicator.
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);


  // ⌘K / Ctrl+K → open global article search overlay
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(v => !v);
        setGlobalSearchQuery('');
      }
      if (e.key === 'Escape') { setGlobalSearchOpen(false); setGMode(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Scroll to top on initial mount — prevents autoFocus on the footer input
  // from pulling mobile browsers down to the keyboard on first load.
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  // Scroll to top on navigation.
  // (The mobile returning-to-kernel smooth-scroll branch died with the legacy
  // KernelTab list — the reliquary has no #kernel-container to land on.)
  useLayoutEffect(() => {
    if (mainRef.current) {
      mainRef.current.style.scrollBehavior = 'auto';
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, [currentPath, selectedArticle?.id, architectThesis, tagCloudView, activeTab]);

  // ── Scroll-linked glow: cards brighten + slide up on viewport entry ─────
  useEffect(() => {
    if (!bootAnimDone || !mainRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-glow');
            observer.unobserve(entry.target);
          }
        }
      },
      { root: mainRef.current, threshold: 0.08 }
    );
    // Observe all bordered cards inside main
    const cards = mainRef.current.querySelectorAll('[class*="border"][class*="rounded"]');
    for (const card of cards) {
      if (!card.classList.contains('scroll-glow')) {
        card.style.opacity = '0.7';
        card.style.filter = 'brightness(0.85)';
        observer.observe(card);
      }
    }
    return () => observer.disconnect();
  }, [bootAnimDone, activeTab, selectedArticle]);

  // Handle loading a kernel module.
  // Abort-token pattern: each click mints a new token object. If a second click
  // arrives while the first is still in the 1200ms timeout window (shouldn't
  // happen because of the loadingKernel guard, but handles edge cases like
  // rapid programmatic calls), the previous token is marked aborted so its
  // async continuation is a no-op after the await.
  const handleKernelClick = useCallback((kernel) => {
    if (loadingKernel) return;

    // Invalidate any previous in-flight load
    if (loadAbortRef.current) loadAbortRef.current.aborted = true;
    const token = { aborted: false };
    loadAbortRef.current = token;

    setLoadingKernel(kernel.id);
    const now = new Date();
    appendSystemLog({ time: fmtTime(now), msg: `Initializing ${kernel.name}...` });

    setTimeout(async () => {
      if (token.aborted) return;

      const later = new Date();
      appendSystemLog({ time: fmtTime(later), msg: `${kernel.name} loaded successfully.` });
      setLoadingKernel(null);
      setLastLoadAt(Date.now());
      emitObs('transmissions', 'kernel_loaded', { kernelId: kernel?.id ?? kernel?.name ?? '—' });

      if (kernel.articleId) {
        // Priority: generated articles (fetch-based loadContent) → auto .md glob stubs (fallback).
        const foundArticle =
          articles.find(a => a.id === kernel.articleId) ??
          autoArticles.find(a => a.id === kernel.articleId);
        if (foundArticle) {
          const article = foundArticle.loadContent
            ? await foundArticle.loadContent()
            : foundArticle;
          if (token.aborted) return;  // guard after async gap
          setOriginTab('kernel');
          setSelectedArticle(article);
          setCurrentPath('~/system/kernel');
          if (mainRef.current) {
            mainRef.current.style.scrollBehavior = 'auto';
            mainRef.current.scrollTop = 0;
            window.scrollTo(0, 0);
          }
        } else {
          if (!token.aborted) appendSystemLog({ time: fmtTime(later), msg: `ERROR: Article ID '${kernel.articleId}' not found.` });
        }
      } else {
        if (!token.aborted) appendSystemLog({ time: fmtTime(later), msg: `NOTICE: No public file attached.` });
      }
    }, 1200);
  }, [loadingKernel, appendSystemLog, articles]);

  // Neural link handler — called when a [[KERNEL-ID]] button is clicked inside
  // a pre-rendered article chunk. Finds the matching build entry and delegates
  // to handleKernelClick so the full load animation fires identically.
  const handleNeuralLink = useCallback((cmd) => {
    const kernel = kernelBuilds.find(k => k.articleId === cmd || k.id === cmd);
    if (kernel) handleKernelClick(kernel);
  }, [handleKernelClick]);

  // Legislation article opener — used by SurveillanceTab cards.
  // Strategy: navigate synchronously (inside the React event handler tick) with
  // card metadata so the click is never a no-op, then async-enrich the article
  // with full CAS chunk content if the chunk exists.
  const handleLegislationSelect = useCallback((law) => {
    if (!law) return;
    // Cancel any in-flight kernel/transmission load so it cannot overwrite us.
    if (loadAbortRef.current) loadAbortRef.current.aborted = true;
    const token = { aborted: false };
    loadAbortRef.current = token;

    // ── Phase 1: navigate immediately (synchronous, inside event handler) ──
    setOriginTab('surveillance');
    setSelectedArticle(law);          // show card metadata instantly
    setCurrentPath('~/system/surveillance');
    if (mainRef.current) {
      mainRef.current.style.scrollBehavior = 'auto';
      mainRef.current.scrollTop = 0;
      window.scrollTo(0, 0);
    }

    // ── Phase 2: enrich with full CAS chunk body if one exists ──────────────
    if (law.loadContent) {
      law.loadContent()
        .then(fullArticle => {
          if (!token.aborted) setSelectedArticle(fullArticle);
        })
        .catch(() => {
          // No chunk file for this legislation article — metadata view is fine.
        });
    }
  }, []);

  // Handle loading a transmission signal — mirrors handleKernelClick but for
  // fiction/signal articles. Uses the same loadAbortRef abort-token pattern and
  // emits SIGNAL_INGEST_SUCCESS to the system kernel log on success.
  const handleTransmissionSelect = useCallback(async (story) => {
    if (loadingSignal) return;

    if (loadAbortRef.current) loadAbortRef.current.aborted = true;
    const token = { aborted: false };
    loadAbortRef.current = token;

    setLoadingSignal(story.id);
    const t1 = fmtTime();
    appendSystemLog({ time: t1, msg: `SIGNAL_INGEST: Acquiring "${story.title}"...` });

    try {
      const article = story.loadContent ? await story.loadContent() : story;
      if (token.aborted) return;

      const t2 = fmtTime();
      appendSystemLog({ time: t2, msg: `SIGNAL_INGEST_SUCCESS: ${story.id}` });
      setLoadingSignal(null);
      setOriginTab('transmission');
      setSelectedArticle(article);
      setCurrentPath('~/system/transmission');
      if (mainRef.current) {
        mainRef.current.style.scrollBehavior = 'auto';
        mainRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
      }
    } catch (err) {
      if (token.aborted) return;
      const t2 = fmtTime();
      console.error('[KERNEL_LOG] Transmission load failed:', story.id, err);
      appendSystemLog({ time: t2, msg: `ERROR: SIGNAL_INGEST_FAIL — ${story.id}` });
      setLoadingSignal(null);
    }
  }, [loadingSignal, appendSystemLog]);

  const handleReturnToRoot = useCallback(() => {
    const targetTab = originTab === 'kernel_doc' || originTab === 'kernel' ? 'kernel' : originTab;
    setSelectedArticle(null);
    setArchitectThesis(false);
    setTagCloudView(false);
    setActiveTab(targetTab);
    emitObs('gaze', 'tab_navigated', { tab: targetTab });
    setCurrentPath('~/' + targetTab);
  }, [originTab]);

  // ── Synced tab pulse (Observer guidance spec §4): the suggested tab breathes
  // on the eye's 2400ms beat. sealed:false is safe — sealing requires a complete
  // spine, and a complete spine already yields pulseTab null (armed).
  const [eyeGuidance, setEyeGuidance] = useState(getEyeGuidance);
  const [spineSnap, setSpineSnap] = useState(getSpineSnap);
  useEffect(() => subscribeGuidance(setEyeGuidance), []);
  useEffect(() => subscribeSpineSnap(() => setSpineSnap(getSpineSnap())), []);
  const pulseTab = pulseTabFor({ sealed: false, flaring: false, spine: spineSnap, suggestion: eyeGuidance.suggestion });
  const beatDelay = useMemo(() => `-${Math.round(performance.now() % 2400)}ms`, [pulseTab]);
  const beat = (tab) => (pulseTab === tab ? ' nav-beat' : '');

  const handleNav = useCallback((path, tab) => {
    setCurrentPath(path);
    setActiveTab(prev => {
      if (prev !== tab) {
        setTabGlitch(true);
        setTimeout(() => setTabGlitch(false), 180);
        // Deferred: this updater runs during render, and a synchronous bus emit
        // here setStates any mounted subscriber mid-render (React error).
        setTimeout(() => {
          emitObs('gaze', 'tab_navigated', { tab });
          notifyNav(tab);
        }, 0);
      }
      return tab;
    });
    setSelectedArticle(null);
    setArchitectThesis(false);
    setTagCloudView(false);
    setSearchFilter('');
  }, []);

  // g-leader navigation (Colemak-DH home-row optimised)
  const G_NAV = {
    n: ['~/system/kernel',       'kernel'],
    a: ['~/system/art',          'art'],
    e: ['~/system/ecocide',      'ecocide'],
    s: ['~/system/surveillance', 'surveillance'],
    m: ['~/system/mercury',      'mercury'],
    l: ['~/system/lunar',        'lunar'],
    r: ['~/system/ledger',       'ledger'],
    p: ['~/system/privacy',      'privacy'],
  };

  useEffect(() => {
    const onKey = (e) => {
      // Ignore inside inputs
      if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (!gMode) {
        if (e.key === 'g') {
          e.preventDefault();
          setGMode(true);
          if (gModeTimerRef.current) clearTimeout(gModeTimerRef.current);
          gModeTimerRef.current = setTimeout(() => setGMode(false), 1500);
        }
        return;
      }

      // In g-mode: consume any key
      e.preventDefault();
      clearTimeout(gModeTimerRef.current);
      setGMode(false);

      const entry = G_NAV[e.key.toLowerCase()];
      if (entry) handleNav(entry[0], entry[1]);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gMode, handleNav]);

  // Open an article from the global search overlay — routes to the right tab
  const openArticleFromSearch = useCallback((article) => {
    setGlobalSearchOpen(false);
    setGlobalSearchQuery('');
    const isEco = article?.tags?.some(t =>
      ['Botany','Ecology','Autochthony','Lizard Gap','Biodiversity','Atmospheric',
       'Climate','Thermodynamic','Entropy','Ecological','Biocoenosis','Biology',
       'Sustainability','Ecocide','ecological','biodiversity','atmospheric'].includes(t)
    );
    const isFiction = article?.type === 'fiction';
    const tab  = isFiction ? 'transmission' : isEco ? 'ecocide' : 'kernel';
    const path = `~/system/${tab}/${article.id}`;
    setActiveTab(tab);
    emitObs('gaze', 'tab_navigated', { tab });
    setOriginTab(tab);
    setCurrentPath(path);
    setSelectedArticle(article);
    setArchitectThesis(false);
    setTagCloudView(false);
    if (mainRef.current) { mainRef.current.scrollTop = 0; }
  }, []);

  // Command dispatcher — all Enter-key logic lives in useCommandDispatch.
  // ctx is rebuilt on every render; the hook reads it through a ref so the
  // returned callback stays stable (deps: []).
  const dispatchCommand = useCommandDispatch({
    articles, classifiedSession, transmissionStories, tagIndex, systemArticles, activeTab,
    setSystemLogs, setClassifiedSession, setActiveTab, setSelectedArticle,
    setSearchFilter, setCurrentPath, setRelicMode, setBreachOpen, setSanctuaryOpen, applyEcoCost, applyRefill, latticeState, ramPct,
    setOriginTab, setArchitectThesis, setTagCloudView,
    appendSystemLog, handleNav, handleKernelClick, handleTransmissionSelect,
    loadAbortRef, activeKernels, setKuramotoViz, setAssociativeField, setSpectralBridges, setEnclaveKeys, setProbeNode, setBoneFusions,
    fusionLog, setFusionLog, kernelRunHistoryRef,
    onKernelRun: (ts, kernelId, durationMs) => {
      setLastKernelAt(ts);
      emitObs('transmissions', 'kernel_completed', { kernelId: kernelId ?? '—', durationMs: durationMs ?? null });
    },
  });

  // Mobile [run] / tap-to-run bridge for the KernelTab active_modules list.
  const mobileAutoRun = useCallback((kernelId) => {
    const alias = wasmRegistry[kernelId] ? kernelId : resolveWasmAlias(kernelId);
    const now = fmtTime();
    dispatchCommand('run', alias, `run ${alias}`, now, { eco: true });
  }, [dispatchCommand]);

  // Orthogonal bridge handler — DIVERGENCE_ENGINE auto-forged links from right-click
  const handleOrthogonalBridge = useCallback((sourceId, result) => {
    setOrthogonalBridges(prev => [...prev, {
      idA: sourceId, idB: result.id, sim: result.sim, divergentDims: result.divergentDims,
    }]);
    const now = fmtTime();
    appendSystemLog({ time: now, msg: `[DIVERGENCE_ENGINE] :: Forced orthogonal bridge generated :: ${sourceId.toUpperCase()} <-> ${result.id.toUpperCase()} :: Cosine Similarity: ${result.sim.toFixed(4)}`, rust: true });
    if (result.divergentDims?.length) {
      appendSystemLog({ time: now, msg: `  [DIVERGENT_DIMS] :: ${result.divergentDims.map(d => `${d.name}(Δ${d.delta.toFixed(3)})`).join(' · ')}`, rust: true });
    }
  }, [appendSystemLog]);

  // Manual fusion handler — operator-forged edges from /art long-press (mobile)
  const handleManualFusion = useCallback((idA, idB, analysis) => {
    setManualFusions(prev => [...prev, { idA, idB, sim: analysis.sim, drivers: analysis.drivers }]);
    const now  = fmtTime();
    const bars = '▓'.repeat(Math.round(analysis.sim * 5)) + '░'.repeat(5 - Math.round(analysis.sim * 5));
    appendSystemLog({ time: now, msg: `[MANUAL_FUSION] :: ${idA} ↔ ${idB}` });
    appendSystemLog({ time: now, msg: `  [COSINE] :: ${analysis.sim.toFixed(4)} ${bars}` });
    analysis.drivers.forEach(d => {
      appendSystemLog({ time: now, msg: `  [TENSOR] ${d.name} :: ${d.value.toFixed(3)}  (${idA}=${d.magA.toFixed(2)} · ${idB}=${d.magB.toFixed(2)})` });
    });
    appendSystemLog({ time: now, msg: `  ── Operator forced lattice convergence. Metabolic cost logged. ──` });
  }, [appendSystemLog]);

  // Autocomplete + suggestion execution — keystroke logic lives in useAutocomplete.
  const { handleInputChange, executeSuggestion } = useAutocomplete({
    setCommandInput, setSuggestions, setParamHint, setActiveSugg,
    appendSystemLog, handleKernelClick,
  });

  // Command handler
  const handleCommand = (e) => {
    // ── Suggestion dropdown navigation ──────────────────────────────────────
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSugg(prev => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSugg(prev => Math.max(prev - 1, -1));
        return;
      }
      if (e.key === 'Escape') {
        setSuggestions([]);
        setActiveSugg(-1);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const k = activeSugg >= 0 ? suggestions[activeSugg] : suggestions[0];
        if (k._type === 'run' || k._type === 'cmd') {
          setCommandInput(k._complete ?? k.name);
        } else {
          setCommandInput(`load ${k.name}`);
        }
        setSuggestions([]);
        setActiveSugg(-1);
        return;
      }
      if (e.key === 'Enter' && activeSugg >= 0) {
        executeSuggestion(suggestions[activeSugg]);
        return;
      }
    }

    // ── Command history navigation (↑↓ when dropdown is closed) ────────────
    if (!suggestions.length) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!cmdHistory.length) return;
        if (historyIdx === -1) setSavedInput(commandInput);
        const newIdx = historyIdx === -1 ? 0 : Math.min(historyIdx + 1, cmdHistory.length - 1);
        setHistoryIdx(newIdx);
        setCommandInput(cmdHistory[newIdx]);
        return;
      }
      if (e.key === 'ArrowDown' && historyIdx !== -1) {
        e.preventDefault();
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setCommandInput(newIdx === -1 ? savedInput : cmdHistory[newIdx]);
        return;
      }
    }

    if (e.key === 'Enter') {
      submitCommand();
    }
  };

  // Shared command-execution path: parses the raw command the same way
  // submitCommand does, then dispatches.
  const runRawCommand = useCallback((raw) => {
    const rawCmd = (raw ?? '').trim();
    if (!rawCmd) return;
    const cmdParts = rawCmd.toLowerCase().split(' ').filter(Boolean);
    const action = cmdParts[0]
      ? (cmdParts[0].startsWith('/') ? cmdParts[0].substring(1) : cmdParts[0])
      : '';
    const query = cmdParts.slice(1).join(' ');
    const now = fmtTime();
    dispatchCommand(action, query, rawCmd, now);
  }, [dispatchCommand]);

  const submitCommand = () => {
    setSuggestions([]);
    setActiveSugg(-1);
    const rawCmd = commandInput.trim();
    setCommandInput('');
    if (rawCmd) {
      setCmdHistory(prev => [rawCmd, ...prev].slice(0, 50));
      setHistoryIdx(-1);
      setSavedInput('');
    }
    runRawCommand(rawCmd);
  };

  return (
    <div className={`h-[100dvh] font-mono selection:bg-fuchsia-900 selection:text-amber-300 flex flex-col overflow-hidden relative transition-colors duration-700 ${selectedArticle || architectThesis ? 'bg-[#09090b]' : 'bg-black'} ${relicMode ? 'relic-mode' : ''}`}
      style={{ animation: activeTab === 'art' ? 'none' : 'terminal-flicker 7s ease-in-out infinite' }}
      onTouchStart={showMobileChrome}
      onTouchEnd={hideMobileChromeAfterDelay}
      onTouchCancel={hideMobileChromeAfterDelay}
    >

      {/* ── Ambient visual layers ──────────────────────────────────────────── */}
      {bootAnimDone && <AmbientParticles />}
      <div className={`crt-overlay${isCritical ? ' crt-critical' : isWarning ? ' crt-warning' : ''}`} aria-hidden="true" />
      {/* ── Polarity ambient glow — radial overlay, shifts on each collision ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          background: lastPolarityClass
            ? `radial-gradient(ellipse 80% 60% at 50% 100%, ${POLARITY_GLOW[lastPolarityClass]} 0%, transparent 70%)`
            : 'none',
          opacity: lastPolarityClass ? 1 : 0,
          transition: 'opacity 1.5s ease, background 1.5s ease',
        }}
      />
      {tabGlitch && (
        <div className="tab-glitch-burst" aria-hidden="true">
          <div className="tab-glitch-layer tab-glitch-cyan" />
          <div className="tab-glitch-layer tab-glitch-lime" />
        </div>
      )}

      {/* ── Boot sequence — unmounts when onDone fires ─────────────────────── */}
      {bootSequence && <BootSequence onDone={handleBootDone} />}


      {/* ── Sanctuary overlay (Period-3 window) ─────────────────────────────── */}
      {sanctuaryOpen && (
        <SanctuaryOverlay onClose={() => setSanctuaryOpen(false)} />
      )}

      {/* ── Breach Protocol overlay ─────────────────────────────────────────── */}
      {breachOpen && (
        <BreachProtocol
          onClose={() => setBreachOpen(false)}
          onSuccess={() => {
            setBreachOpen(false);
            const t = fmtTime();
            setSystemLogs(prev => [...prev,
              { time: t, msg: `  BREACH_COMPLETE :: ICE dissolved — DATAMINE daemons uploaded`, rust: true },
              { time: t, msg: `  REWARD: ACCESS GRANTED // Militech Mantis neutralized`, rust: true },
            ].slice(-2000));
          }}
        />
      )}


      {/* ── Kuramoto synchrony visualizer ─────────────────────────────────── */}
      {kuramotoViz?.active && (
        <KuramotoVisualizer
          params={kuramotoViz}
          onDismiss={() => setKuramotoViz(null)}
        />
      )}

      {/*
       * ── Boot-to-main transition overlay ───────────────────────────────────
       * Removed: the opacity-fade overlay (z-97) has been replaced by the
       * global-reveal-mask below. BootSequence at z-100 covers the main UI
       * during boot; the mask at z-49 takes over in the same React commit
       * when bootSequence → false, ensuring a single-pass top-to-bottom draw
       * with no clip-path (buggy on iOS Safari flex containers) and no
       * opacity desync between the overlay fade and the content reveal.
       */}

      <style>{`
        /* Custom "Hacker" Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #000;
        }
        ::-webkit-scrollbar-thumb {
          background: #06b6d4; /* Cyan-500 */
          border-radius: 0px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #22d3ee; /* Cyan-400 */
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.8);
        }

        /* Custom Keyframes for slow spin */
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-spin-slow {
          animation: spin 12s linear infinite;
        }
      `}</style>

      {/*
       * ── Default cube expand — boot singularity → kernel tab reveal ──────────
       * Mounts in the same React commit that unmounts BootSequence.
       * No clip-path (buggy on iOS Safari flex containers). Pure scale + opacity.
       *
       * The boot card collapses to a point at screen center (scale → 0).
       * This element is the SAME rectangular form as the boot card, starting at
       * that collapsed scale (0.01) and expanding outward — the 2x2x2x default
       * cube "press S" moment: uncut stasis compressed to singularity, then scaled
       * into creation. At peak scale it covers the full viewport, then fades to 0
       * revealing the kernel tab behind it.
       *
       * z-49: above main UI (z-10 / z-40), below BootSequence (z-100).
       * pointerEvents: none — never traps clicks.
       */}

      {/* ── Terminal content — springs up from singularity after boot ────────── */}
      <div
        className="flex flex-col flex-grow min-h-0"
        style={(() => {
          if (bootAnimDone) return {};
          const mobile = window.innerWidth <= 768;
          if (bootRevealed) {
            // Mobile: skip scale animation entirely — GPU cannot composite a full-app
            // scale transform + canvas rAF loops simultaneously without jank.
            // bootAnimDone resolves in 50ms via the fallback timeout above.
            if (mobile) return {};
            // Desktop: ease-out spring — fast start, clean deceleration.
            return {
              animation: 'kernel-reveal-scale 1.35s cubic-bezier(0.16,1,0.3,1) both',
              transformOrigin: 'center center',
              willChange: 'transform',
            };
          }
          return {
            transform: mobile ? 'scale(1.8)' : 'scale(0.01)',
            opacity: 0,
            transformOrigin: 'center center',
            willChange: 'transform',
          };
        })()}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget &&
            (e.animationName === 'kernel-reveal-scale' || e.animationName === 'kernel-reveal-scale-mobile'))
            setBootAnimDone(true);
        }}
      >
        <OctagonGrid visible={!selectedArticle && !architectThesis && !tagCloudView && activeTab !== 'art'} />

      {/* ── Global article search overlay (⌘K) ───────────────────────────── */}
      {globalSearchOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setGlobalSearchOpen(false); }}
        >
          <div
            className="w-full max-w-xl mx-4 overflow-hidden rounded-sm"
            style={{
              background:  'rgba(0,0,0,0.97)',
              border:      '1px solid rgba(57,255,20,0.18)',
              boxShadow:   '0 0 0 1px rgba(57,255,20,0.04), 0 0 32px rgba(57,255,20,0.07), 0 8px 32px rgba(0,0,0,0.7)',
              animation:   'sk-logIn 0.18s ease forwards',
            }}
          >
            {/* Search input row */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid rgba(57,255,20,0.10)' }}
            >
              <span style={{ color: 'rgba(57,255,20,0.35)', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '14px' }}>⌕</span>
              <input
                autoFocus
                value={globalSearchQuery}
                onChange={e => { setGlobalSearchQuery(e.target.value); setSearchResultIdx(-1); }}
                placeholder="search articles, kernels, tags…"
                spellCheck={false}
                style={{
                  flex:        1,
                  background:  'transparent',
                  border:      'none',
                  outline:     'none',
                  color:       '#39ff14',
                  fontFamily: "'Geist Mono', ui-monospace, monospace",
                  fontSize:    '13px',
                  letterSpacing: '0.04em',
                  caretColor:  '#39ff14',
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setGlobalSearchOpen(false); return; }
                  const results = globalSearchResults;
                  if (!results?.length) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSearchResultIdx(i => Math.min(results.length - 1, i + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSearchResultIdx(i => Math.max(-1, i - 1));
                  } else if (e.key === 'Enter' && searchResultIdx >= 0) {
                    openArticleFromSearch(results[searchResultIdx]);
                  }
                }}
              />
              <span
                style={{ color: 'rgba(57,255,20,0.22)', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '10px', letterSpacing: '0.12em', cursor: 'pointer' }}
                onClick={() => setGlobalSearchOpen(false)}
              >ESC</span>
            </div>

            {/* Results area */}
            {!globalSearchResults ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '9px', color: 'rgba(57,255,20,0.18)', letterSpacing: '0.14em' }}>
                  TYPE TO SEARCH ALL ARTICLES · MANIFESTO · TRANSMISSION · ECO-KERNEL
                </div>
            ) : !globalSearchResults.length ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '10px', color: 'rgba(57,255,20,0.20)' }}>
                  no matches
                </div>
            ) : (
                <ul style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {globalSearchResults.map((a, idx) => {
                    const isEco = a?.tags?.some(t =>
                      ['Ecology','Botany','Biodiversity','Atmospheric','Climate','Ecocide','ecological'].includes(t)
                    );
                    const tab      = a.type === 'fiction' ? 'transmission' : isEco ? 'ecocide' : 'kernel';
                    const tabColor = tab === 'transmission' ? 'rgba(167,139,250,0.65)'
                                   : tab === 'ecocide'      ? 'rgba(122,184,0,0.70)'
                                   :                          'rgba(57,255,20,0.55)';
                    const isSelected = idx === searchResultIdx;
                    return (
                      <li key={a.id} style={{ borderBottom: '1px solid rgba(57,255,20,0.05)' }}>
                        <button
                          className="w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors"
                          style={{ background: isSelected ? 'rgba(57,255,20,0.07)' : 'transparent' }}
                          onMouseEnter={() => setSearchResultIdx(idx)}
                          onMouseLeave={() => setSearchResultIdx(i => i === idx ? -1 : i)}
                          onClick={() => openArticleFromSearch(a)}
                        >
                          <span style={{ color: tabColor, fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '8px', fontWeight: 800, letterSpacing: '0.12em', marginTop: '2px', flexShrink: 0, width: '68px' }}>
                            {tab.toUpperCase()}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ color: 'rgba(57,255,20,0.88)', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '12px', fontWeight: 700, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.title ?? a.id}
                            </span>
                            {a.tags?.length > 0 && (
                              <span style={{ color: 'rgba(57,255,20,0.22)', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '9px' }}>
                                {a.tags.slice(0, 4).join(' · ')}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
            )}

            {/* Footer hint */}
            <div style={{ padding: '6px 16px', borderTop: '1px solid rgba(57,255,20,0.07)', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: '8px', color: 'rgba(57,255,20,0.15)', letterSpacing: '0.10em', display: 'flex', justifyContent: 'space-between' }}>
              <span>SCALE_9.4 // KERNEL SEARCH</span>
              <span>↑↓ navigate · ↵ open · esc close</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Offline indicator ─────────────────────────────────────────────── */}
      {!isOnline && (
        <div className="sticky top-0 z-[45] flex items-center justify-center gap-2 bg-amber-950/95 border-b border-amber-500/40 py-1 text-[10px] font-bold tracking-widest text-amber-400 font-mono uppercase backdrop-blur">
          <span className="animate-pulse">●</span>
          OFFLINE MODE // SERVING FROM CACHE // SORBE NODE UNREACHABLE
        </div>
      )}

      <header className={`border-b border-cyan-900/30 bg-black md:bg-black/90 p-4 h-24 shrink-0 sticky top-0 z-40 md:backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.1)] overflow-x-hidden w-full transition-opacity duration-500 ${!mobileChrome ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : ''}`} style={{ willChange: 'opacity, transform', transform: 'translateZ(0)' }}>
        <div className="max-w-[1800px] mx-auto flex flex-row items-center gap-4 w-full min-w-0">
          <style>{`
            .nav-beat {
              animation: nav-beat 2400ms ease-in-out infinite;
              animation-delay: var(--beat-delay, 0ms);
            }
            @keyframes nav-beat {
              0%, 100% { opacity: 0.55; filter: none; }
              50%      { opacity: 1;    filter: drop-shadow(0 0 6px currentColor); }
            }
            @media (prefers-reduced-motion: reduce) {
              .nav-beat { animation: none; }
            }
          `}</style>
          {/* ── The Observer eye — masthead face (top-left); the terminal's identity.
              Wordmark dissolved to the footer per decision 10.3. ── */}
          {!bootSequence && !sanctuaryOpen && !breachOpen && (
            <MercuryEyeIndicator
              activeTab={activeTab}
              onNavigate={() => handleNav('~/system/mercury', 'mercury')}
              lastKernelAt={lastKernelAt}
              lastLoadAt={lastLoadAt}
            />
          )}
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 text-[11px] font-bold tracking-normal overflow-x-auto shrink min-w-0 flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', '--beat-delay': beatDelay }}>
            <button aria-label="Kernel" aria-current={activeTab === 'kernel' ? 'page' : undefined} onClick={() => handleNav('~/system/kernel', 'kernel')} className={`${activeTab === 'kernel' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-cyan-500 hover:text-cyan-200 hover:bg-cyan-900/30'} px-2 py-1 transition-all duration-300 flex items-center gap-1.5 uppercase rounded-sm whitespace-nowrap`}><Cpu className="w-3 h-3" /> /Kernel</button>

            <button aria-label="BSKY" aria-current={activeTab === 'bsky' ? 'page' : undefined} onClick={() => handleNav('~/system/bsky', 'bsky')} className={`${activeTab === 'bsky' ? 'bg-sky-600 text-sky-50 shadow-[0_0_12px_rgba(56,189,248,0.5)]' : 'text-sky-400/80 hover:text-sky-200 hover:bg-sky-900/20'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap${beat('bsky')}`}><NavButterflyIcon /> /BSKY</button>

            <button aria-label="Manifesto" aria-current={activeTab === 'manifesto' ? 'page' : undefined} onClick={() => handleNav('~/system/manifesto', 'manifesto')} className={`${activeTab === 'manifesto' ? 'bg-violet-900 text-violet-100 shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'text-violet-400/80 hover:text-violet-200 hover:bg-violet-900/30'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap${beat('manifesto')}`}><Eye className="w-3 h-3" /> /Manifesto</button>

            <button aria-label="Transmission" aria-current={activeTab === 'transmission' ? 'page' : undefined} onClick={() => handleNav('~/system/transmission', 'transmission')} className={`${activeTab === 'transmission' ? 'bg-purple-900 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'text-purple-400/80 hover:text-purple-200 hover:bg-purple-900/30'} px-2 py-1 transition-all duration-300 uppercase rounded-sm whitespace-nowrap${beat('transmission')}`}>⌖ /Transmission</button>

            <button aria-label="Scaling" aria-current={activeTab === 'scaling' ? 'page' : undefined} onClick={() => handleNav('~/system/scaling', 'scaling')} className={`${activeTab === 'scaling' ? 'bg-fuchsia-500 text-black shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'text-fuchsia-500 hover:text-fuchsia-200 hover:bg-fuchsia-900/30'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap`}><Scale className="w-3 h-3" /> /Scaling</button>

            <button aria-label="Privacy" aria-current={activeTab === 'privacy' ? 'page' : undefined} onClick={() => handleNav('~/system/privacy', 'privacy')} className={`${activeTab === 'privacy' ? 'bg-rose-900 text-rose-100 shadow-[0_0_10px_rgba(244,63,94,0.4)]' : 'text-rose-400/80 hover:text-rose-200 hover:bg-rose-900/20'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap`}><Lock className="w-3 h-3" /> /Privacy</button>

            <button aria-label="Surveillance" aria-current={activeTab === 'surveillance' ? 'page' : undefined} onClick={() => handleNav('~/system/surveillance', 'surveillance')} className={`${activeTab === 'surveillance' ? 'bg-red-900 text-red-100 shadow-[0_0_10px_rgba(248,113,113,0.4)]' : 'text-red-500/70 hover:text-red-300 hover:bg-red-900/20'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap`}><ShieldAlert className="w-3 h-3" /> /Surveillance</button>

            <button aria-label="Cryptography" aria-current={activeTab === 'cryptography' ? 'page' : undefined} onClick={() => handleNav('~/system/cryptography', 'cryptography')} className={`${activeTab === 'cryptography' ? 'bg-orange-950 text-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.5)]' : 'text-orange-500/70 hover:text-orange-300 hover:bg-orange-950/30'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap`}><KeyRound className="w-3 h-3" /> /Cryptography</button>

            <button aria-label="Chaos" aria-current={activeTab === 'art' ? 'page' : undefined} onClick={() => handleNav('~/system/art', 'art')} className={`${activeTab === 'art' ? 'text-black shadow-[0_0_14px_rgba(255,215,0,0.6)]' : 'hover:text-amber-300 hover:bg-amber-900/20'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap${beat('art')}`} style={activeTab === 'art' ? { background: 'linear-gradient(90deg,#FF8C00,#FFD700)' } : { color: 'rgba(251,191,36,0.6)' }}><Waves className="w-3 h-3" /> /Chaos</button>

            <button aria-label="Ecocide" aria-current={activeTab === 'ecocide' ? 'page' : undefined} onClick={() => handleNav('~/system/ecocide', 'ecocide')} className={`${activeTab === 'ecocide' ? 'text-black shadow-[0_0_14px_rgba(122,184,0,0.55)]' : 'hover:text-lime-300 hover:bg-[#1a2d00]/40'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap${beat('ecocide')}`} style={activeTab === 'ecocide' ? { background: 'linear-gradient(90deg,#7ab800,#3d5c00)' } : { color: 'rgba(122,184,0,0.5)' }}><Leaf className="w-3 h-3" /> /Ecocide</button>

            {/* Mercury tab removed (Observer spec, option A) — the eye in the masthead
                is now Mercury's sole gateway. Ledger sits before Lunar so the spectrum
                stays monotonic without Mercury's silver bridging lime→violet→teal:
                lime → teal → violet ends the walk where a rainbow ends. */}

            <button aria-label="Ledger" aria-current={activeTab === 'ledger' ? 'page' : undefined} onClick={() => handleNav('~/system/ledger', 'ledger')} className={`${activeTab === 'ledger' ? 'text-black shadow-[0_0_14px_rgba(20,184,166,0.6)]' : 'hover:text-teal-200 hover:bg-teal-900/20'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap${beat('ledger')}`} style={activeTab === 'ledger' ? { background: 'linear-gradient(90deg,#0d9488,#14b8a6)' } : { color: 'rgba(20,184,166,0.5)' }}><span style={{ fontSize: 12, lineHeight: 1 }}>ᛟ</span> /Ledger</button>

            <button aria-label="Lunar" aria-current={activeTab === 'lunar' ? 'page' : undefined} onClick={() => handleNav('~/system/lunar', 'lunar')} className={`${activeTab === 'lunar' ? 'bg-violet-900 text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.5)]' : 'text-violet-400/50 hover:text-violet-200 hover:bg-violet-900/20'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap${beat('lunar')}`}><Moon className="w-3 h-3" /> /Lunar</button>

          </nav>
        </div>
      </header>

      <main ref={mainRef} className="flex-grow min-h-0 overflow-y-auto overflow-x-hidden p-4 pb-14 md:p-8 relative z-10 scroll-smooth" style={{ scrollPaddingTop: '100px' }}>
        <Suspense fallback={<div className="text-cyan-400 font-mono tracking-widest animate-pulse p-8">{'// LOADING MODULE...'}</div>}>
        <div className="max-w-[1800px] mx-auto">
          {/* Path breadcrumb — hidden on kernel home (tty0 is the nav there) */}
          {!(activeTab === 'kernel' && !selectedArticle && !architectThesis && !tagCloudView) && (() => {
            const _bc = {
              kernel:       { prompt: 'text-cyan-400',    path: 'text-cyan-300',    cursor: 'bg-cyan-400',    border: 'border-cyan-500/25',  glow: '0 0 18px rgba(6,182,212,0.25), 0 0 4px rgba(6,182,212,0.4)',      cursorGlow: '0 0 10px rgba(6,182,212,0.8)',      pathGlow: '0 0 6px rgba(6,182,212,0.3)' },
              bsky:         { prompt: 'text-sky-400',     path: 'text-sky-300',     cursor: 'bg-sky-400',     border: 'border-sky-500/25',   glow: '0 0 18px rgba(56,189,248,0.25), 0 0 4px rgba(56,189,248,0.4)',    cursorGlow: '0 0 10px rgba(56,189,248,0.8)',     pathGlow: '0 0 6px rgba(56,189,248,0.3)' },
              manifesto:    { prompt: 'text-violet-400',  path: 'text-violet-300',  cursor: 'bg-violet-400',  border: 'border-violet-500/25',glow: '0 0 18px rgba(139,92,246,0.25), 0 0 4px rgba(139,92,246,0.4)',    cursorGlow: '0 0 10px rgba(139,92,246,0.8)',     pathGlow: '0 0 6px rgba(139,92,246,0.3)' },
              transmission: { prompt: 'text-purple-400',  path: 'text-purple-300',  cursor: 'bg-purple-400',  border: 'border-purple-500/25',glow: '0 0 18px rgba(168,85,247,0.25), 0 0 4px rgba(168,85,247,0.4)',    cursorGlow: '0 0 10px rgba(168,85,247,0.8)',     pathGlow: '0 0 6px rgba(168,85,247,0.3)' },
              scaling:      { prompt: 'text-fuchsia-400', path: 'text-fuchsia-300', cursor: 'bg-fuchsia-400', border: 'border-fuchsia-500/25',glow: '0 0 18px rgba(217,70,239,0.25), 0 0 4px rgba(217,70,239,0.4)',   cursorGlow: '0 0 10px rgba(217,70,239,0.8)',     pathGlow: '0 0 6px rgba(217,70,239,0.3)' },
              privacy:      { prompt: 'text-rose-400',    path: 'text-rose-300',    cursor: 'bg-rose-400',    border: 'border-rose-500/25',  glow: '0 0 18px rgba(244,63,94,0.2), 0 0 4px rgba(244,63,94,0.35)',     cursorGlow: '0 0 10px rgba(244,63,94,0.8)',      pathGlow: '0 0 6px rgba(244,63,94,0.3)' },
              surveillance: { prompt: 'text-red-400',     path: 'text-red-300',     cursor: 'bg-red-400',     border: 'border-red-500/25',   glow: '0 0 18px rgba(248,113,113,0.2), 0 0 4px rgba(248,113,113,0.35)', cursorGlow: '0 0 10px rgba(248,113,113,0.8)',    pathGlow: '0 0 6px rgba(248,113,113,0.3)' },
              cryptography: { prompt: 'text-orange-400',  path: 'text-orange-300',  cursor: 'bg-orange-400',  border: 'border-orange-500/25',glow: '0 0 18px rgba(249,115,22,0.25), 0 0 4px rgba(249,115,22,0.4)',   cursorGlow: '0 0 10px rgba(249,115,22,0.8)',     pathGlow: '0 0 6px rgba(249,115,22,0.3)' },
              art:          { prompt: 'text-amber-400',   path: 'text-amber-300',   cursor: 'bg-amber-400',   border: 'border-amber-500/25', glow: '0 0 18px rgba(255,215,0,0.25), 0 0 4px rgba(255,215,0,0.4)',     cursorGlow: '0 0 10px rgba(255,215,0,0.8)',      pathGlow: '0 0 6px rgba(255,215,0,0.3)' },
              ecocide:      { prompt: 'text-lime-400',    path: 'text-lime-300',    cursor: 'bg-lime-400',    border: 'border-lime-500/25',  glow: '0 0 18px rgba(122,184,0,0.25), 0 0 4px rgba(122,184,0,0.4)',    cursorGlow: '0 0 10px rgba(122,184,0,0.8)',      pathGlow: '0 0 6px rgba(122,184,0,0.3)' },
              lunar:        { prompt: 'text-violet-400',  path: 'text-violet-300',  cursor: 'bg-violet-400',  border: 'border-violet-500/25',glow: '0 0 18px rgba(139,92,246,0.25), 0 0 4px rgba(139,92,246,0.4)',    cursorGlow: '0 0 10px rgba(139,92,246,0.8)',     pathGlow: '0 0 6px rgba(139,92,246,0.3)' },
              mercury:      { prompt: 'text-zinc-400', path: 'text-zinc-300', cursor: 'bg-zinc-400', border: 'border-zinc-500/25', glow: '0 0 18px rgba(192,192,192,0.2), 0 0 4px rgba(192,192,192,0.35)', cursorGlow: '0 0 10px rgba(192,192,192,0.7)', pathGlow: '0 0 6px rgba(192,192,192,0.25)' },
              ledger:       { prompt: 'text-teal-400',    path: 'text-teal-300',    cursor: 'bg-teal-400',    border: 'border-teal-500/25',  glow: '0 0 18px rgba(20,184,166,0.25), 0 0 4px rgba(20,184,166,0.4)',   cursorGlow: '0 0 10px rgba(20,184,166,0.8)',     pathGlow: '0 0 6px rgba(20,184,166,0.3)' },
            };
            const t = _bc[activeTab] || _bc.kernel;
            return (
              <div
                className="breadcrumb-fade mb-8 flex items-center text-sm font-bold tracking-wider min-w-0 overflow-hidden pb-3"
              >
                <span className={`mr-2 ${t.prompt}`} style={{ textShadow: t.pathGlow }}>scale@node:</span>
                <span className={t.path} style={{ textShadow: t.pathGlow }}>{currentPath}</span>
                {selectedArticle && <span className={`ml-0 ${t.path}`} style={{ textShadow: t.pathGlow }}>/{selectedArticle.id}</span>}
                {architectThesis && <span className={`ml-0 ${t.path}`} style={{ textShadow: t.pathGlow }}>/thesis_log</span>}
                <span
                  className={`animate-pulse ml-2 inline-block w-2 h-4 ${t.cursor} align-middle`}
                  style={{ boxShadow: t.cursorGlow }}
                />
              </div>
            );
          })()}

          {/* Kernel Tab */}
          {activeTab === 'kernel' && !selectedArticle && !tagCloudView && (
            <KernelTab
              kernelAxioms={kernelAxioms}
              kernelBuilds={kernelBuilds}
              handleKernelClick={handleKernelClick}
              loadingKernel={loadingKernel}
              visibleLogs={visibleLogs}
              logRef={logRef}
              commandInput={commandInput}
              onCommandInputChange={handleInputChange}
              onCommandKeyDown={handleCommand}
              ramPct={ramPct}
              isCritical={isCritical}
              isWarning={isWarning}
              appendSystemLog={appendSystemLog}
              mobileChrome={mobileChrome}
              mobileAutoRun={mobileAutoRun}
              bootDone={bootRevealed}
              onNavigateToMercury={() => handleNav('~/system/mercury', 'mercury')}
            />
          )}

          {/* Scaling Tab */}
          {activeTab === 'scaling' && !selectedArticle && !architectThesis && (
            <WasmErrorBoundary>
              <ScalingTab
                setArchitectThesis={setArchitectThesis}
                setCurrentPath={setCurrentPath}
                setOriginTab={setOriginTab}
                loadKernel={handleNeuralLink}
                kernelRunHistoryRef={kernelRunHistoryRef}
                onPolarity={(polarity) => {
                  setLastPolarityClass(polarity);
                  emitObs('essences', 'polarity_shifted', { polarity });
                }}
              />
            </WasmErrorBoundary>
          )}

          {/* Architect Thesis View */}
          {architectThesis && (
            <ThesisView handleReturnToRoot={handleReturnToRoot} systemArticles={systemArticles} />
          )}

          {/* Transmission Tab */}
          {activeTab === 'transmission' && !selectedArticle && !architectThesis && (
            <TransmissionTab
              stories={transmissionStories}
              onSelect={handleTransmissionSelect}
              loadingSignal={loadingSignal}
            />
          )}

          {/* Manifesto Tab */}
          {activeTab === 'manifesto' && !selectedArticle && !architectThesis && (
            <ManifestoTab
              systemArticles={systemArticles}
              setArchitectThesis={setArchitectThesis}
            />
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && !selectedArticle && !architectThesis && (
            <PrivacyTab systemArticles={systemArticles} />
          )}

          {/* Surveillance Tab — @grey-c0 / Navigators Guild legislation corpus */}
          {activeTab === 'surveillance' && !selectedArticle && !architectThesis && (
            <SurveillanceTab
              legislationArticles={legislationArticles}
              onOpenLaw={handleLegislationSelect}
            />
          )}

          {/* BSKY Tab — AT Protocol / Bluesky network · GraphTracks analytics */}
          {activeTab === 'bsky' && !selectedArticle && !architectThesis && (
            <BskyTab />
          )}

          {/* Art Tab — Fade Doctrine Graph // Ars Electronica 2027 */}
          {activeTab === 'art' && !selectedArticle && !architectThesis && (
            <WasmErrorBoundary>
              <ArtTab
                associativeField={associativeField}
                spectralBridges={spectralBridges}
                boneFusions={boneFusions}
                manualFusions={manualFusions}
                onManualFusion={handleManualFusion}
                orthogonalBridges={orthogonalBridges}
                onOrthogonalBridge={handleOrthogonalBridge}
                probeNode={probeNode}
                onRunKernel={(alias) => {
                  const now = fmtTime();
                  dispatchCommand('run', alias, `run ${alias}`, now);
                }}
                onCueNode={(nodeIdx) => {
                  const now = fmtTime();
                  const q = `associative_field --seed ${nodeIdx} --beta 2.5 --probes 30`;
                  dispatchCommand('run', q, `run ${q}`, now);
                }}
              />
            </WasmErrorBoundary>
          )}

          {/* Ecocide Tab — biocoenosis · atmospheric entropy · thermodynamic law */}
          {activeTab === 'ecocide' && !selectedArticle && !architectThesis && (
            <EcocideTab
              articles={articles}
              onOpenArticle={(article) => {
                setSelectedArticle(article);
                setOriginTab('ecocide');
                setCurrentPath(`~/system/ecocide/${article.id}`);
              }}
            />
          )}

          {/* Lunar Tab — circalunar fragrance protocol */}
          {activeTab === 'lunar' && !selectedArticle && !architectThesis && (
            <LunarTab />
          )}

          {/* Mercury — unified elemental phase simulation */}
          {activeTab === 'mercury' && !selectedArticle && !architectThesis && (
            <MercuryTab />
          )}

          {/* Ledger Tab — The Open Ledger · Thermodynamic Audit Infrastructure */}
          {activeTab === 'ledger' && !selectedArticle && !architectThesis && (
            <WasmErrorBoundary>
              <LedgerTab />
            </WasmErrorBoundary>
          )}

          {/* Cryptography Tab — ML-KEM-768 PQC + Gray-Scott kernel reference */}
          {activeTab === 'cryptography' && !selectedArticle && !architectThesis && (
            <WasmErrorBoundary>
              <ClassifiedTab session={classifiedSession} />
            </WasmErrorBoundary>
          )}

          {/* Article Detail */}
          {selectedArticle && (
            <ArticleView
              article={selectedArticle}
              originTab={originTab}
              handleReturnToRoot={handleReturnToRoot}
              onNeuralLink={handleNeuralLink}
            />
          )}
          {/* Inline WASM simulation panels — rendered below article content */}
          {selectedArticle?.id === 'KINETIC-STATECRAFT-KERNEL-1.0' && (
            <KineticStatecraftPanel />
          )}
          {selectedArticle?.id === 'DALY-SIM-KERNEL-1.0.0' && (
            <DalySimPanel />
          )}

          {/* Tag Cloud */}
          {tagCloudView && !selectedArticle && (
            <TagCloudView handleReturnToRoot={handleReturnToRoot} tagIndex={tagIndex} />
          )}
        </div>
        </Suspense>
      </main>

      <footer className="hidden md:block border-t border-cyan-900/50 p-2 bg-black/90 backdrop-blur-md z-40 shadow-[0_0_15px_rgba(6,182,212,0.1)] [overflow-x:clip] w-full">
        <div className="max-w-[1600px] mx-auto relative flex items-center gap-2 text-sm font-bold tracking-wide min-w-0 w-full">

          {/* Param hint — floats above the terminal bar when run args are being typed */}
          {paramHint && suggestions.length === 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-black border border-fuchsia-900/40 shadow-[0_-2px_12px_rgba(217,70,239,0.1)] z-50 rounded-sm">
              <div className="px-4 py-2 flex items-center gap-2 text-xs font-mono">
                <span className="text-fuchsia-500/70 shrink-0">{'>'}</span>
                <span className="text-cyan-900/80 truncate">{commandInput}</span>
                <span className="text-fuchsia-400/60 tracking-wide">{paramHint}</span>
              </div>
            </div>
          )}

          {/* Autocomplete dropdown — floats above the terminal bar */}
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-black border border-cyan-900/60 shadow-[0_-4px_24px_rgba(6,182,212,0.2)] z-50 rounded-sm overflow-hidden">
              <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                {suggestions.map((k, i) => (
                  <div
                    key={k.id}
                    onMouseDown={(e) => { e.preventDefault(); executeSuggestion(k); }}
                    onTouchEnd={(e) => { e.preventDefault(); executeSuggestion(k); }}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-cyan-900/20 last:border-0 transition-colors ${i === activeSugg ? 'bg-cyan-900/30 border-l-2 border-l-cyan-400' : 'hover:bg-cyan-900/10 border-l-2 border-l-transparent'}`}
                  >
                    <span className={`text-xs font-bold tracking-wider truncate ${i === activeSugg ? 'text-cyan-300' : 'text-cyan-400'}`}>
                      {i === activeSugg && <span className="text-fuchsia-400 mr-1 animate-pulse">▋</span>}{k.name}
                    </span>
                    <span className="text-[10px] text-fuchsia-400/60 truncate ml-auto shrink-0 max-w-[50%]">{k.desc}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-1.5 text-[10px] text-cyan-900/70 tracking-widest border-t border-cyan-900/20 bg-black">
                ↑↓ navigate · Enter load · Tab complete · Esc dismiss
              </div>
            </div>
          )}

          {/* RAM bar — hidden on kernel home (lives in tty0 there) */}
          {!(activeTab === 'kernel' && !selectedArticle && !architectThesis && !tagCloudView) && (
            <div
              className="hidden md:flex items-center gap-1.5 shrink-0 mr-1"
              title={`ECO-RAM: ${ramPct}% active // planetary cost: ${ecoCost}/100`}
            >
              <span className={`text-[9px] font-black tracking-widest ${isCritical ? 'text-red-500' : isWarning ? 'text-yellow-400/80' : 'text-cyan-900/60'}`}>RAM</span>
              <div className="flex gap-0">
                {Array.from({ length: 100 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-px h-[10px] transition-all duration-700 ${
                      i < ramPct
                        ? isCritical  ? 'ram-bar-critical animate-pulse'
                        : isWarning   ? 'ram-bar-warning'
                        :               'ram-bar-filled'
                        :               'ram-bar-empty'
                    }`}
                  />
                ))}
              </div>
              <span className={`text-[9px] font-black ${isCritical ? 'text-red-500/70' : isWarning ? 'text-yellow-400/60' : 'text-cyan-900/40'}`}>{ramPct}%</span>
              {isRefillReady && (
                <span className="text-[9px] text-fuchsia-400 animate-pulse" title="run re$$ill — lattice refill ready">◆</span>
              )}
            </div>
          )}

          {/* Prompt + input — active on all tabs including kernel home */}
          <div className="flex items-center gap-2 flex-grow min-w-0 relative">
            <span className="text-fuchsia-500 hidden md:inline shrink-0" aria-hidden="true">scale@node:~$</span>
            <span className="text-fuchsia-500 md:hidden shrink-0" aria-hidden="true">~$</span>
            <label htmlFor="terminal-input" className="sr-only">Enter terminal command</label>
            <input
              id="terminal-input"
              ref={terminalInputRef}
              type="text"
              value={commandInput}
              onChange={handleInputChange}
              onKeyDown={handleCommand}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="bg-transparent border-none outline-none flex-grow text-cyan-400 placeholder-cyan-900/50 font-bold"
              placeholder="enter command (e.g. load soma-9.0)"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); submitCommand(); }}
              onTouchEnd={(e) => { e.preventDefault(); submitCommand(); }}
              aria-label="Run command"
              className="shrink-0 px-3 py-0.5 text-xs font-black tracking-widest text-black bg-fuchsia-500 hover:bg-fuchsia-400 active:bg-fuchsia-600 transition-colors duration-150 rounded-sm select-none"
            >
              RUN
            </button>
          </div>
        </div>
      </footer>
      {/* ── Mobile bottom nav (hidden on desktop) ──────────────────────────── */}
      <nav
        aria-label="Mobile navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 h-14 border-t border-cyan-900/40 bg-black flex overflow-x-auto transition-opacity duration-500 ${!mobileChrome ? 'opacity-0 pointer-events-none' : ''}`}
        style={{ willChange: 'opacity, transform', transform: 'translateZ(0)', scrollbarWidth: 'none', msOverflowStyle: 'none', '--beat-delay': beatDelay }}
      >
        <style>{`nav[aria-label="Mobile navigation"]::-webkit-scrollbar { display: none; }`}</style>
        <button onClick={() => handleNav('~/system/kernel', 'kernel')} aria-label="Kernel" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'kernel' ? 'text-cyan-400' : 'text-cyan-400/50'}`}>
          <Cpu className="w-5 h-5" />
        </button>
        <button onClick={() => handleNav('~/system/bsky', 'bsky')} aria-label="BSKY" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'bsky' ? 'text-sky-400' : 'text-sky-400/50'}${beat('bsky')}`}>
          <NavButterflyIcon size="lg" />
        </button>
        <button onClick={() => handleNav('~/system/manifesto', 'manifesto')} aria-label="Manifesto" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'manifesto' ? 'text-violet-400' : 'text-violet-400/50'}${beat('manifesto')}`}>
          <Eye className="w-5 h-5" />
        </button>
        <button onClick={() => handleNav('~/system/transmission', 'transmission')} aria-label="Transmission" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'transmission' ? 'text-purple-400' : 'text-purple-400/50'}${beat('transmission')}`}>
          <Radio className="w-5 h-5" />
        </button>
        <button onClick={() => handleNav('~/system/scaling', 'scaling')} aria-label="Scaling" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'scaling' ? 'text-fuchsia-400' : 'text-fuchsia-400/50'}`}>
          <Scale className="w-5 h-5" />
        </button>
        <button onClick={() => handleNav('~/system/privacy', 'privacy')} aria-label="Privacy" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'privacy' ? 'text-rose-400' : 'text-rose-400/50'}`}>
          <Lock className="w-5 h-5" />
        </button>
        <button onClick={() => handleNav('~/system/surveillance', 'surveillance')} aria-label="Surveillance" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'surveillance' ? 'text-red-400' : 'text-red-400/50'}`}>
          <ShieldAlert className="w-5 h-5" />
        </button>
        <button onClick={() => handleNav('~/system/cryptography', 'cryptography')} aria-label="Cryptography" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'cryptography' ? 'text-orange-400' : 'text-orange-400/50'}`}>
          <KeyRound className="w-5 h-5" />
        </button>
        <button onClick={() => handleNav('~/system/art', 'art')} aria-label="Chaos" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'art' ? 'text-amber-400' : 'text-amber-400/40'}${beat('art')}`}>
          <Waves className="w-5 h-5" />
        </button>
        <button onClick={() => handleNav('~/system/ecocide', 'ecocide')} aria-label="Ecocide" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'ecocide' ? 'text-lime-400' : 'text-lime-400/50'}${beat('ecocide')}`}>
          <Leaf className="w-5 h-5" />
        </button>
        {/* Mercury button removed (Observer spec, option A) — the masthead eye is the
            gateway on mobile too. Ledger before Lunar keeps the spectrum monotonic. */}
        <button onClick={() => handleNav('~/system/ledger', 'ledger')} aria-label="Ledger" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'ledger' ? 'text-teal-400' : 'text-teal-400/50'}${beat('ledger')}`}><span style={{ fontSize: 24, lineHeight: 1 }}>ᛟ</span></button>
        <button onClick={() => handleNav('~/system/lunar', 'lunar')} aria-label="Lunar" className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 ${activeTab === 'lunar' ? 'text-violet-400' : 'text-violet-400/40'}${beat('lunar')}`}>
          <Moon className="w-5 h-5" />
        </button>
      </nav>

      </div>{/* end CRT content wrapper */}

      {/* ── g-mode HUD ── appears when g leader key is pressed ──────────────── */}
      {gMode && (
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] pointer-events-none"
          style={{ animation: 'sk-logIn 0.12s ease forwards' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-sm font-mono"
            style={{
              background:  'rgba(0,0,0,0.92)',
              border:      '1px solid rgba(57,255,20,0.18)',
              boxShadow:   '0 0 20px rgba(57,255,20,0.06)',
              fontSize:    '9px',
              letterSpacing: '0.10em',
              color:       'rgba(57,255,20,0.45)',
              whiteSpace:  'nowrap',
            }}
          >
            <span style={{ color: '#39ff14', fontWeight: 800 }}>g·</span>
            {[
              ['n','kernel'], ['a','chaos'], ['e','eco'], ['s','surv'],
              ['m','mercury'], ['l','lunar'], ['r','ledger'], ['p','privacy'],
            ].map(([k, label]) => (
              <span key={k}>
                <span style={{ color: '#39ff14', fontWeight: 700 }}>{k}</span>
                <span style={{ color: 'rgba(57,255,20,0.30)' }}>:{label}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

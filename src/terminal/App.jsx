// ─── ALL STATIC IMPORTS MUST APPEAR BEFORE ANY EXECUTABLE CODE ──────────────
// ES module spec §15.2.2: ImportDeclaration cannot follow a Statement.
// Rollup (Vite prod bundler) hoists these, but bundler behaviour diverges from
// esbuild (Vite dev). Keep all imports at the top to guarantee identical
// module evaluation order in both environments.
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Hexagon, Cpu, Lock, Scale, Eye, ShieldAlert, KeyRound } from 'lucide-react';

// Data — static (authored, always bundled)
import kernelAxioms    from './data/kernelAxioms';
import kernelBuilds    from './data/kernelBuilds';
import _somaArticles   from './data/articles.soma';   // hand-curated soma kernel entries
import _miscArticles   from './data/articles.misc';   // hand-curated misc/fiction entries
import autoArticles    from './data/loadArticles';    // Vite glob .md stubs (dev fallback)
import wasmRegistry    from '../wasm/wasm.generated';  // compiled Rust kernel WASM module map — 12 kernels
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
import OctagonGrid   from './components/OctagonGrid';
import BootSequence  from './components/BootSequence';

// Hooks
import useSystemLog       from './hooks/useSystemLog';
import { normalizeQuery } from '../lib/normalize';

// KernelTab — static import (landing tab, always needed, avoids .df.js chunk on Firefox Android)
import KernelTab from './views/KernelTab';

// Views — lazy-loaded so each tab bundle is only fetched when first visited
const ScalingTab       = lazy(() => import('./views/ScalingTab'));
const ManifestoTab     = lazy(() => import('./views/ManifestoTab'));
const PrivacyTab       = lazy(() => import('./views/PrivacyTab'));
const SurveillanceTab  = lazy(() => import('./views/SurveillanceTab'));
const BskyTab          = lazy(() => import('./views/BskyTab'));
// ButterflyIcon — inline nav variant (matches BskyTab icon, no extra import needed)
const NavButterflyIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-3 h-3" aria-hidden="true">
    <path d="M11.5 11C9.5 9.5 5.5 7 2.5 8.5C0.5 9.5 1 12 4 13C6.5 13.8 9.5 13 11.5 11Z" />
    <path d="M12.5 11C14.5 9.5 18.5 7 21.5 8.5C23.5 9.5 23 12 20 13C17.5 13.8 14.5 13 12.5 11Z" />
    <path d="M11.5 13.5C9 14 4 15 3 18C2.5 19.5 4.5 21 7.5 19.5C9.5 18.5 11 16.5 11.5 13.5Z" />
    <path d="M12.5 13.5C15 14 20 15 21 18C21.5 19.5 19.5 21 16.5 19.5C14.5 18.5 13 16.5 12.5 13.5Z" />
    <ellipse cx="12" cy="12.5" rx="0.9" ry="3.5" />
  </svg>
);
const ClassifiedTab   = lazy(() => import('./views/ClassifiedTab'));
const ArticleView     = lazy(() => import('./views/ArticleView'));
const ThesisView      = lazy(() => import('./views/ThesisView'));
const TransmissionTab = lazy(() => import('./views/TransmissionTab'));
const TagCloudView    = lazy(() => import('./views/TagCloudView'));

// ── WASM run-command help formatters (pure, no React deps) ─────────────────
function formatKernelHelp(entry) {
  const lines = [
    `  ┌─ ${entry.label}`,
    `  │  ID:      ${entry.id}`,
    `  │  Aliases: ${(entry.aliases ?? []).join(', ')}`,
  ];
  if (entry.params?.length) {
    lines.push(`  │  Parameters:`);
    entry.params.forEach((p, i) => {
      const flags = Object.entries(entry.argMap ?? {})
        .filter(([, idx]) => idx === i)
        .map(([k]) => `--${k}`)
        .join(', ');
      lines.push(`  │    [${i + 1}] ${p.name}  (default: ${p.default})${flags ? `  flags: ${flags}` : ''}`);
      lines.push(`  │        ${p.desc}`);
    });
    const examplePos  = entry.params.map(p => p.default).join(' ');
    const firstFlag   = Object.keys(entry.argMap ?? {})[0] ?? 'param';
    lines.push(`  │  Positional: run ${entry.aliases?.[0] ?? entry.id} ${examplePos}`);
    lines.push(`  │  Named flag: run ${entry.aliases?.[0] ?? entry.id} --${firstFlag} <value>`);
  } else {
    lines.push(`  │  Params: none — static boot diagnostic`);
    lines.push(`  │  Usage:  run ${entry.aliases?.[0] ?? entry.id}`);
  }
  lines.push(`  └──────────────────────────────────────────`);
  return lines;
}

function formatRunHelp(registry) {
  const entries = Object.values(registry);
  const lines = [
    `  RUN_MANIFEST :: ${entries.length} WASM kernel(s) registered`,
    `  ──────────────────────────────────────────────────────────`,
  ];
  for (const e of entries) {
    const paramStr = e.params?.length ? ' ' + e.params.map(p => `[${p.name}]`).join(' ') : '';
    lines.push(`  · run ${e.aliases?.[0] ?? e.id}${paramStr}`);
    lines.push(`      ${e.label}`);
    if (e.params?.length) {
      lines.push(`      defaults: ${e.params.map(p => `${p.name}=${p.default}`).join('  ')}`);
    }
  }
  lines.push(`  ──────────────────────────────────────────────────────────`);
  lines.push(`  Per-kernel help:  run [alias] --help`);
  lines.push(`  Positional args:  run climate 450 3.0 0.5`);
  lines.push(`  Named flags:      run climate --carbon 450 --drag 3.0`);
  return lines;
}

// ── Command manifest for prefix completion — module-level (stable reference) ──
const CMD_MANIFEST = [
  { name: 'load',         desc: 'open a kernel module  e.g. load soma' },
  { name: 'run',          desc: 'execute WASM kernel    e.g. run climate' },
  { name: 'list',         desc: 'show all modules' },
  { name: 'search',       desc: 'filter kernel index    e.g. search quantum' },
  { name: 'help',         desc: 'system command reference' },
  { name: 'clear',        desc: 'clear system log' },
  { name: 'tags',         desc: 'open tag cloud' },
  { name: 'thesis',       desc: 'load architect thesis' },
  { name: 'home',         desc: 'navigate to /kernel' },
  { name: 'scaling',      desc: 'navigate to /scaling' },
  { name: 'transmission', desc: 'navigate to /transmission' },
  { name: 'manifesto',    desc: 'navigate to /manifesto' },
  { name: 'surveillance', desc: 'navigate to /surveillance' },
  { name: 'bsky',         desc: 'navigate to /bsky' },
  { name: 'privacy',      desc: 'navigate to /privacy' },
  { name: 'classified',   desc: 'navigate to /classified — PQC kernel' },
];

const App = () => {
  const [currentPath, setCurrentPath] = useState('~/system/kernel');
  const [activeTab, setActiveTab] = useState('kernel');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [bootSequence, setBootSequence] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingKernel,  setLoadingKernel]  = useState(null);
  const [loadingSignal,  setLoadingSignal]  = useState(null);
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
  // CAS dynamic data — null while manifest fetch is in-flight
  const [dynamicData,  setDynamicData]  = useState(null);

  const { appendSystemLog, setSystemLogs, visibleLogs, logRef } = useSystemLog();

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

  // ── Manifest bootstrap ────────────────────────────────────────────────────────
  // Fetch /kernel/manifest.json on mount, then parallel-fetch all hashed datasets.
  // All outputs are pure JSON — no module evaluation, cache-first in the SW.
  useEffect(() => {
    (async () => {
      const now = new Date().toLocaleTimeString('en-US', { hour12: false });
      try {
        appendSystemLog({ time: now, msg: 'SYSTEM_KERNEL_LOG: Fetching kernel manifest...' });
        const manifest = await fetch('/kernel/manifest.json').then(r => {
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

        const laterTime = new Date().toLocaleTimeString('en-US', { hour12: false });
        appendSystemLog({ time: laterTime, msg: `SYSTEM_KERNEL_LOG: Manifest loaded // ${manifest.generated ?? 'no timestamp'}` });
        appendSystemLog({ time: laterTime, msg: `SYSTEM_KERNEL_LOG: ${generatedArticles.length} kernels // ${academicArticles.length} academic // ${legislationArticles.length} legislation // tags index ready` });

        setDynamicData({ generatedArticles, academicArticles, legislationArticles, tagIndex: tagsJson, systemArticles: systemJson, manifest });

        // ── WASM integrity check ─────────────────────────────────────────────
        // Fetch the WASM binary and verify its SHA-256 against the manifest entry.
        if (manifest.bosonic_lattice?.sha256 && typeof crypto?.subtle?.digest === 'function') {
          try {
            const wasmBuf = await fetch('/wasm/scale94_kernels_bg.wasm').then(r => r.arrayBuffer());
            const hashBuf = await crypto.subtle.digest('SHA-256', wasmBuf);
            const hex     = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            const vt      = new Date().toLocaleTimeString('en-US', { hour12: false });
            if (hex === manifest.bosonic_lattice.sha256) {
              appendSystemLog({ time: vt, msg: `WASM_INTEGRITY: OK // SHA-256 verified`, rust: true });
            } else {
              appendSystemLog({ time: vt, msg: `WASM_INTEGRITY: MISMATCH // expected ${manifest.bosonic_lattice.sha256.slice(0,12)}… got ${hex.slice(0,12)}…` });
            }
          } catch { /* non-fatal — validation best-effort */ }
        }
      } catch (err) {
        console.warn('[KERNEL_LOG] Manifest fetch failed:', err.message);
        const laterTime = new Date().toLocaleTimeString('en-US', { hour12: false });
        appendSystemLog({ time: laterTime, msg: 'SYSTEM_KERNEL_LOG: WARNING — manifest unavailable // degraded mode' });
        appendSystemLog({ time: laterTime, msg: '  Run: npm run kernel:import to generate the CAS manifest.' });
        setDynamicData({ generatedArticles: [], academicArticles: [], legislationArticles: [], tagIndex: {}, systemArticles: {}, manifest: {} });
      }
    })();
  }, [appendSystemLog]);

  const mainRef = useRef(null);
  const kernelListRef = useRef(null); // ref to the scrollable <ul> in KernelTab
  const prevSelectedArticleRef = useRef(null); // tracks previous selectedArticle for mobile scroll logic
  // Scroll persistence: sessionStorage survives tab switches and hot-reloads.
  // The ref is a write-through cache so we never pay a sessionStorage read on
  // every scroll event — only on restore.
  const kernelScrollCache = useRef(
    Number(sessionStorage.getItem('kernelScrollY') || 0)
  );
  // Abort token for handleKernelClick — invalidates in-flight loads when a
  // new one is started (e.g. user rapidly clicks two kernels in quick succession).
  const loadAbortRef = useRef(null);
  // Persistent WASM struct instances — keyed by wasmEntry.id.
  const activeKernels = useRef({});

  // Fiction articles for Transmission tab — updates when CAS data loads
  const transmissionStories = useMemo(() => articles.filter(a => a.type === 'fiction'), [articles]);

  // Legislation articles for Surveillance tab — prefer CAS-fetched entries (have full metadata)
  const legislationArticles = useMemo(
    () => dynamicData?.legislationArticles ?? articles.filter(a => a.type === 'legislation'),
    [dynamicData, articles],
  );

  // Kernel ordering — pinned first, 5 newest by article date, rest alpha-sorted.
  // Re-runs when articles updates (i.e. once CAS data loads) so dates are available.
  const sortedBuilds = useMemo(() => {
    const [pinned, ...rest] = kernelBuilds;
    // Build article-date lookup: article.id → 'YYYY-MM-DD' (empty string if unknown)
    const dateMap = Object.fromEntries(articles.map(a => [a.id, a.date || '']));
    // Annotate each entry with its article date, then partition
    const annotated = rest.map(k => ({ ...k, _date: dateMap[k.articleId] || '' }));
    // Sort descending by date so newest articles float to the top
    annotated.sort((a, b) => (b._date > a._date ? 1 : b._date < a._date ? -1 : 0));
    // Top 5 become the "latest" strip; remainder gets alphabetical sort on name
    const newest5   = annotated.slice(0, 5).map(({ _date, ...k }) => k);
    const alphaRest = annotated.slice(5)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ _date, ...k }) => k);
    return [pinned, ...newest5, ...alphaRest];
  }, [articles]);

  // Filtered subset — used by KernelTab when a search/load filter is active.
  // norm is a stable module-level function — no useCallback wrapper needed.
  // Tag-awareness: also surfaces kernels whose articleId appears in tagIndex
  // entries that match the query — gives `search QUANTUM` access to tag data.
  const norm = normalizeQuery;
  const filteredBuilds = useMemo(() => {
    if (!searchFilter) return sortedBuilds;
    const q = norm(searchFilter);

    // Text match on id / name / desc
    const textMatchIds = new Set(
      sortedBuilds
        .filter(k => norm(k.id).includes(q) || norm(k.name).includes(q) || norm(k.desc || '').includes(q))
        .map(k => k.id)
    );

    // Tag match: collect articleIds from tagIndex entries whose key contains q
    const tagArticleIds = new Set(
      Object.entries(tagIndex)
        .filter(([tag]) => norm(tag).includes(q))
        .flatMap(([, kernels]) => kernels.map(k => k.id))
    );

    if (tagArticleIds.size === 0) {
      return sortedBuilds.filter(k => textMatchIds.has(k.id));
    }

    // Merge — deduplicated, preserving sortedBuilds order
    const seen = new Set();
    return sortedBuilds.filter(k => {
      if (seen.has(k.id)) return false;
      seen.add(k.id);
      return textMatchIds.has(k.id) || tagArticleIds.has(k.articleId);
    });
  }, [sortedBuilds, searchFilter, norm, tagIndex]);

  // Boot completion is signalled by BootSequence itself via onDone — App.jsx no
  // longer needs to know the duration. Memoised so the ref is stable across renders.
  const handleBootDone = useCallback(() => setBootSequence(false), []);

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

  // Scroll to top on initial mount — prevents autoFocus on the footer input
  // from pulling mobile browsers down to the keyboard on first load.
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  // Scroll to top on navigation — mobile-aware surgical patch:
  // On desktop (> 768 px) always scroll to top.
  // On mobile (≤ 768 px) skip the scroll-to-top when returning to the kernel
  // list from an article so the user lands near Active Modules, not Axiomatic Core.
  useLayoutEffect(() => {
    const isMobile = window.innerWidth <= 768;
    const returningToKernel =
      isMobile &&
      prevSelectedArticleRef.current !== null &&
      selectedArticle === null &&
      activeTab === 'kernel';

    prevSelectedArticleRef.current = selectedArticle;

    if (returningToKernel) {
      // Smooth-scroll to the Active Modules container so user lands in context.
      requestAnimationFrame(() => {
        const el = document.getElementById('kernel-container');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    if (mainRef.current) {
      mainRef.current.style.scrollBehavior = 'auto';
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, [currentPath, selectedArticle?.id, activeTab, architectThesis, tagCloudView]);

  // Continuously track the kernel list scroll position via a passive onScroll
  // listener attached directly to the overflow-y-auto <ul>.
  // Re-attaches whenever the KernelTab mounts/unmounts (selectedArticle or
  // activeTab change), because the ref is null while the list is not in the DOM.
  useEffect(() => {
    const el = kernelListRef.current;
    if (!el) return;
    const save = () => {
      const top = el.scrollTop;
      kernelScrollCache.current = top;
      sessionStorage.setItem('kernelScrollY', top);
    };
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [activeTab, selectedArticle]);

  // Restore kernel list scroll position when returning from an article or tab.
  // Double-rAF: first frame = layout committed, second frame = paint committed.
  // A single rAF races on some rendering paths where the flex-grow <ul> hasn't
  // computed its final scrollHeight yet; the second frame guarantees it has.
  // filteredBuilds.length as a dep re-fires if the list contents change size.
  useLayoutEffect(() => {
    if (selectedArticle || activeTab !== 'kernel') return;
    // Read from sessionStorage first (survives tab switches); fall back to cache.
    const saved =
      Number(sessionStorage.getItem('kernelScrollY') || 0) ||
      kernelScrollCache.current;
    if (!saved) return;

    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = kernelListRef.current;
        if (!el) return;
        el.scrollTop = saved;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [selectedArticle, activeTab, filteredBuilds.length]);

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
    appendSystemLog({ time: now.toLocaleTimeString('en-US', { hour12: false }), msg: `Initializing ${kernel.name}...` });

    setTimeout(async () => {
      if (token.aborted) return;

      const later = new Date();
      appendSystemLog({ time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `${kernel.name} loaded successfully.` });
      setLoadingKernel(null);

      if (kernel.articleId) {
        // Priority: auto .md stub (Vite glob, has loadContent) → merged articles array.
        const foundArticle =
          autoArticles.find(a => a.id === kernel.articleId) ??
          articles.find(a => a.id === kernel.articleId);
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
          if (!token.aborted) appendSystemLog({ time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `ERROR: Article ID '${kernel.articleId}' not found.` });
        }
      } else {
        if (!token.aborted) appendSystemLog({ time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `NOTICE: No public file attached.` });
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
  // Calls loadContent() (CAS chunk fetch) if body not yet populated, then
  // shows the article via the standard ArticleView flow.
  const handleLegislationSelect = useCallback(async (law) => {
    if (loadAbortRef.current) loadAbortRef.current.aborted = true;
    const token = { aborted: false };
    loadAbortRef.current = token;
    try {
      const article = law.loadContent ? await law.loadContent() : law;
      if (token.aborted) return;
      setOriginTab('surveillance');
      setSelectedArticle(article);
      setCurrentPath('~/system/surveillance');
      if (mainRef.current) {
        mainRef.current.style.scrollBehavior = 'auto';
        mainRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
      }
    } catch (err) {
      console.error('[SURVEILLANCE] Failed to load legislation article:', err);
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
    const t1 = new Date().toLocaleTimeString('en-US', { hour12: false });
    appendSystemLog({ time: t1, msg: `SIGNAL_INGEST: Acquiring "${story.title}"...` });

    try {
      const article = story.loadContent ? await story.loadContent() : story;
      if (token.aborted) return;

      const t2 = new Date().toLocaleTimeString('en-US', { hour12: false });
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
      const t2 = new Date().toLocaleTimeString('en-US', { hour12: false });
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
    setCurrentPath('~/' + targetTab);
  }, [originTab]);

  const handleNav = useCallback((path, tab) => {
    setCurrentPath(path);
    setActiveTab(tab);
    setSelectedArticle(null);
    setArchitectThesis(false);
    setTagCloudView(false);
    setSearchFilter('');
  }, []);

  // Autocomplete — fires on every keystroke, populates suggestion list
  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setCommandInput(val);
    const trimmed = val.trimStart();
    const lower   = trimmed.toLowerCase();

    if (lower.startsWith('load ')) {
      // ── load <keyword>: kernel fuzzy match ──────────────────────────────
      const q = norm(trimmed.slice(5).trim());
      if (q.length >= 1) {
        setSuggestions(
          kernelBuilds
            .filter(k => norm(k.id).includes(q) || norm(k.name).includes(q))
            .slice(0, 5)
            .map(k => ({ ...k, _type: 'kernel' }))
        );
      } else {
        setSuggestions([]);
      }
      setParamHint('');

    } else if (lower.startsWith('run ')) {
      // ── run <alias>: WASM registry match + param hinting ────────────────
      const afterRun = trimmed.slice(4);
      const parts    = afterRun.trim().split(/\s+/);
      const baseCmd  = parts[0];
      const hasArgs  = parts.length > 1 && afterRun.trim().length > 0;

      if (!baseCmd) {
        // bare `run ` — surface all kernels
        setSuggestions(
          Object.values(wasmRegistry).slice(0, 6).map(e => ({
            id:        e.id,
            name:      e.aliases?.[0] ?? e.id,
            desc:      e.label,
            _type:     'run',
            _complete: `run ${e.aliases?.[0] ?? e.id} `,
          }))
        );
        setParamHint('');
      } else if (!hasArgs) {
        // partial alias — fuzzy match
        const kq      = norm(baseCmd);
        const matches = Object.values(wasmRegistry)
          .filter(e =>
            norm(e.id).includes(kq) ||
            e.aliases?.some(a => norm(a).includes(kq))
          )
          .slice(0, 5)
          .map(e => ({
            id:        e.id,
            name:      e.aliases?.[0] ?? e.id,
            desc:      e.label,
            _type:     'run',
            _complete: `run ${e.aliases?.[0] ?? e.id} `,
          }));
        setSuggestions(matches);
        setParamHint('');
      } else {
        // alias resolved, args being typed — show param hint, dismiss dropdown
        setSuggestions([]);
        const kq    = norm(baseCmd);
        const entry = Object.values(wasmRegistry).find(e =>
          norm(e.id) === kq ||
          e.aliases?.some(a => norm(a) === kq) ||
          norm(e.id).includes(kq) ||
          e.aliases?.some(a => norm(a).includes(kq))
        );
        if (entry?.params?.length) {
          // count how many space-separated args the user has already typed
          const typedArgCount = parts.length - 1;
          const remaining = entry.params
            .slice(typedArgCount)
            .map(p => `[${p.name}]`)
            .join(' ');
          setParamHint(remaining);
        } else {
          setParamHint('');
        }
      }

    } else if (trimmed && !lower.includes(' ')) {
      // ── bare partial: command prefix completion ──────────────────────────
      const matches = CMD_MANIFEST.filter(c => c.name.startsWith(lower)).slice(0, 5);
      setSuggestions(
        matches.map(c => ({
          id:        c.name,
          name:      c.name,
          desc:      c.desc,
          _type:     'cmd',
          _complete: c.name === 'load' || c.name === 'run' || c.name === 'search'
            ? `${c.name} `
            : c.name,
        }))
      );
      setParamHint('');

    } else {
      setSuggestions([]);
      setParamHint('');
    }
    setActiveSugg(-1);
  }, [norm]);

  // Shared: fire a suggestion (from keyboard Enter or click)
  const executeSuggestion = useCallback((item) => {
    setSuggestions([]);
    setActiveSugg(-1);
    setParamHint('');

    // run / cmd completions — fill input, don't navigate
    if (item._type === 'run' || item._type === 'cmd') {
      setCommandInput(item._complete ?? item.name);
      return;
    }

    // kernel load
    setCommandInput('');
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    appendSystemLog({ time: t, msg: `COMMAND: load ${item.name}` });
    appendSystemLog({ time: t, msg: `Locating kernel module "${item.name}"...` });
    handleKernelClick(item);
  }, [appendSystemLog, handleKernelClick]);

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
      setSuggestions([]);
      setActiveSugg(-1);
      const rawCmd = commandInput.trim();
      const cmdParts = rawCmd.toLowerCase().split(' ').filter(Boolean);
      const action = cmdParts[0] ? (cmdParts[0].startsWith('/') ? cmdParts[0].substring(1) : cmdParts[0]) : '';
      const query = cmdParts.slice(1).join(' ');
      setCommandInput('');
      if (rawCmd) {
        setCmdHistory(prev => [rawCmd, ...prev].slice(0, 50));
        setHistoryIdx(-1);
        setSavedInput('');
      }

      const now = new Date().toLocaleTimeString('en-US', { hour12: false });

      const executeCommand = (cmd, result) => {
        appendSystemLog({ time: now, msg: `COMMAND: ${cmd}` });
        appendSystemLog({ time: now, msg: result });
      };

      if (action === 'run') {
        // ── run: WASM-exclusive — articles[] never consulted ─────────────────
        // Snapshot registry at call-time so diagnostic logs reflect reality.
        const currentRegistry = wasmRegistry;
        console.log('[RUN] Registry keys at dispatch:', Object.keys(currentRegistry));

        if (!query) {
          executeCommand(rawCmd, `RUN_FAIL :: No target specified. Try: run vcache_burn | run climate | run bosonic`);
        } else {
          const [baseCmd, ...flagTokens] = query.split(' ').filter(Boolean);

          // ── Global help: `run --help` ─────────────────────────────────────
          if (baseCmd === '--help' || baseCmd === '-h') {
            appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
            setSystemLogs(prev => [
              ...prev,
              ...formatRunHelp(currentRegistry).map(msg => ({ time: now, msg })),
            ].slice(-2000));
            return;
          }

          // ── Arg parser: strip --help, then collect positionals + named flags
          const argTokens      = flagTokens.filter(t => t !== '--help' && t !== '-h' && t !== 'reset');
          const isHelp         = argTokens.length !== flagTokens.length;
          const parsedFlags    = {};
          const positionalArgs = [];
          for (let i = 0; i < argTokens.length; i++) {
            if (argTokens[i].startsWith('--') && argTokens[i + 1] && !argTokens[i + 1].startsWith('--')) {
              parsedFlags[argTokens[i].slice(2)] = parseFloat(argTokens[i + 1]);
              i++;
            } else if (!argTokens[i].startsWith('--') && !isNaN(parseFloat(argTokens[i]))) {
              positionalArgs.push(parseFloat(argTokens[i]));
            }
          }

          // ── Registry lookup (7 tiers) ─────────────────────────────────────
          // 1. exact uppercase key  e.g. "LEVIATHAN-CELLULAR-AUTOMATA"
          // 2. exact as-typed       e.g. "bosonic"
          // 3. norm(id) exact       e.g. norm("BOSONIC-KERNEL-2.0") === norm("bosonic kernel 2")
          // 4. norm(id) contains kq e.g. "leviathancel lularautomata".includes("leviathan")
          // 5. alias exact          e.g. alias "climate" === "climate"
          // 6. alias contains kq    e.g. alias "leviathancel..." includes kq
          // 7. kq contains alias    e.g. "leviathanca".includes("leviathan") — catches leviathan_ca etc.
          const kq = norm(baseCmd);
          const wasmEntry = currentRegistry[baseCmd.toUpperCase()]
            ?? currentRegistry[baseCmd]
            ?? Object.values(currentRegistry).find(e => norm(e.id) === kq)
            ?? Object.values(currentRegistry).find(e => norm(e.id).includes(kq))
            ?? Object.values(currentRegistry).find(e => e.aliases?.some(a => norm(a) === kq))
            ?? Object.values(currentRegistry).find(e => e.aliases?.some(a => norm(a).includes(kq)))
            ?? Object.values(currentRegistry).find(e => e.aliases?.some(a => norm(a).length >= 4 && kq.includes(norm(a))))
            ?? null;

          if (wasmEntry) {
            // ── Per-kernel help: `run climate --help` ──────────────────────
            if (isHelp) {
              appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
              setSystemLogs(prev => [
                ...prev,
                ...formatKernelHelp(wasmEntry).map(msg => ({ time: now, msg })),
              ].slice(-2000));
              return;
            }

            appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
            // Resolve callArgs early so they appear in the boot header
            const callArgs = [...(wasmEntry.args ?? [])];
            positionalArgs.forEach((val, idx) => { if (idx < callArgs.length) callArgs[idx] = val; });
            if (wasmEntry.argMap) {
              for (const [flag, idx] of Object.entries(wasmEntry.argMap)) {
                if (parsedFlags[flag] !== undefined) callArgs[idx] = parsedFlags[flag];
              }
            }
            setSystemLogs(prev => [
              ...prev,
              { time: now, msg: `  WASM_BOOT :: ${wasmEntry.label}` },
              { time: now, msg: `  MODULE: ${wasmEntry.module}` },
              { time: now, msg: `  ARGS: [${callArgs.join(', ')}]` },
              { time: now, msg: `  Instantiating WASM module...` },
            ].slice(-2000));
            (async () => {
              try {
                // eslint-disable-next-line import/no-unresolved
                const mod = await import('../wasm/scale94_kernels.js');
                const wasmUrl = wasmEntry.wasmUrl ?? wasmEntry.module.replace(/\.js$/, '_bg.wasm');
                await mod.default({ module_or_path: wasmUrl });

                const t0 = performance.now();
                let result;
                if (wasmEntry.isStateful) {
                  if (!activeKernels.current[wasmEntry.id]) {
                    activeKernels.current[wasmEntry.id] = new mod[wasmEntry.struct]();
                    setSystemLogs(prev => [
                      ...prev,
                      { time: now, msg: `  KERNEL_INSTANCE_BOOT :: ${wasmEntry.id}` },
                      { time: now, msg: `  new ${wasmEntry.struct}() initialised — state persists across calls` },
                    ].slice(-2000));
                  }
                  const instance = activeKernels.current[wasmEntry.id];
                  if (flagTokens.includes('reset')) {
                    instance.reset();
                    result = `SOMA_KERNEL_5.5 // RESET\nAll state cleared. Year counter reset to 0.\nCall run soma_live to begin a new simulation.`;
                  } else {
                    result = instance[wasmEntry.cycle](...callArgs);
                  }
                } else {
                  result = wasmEntry.fn
                    ? mod[wasmEntry.fn](...callArgs)
                    : mod[wasmEntry.struct][wasmEntry.boot]();
                }
                const elapsed  = (performance.now() - t0).toFixed(4);
                const lines    = result.split('\n');
                const doneTime = new Date().toLocaleTimeString('en-US', { hour12: false });
                setSystemLogs(prev => [
                  ...prev,
                  { time: now,      msg: `  ── KERNEL OUTPUT ─────────────────────────`, rust: true },
                  ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
                  { time: now,      msg: `  ──────────────────────────────────────────`, rust: true },
                  { time: doneTime, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
                ].slice(-2000));
              } catch (err) {
                setSystemLogs(prev => [
                  ...prev,
                  { time: now, msg: `  WASM_RUNTIME_ERROR :: ${err.message}` },
                  { time: now, msg: `  Run: node scripts/import-rust.js  to compile the module.` },
                ].slice(-2000));
              }
            })();
          } else {
            console.log('[RUN_FAIL] Terminal registry keys:', Object.keys(currentRegistry));
            appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
            setSystemLogs(prev => [
              ...prev,
              { time: now, msg: `  RUN_FAIL :: "${baseCmd}" — not found in WASM registry.` },
              { time: now, msg: `  ${Object.keys(currentRegistry).length} kernel(s) available. Try: run vcache_burn | run climate | run bosonic` },
              { time: now, msg: `  Use 'load ${baseCmd}' to open a lore article instead.` },
            ].slice(-2000));
          }
        }
      } else if (['home', 'kernel', 'system'].includes(action)) {
        handleNav('~/system/kernel', 'kernel');
        executeCommand(rawCmd, "Switching directory to /system/kernel...");
      } else if (['scaling', 'services', 'custom'].includes(action)) {
        handleNav('~/system/scaling', 'scaling');
        executeCommand(rawCmd, "Switching directory to /system/scaling...");
      } else if (action === 'transmission') {
        handleNav('~/system/transmission', 'transmission');
        executeCommand(rawCmd, "Switching directory to /system/transmission...");
      } else if (action === 'surveillance' || action === 'panopticon' || action === 'legislation') {
        handleNav('~/system/surveillance', 'surveillance');
        executeCommand(rawCmd, "Switching directory to /system/surveillance...");
      } else if (['research', 'fiction', 'ls'].includes(action)) {
        executeCommand(rawCmd, "ERROR: Target directory purged. Content migrated to external archive.");
      } else if (action === 'bsky' || action === 'bluesky' || action === 'atproto') {
        handleNav('~/system/bsky', 'bsky');
        executeCommand(rawCmd, "Switching directory to /system/bsky...");
      } else if (action === 'privacy') {
        handleNav('~/system/privacy', 'privacy');
        executeCommand(rawCmd, "Switching directory to /system/privacy...");
      } else if (action === 'classified' || action === 'pqc' || action === 'mlkem') {
        handleNav('~/system/classified', 'classified');
        executeCommand(rawCmd, "Switching directory to /system/classified...");
      } else if (action === 'about' || action === 'manifesto') {
        handleNav('~/system/manifesto', 'manifesto');
        executeCommand(rawCmd, "Switching directory to /system/manifesto...");
      } else if (action === 'thesis') {
        handleNav('~/system/scaling/thesis', 'scaling');
        setArchitectThesis(true);
        executeCommand(rawCmd, "Loading ARCHITECT_THESIS...");
      } else if (action === 'load' && query) {
        // normalizeQuery: strip everything except alphanumerics for fuzzy matching
        // "load fish scale 11.4" → "fishscale114"  matches  "FISH_SCALE_KERNEL_11_4_0..."
        const q = norm(query);

        // 1. Search kernelBuilds first — triggers the full handleKernelClick animation
        const kMatches = kernelBuilds.filter(k =>
          norm(k.id).includes(q) ||
          norm(k.name).includes(q) ||
          norm(k.articleId).includes(q)
        );

        if (kMatches.length === 1) {
          appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
          appendSystemLog({ time: now, msg: `Locating kernel module "${kMatches[0].name}"...` });
          handleKernelClick(kMatches[0]);
        } else if (kMatches.length > 1) {
          setActiveTab('kernel');
          setSelectedArticle(null);
          setSearchFilter(query);
          setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
          executeCommand(rawCmd, `${kMatches.length} kernel modules match "${query}". Filter applied.`);
        } else {
          // 2. Fall back to full article search (covers articles not in kernelBuilds panel).
          // Accept both 'kernel_doc' and 'kernel' — frontmatter may use either;
          // import-kernel.js canonicalises to 'kernel_doc' going forward but
          // existing chunks may carry 'kernel' until re-ingested.
          const aMatches = articles.filter(a => (a.type === 'kernel_doc' || a.type === 'kernel') &&
            (norm(a.id).includes(q) ||
             norm(a.title).includes(q) ||
             norm(a.subtitle).includes(q) ||
             (a.tags && a.tags.some(t => norm(t).includes(q))))
          );
          if (aMatches.length === 1) {
            executeCommand(rawCmd, `Loading file '${aMatches[0].id}'...`);
            if (loadAbortRef.current) loadAbortRef.current.aborted = true;
            const cmdToken = { aborted: false };
            loadAbortRef.current = cmdToken;
            (async () => {
              const article = (!aMatches[0].content && aMatches[0].loadContent)
                ? await aMatches[0].loadContent()
                : aMatches[0];
              if (cmdToken.aborted) return;
              setOriginTab('kernel');
              setActiveTab('kernel');
              setSelectedArticle(article);
              setCurrentPath('~/system/kernel');
              setSearchFilter('');
            })();
          } else if (aMatches.length > 1) {
            setActiveTab('kernel');
            setSelectedArticle(null);
            setSearchFilter(query);
            setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
            executeCommand(rawCmd, `${aMatches.length} matches found. Filter applied.`);
          } else {
            // 3. Bunker check — query the Transmission Stream (fiction / signal archive).
            // normalizeQuery ensures "Cigar Heist", "cigar heist", and "Cigar-Heist"
            // all collapse to "cigarheist" before comparison.
            const tMatches = transmissionStories.filter(s =>
              norm(s.id).includes(q) ||
              norm(s.title).includes(q) ||
              norm(s.subtitle || '').includes(q) ||
              (s.tags && s.tags.some(t => norm(t).includes(q)))
            );
            if (tMatches.length === 1) {
              executeCommand(rawCmd, `SIGNAL_INGEST: Routing to transmission "${tMatches[0].title}"...`);
              handleTransmissionSelect(tMatches[0]);
            } else if (tMatches.length > 1) {
              handleNav('~/system/transmission', 'transmission');
              executeCommand(rawCmd, `${tMatches.length} transmissions match "${query}". Switching to Transmission stream.`);
            } else {
              // Sovereign 404 — Signal Lost / Thermodynamic Bloom
              appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
              setSystemLogs(prev => [
                ...prev,
                { time: now, msg: `  SIGNAL_LOST :: "${query}" — no carrier detected.` },
                { time: now, msg: `  SORBE NODE: offline // last contact consumed by the Thermodynamic Bloom` },
                { time: now, msg: `  Entropy has claimed this fragment. The kernel registry holds no record.` },
                { time: now, msg: `  Try: search ${query.toLowerCase().split(' ')[0]} | list | help` },
              ].slice(-2000));
            }
          }
        }
      } else if (action === 'list') {
        executeCommand(rawCmd, `KERNEL_INDEX :: ${kernelBuilds.length} modules`);
        setSystemLogs(prev => [
          ...prev,
          ...kernelBuilds.map(k => ({ time: now, msg: `  · ${k.name}` }))
        ].slice(-2000));
      } else if (action === 'search' && query) {
        const q = norm(query);
        // Collect matching tag entries from the associative index
        const tagHits = Object.entries(tagIndex)
          .filter(([tag]) => norm(tag).includes(q))
          .flatMap(([tag, kernels]) => kernels.map(k => ({ tag, ...k })));
        const uniqueTagHits = [...new Map(tagHits.map(k => [k.id, k])).values()];

        setActiveTab('kernel');
        setSelectedArticle(null);
        setSearchFilter(query);
        setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);

        if (uniqueTagHits.length > 0) {
          appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
          appendSystemLog({ time: now, msg: `TAG INDEX: ${uniqueTagHits.length} tagged kernel(s) for "${query}":` });
          setSystemLogs(prev => [
            ...prev,
            ...uniqueTagHits.slice(0, 10).map(k => ({ time: now, msg: `  · [${k.tag}] ${k.id}` }))
          ].slice(-2000));
        } else {
          executeCommand(rawCmd, `Search filter applied: "${query}". No tag matches found.`);
        }
      } else if (action === 'help') {
        const helpArticle = systemArticles['HELP'];
        if (helpArticle) {
          appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
          appendSystemLog({ time: now, msg: 'Loading SYSTEM_COMMAND_REFERENCE...' });
          setOriginTab(activeTab);
          setSelectedArticle(helpArticle);
        } else {
          executeCommand(rawCmd, 'Commands: load [term], list, search [term], home/kernel, scaling, transmission, manifesto, privacy, thesis, clear, help. ↑↓ history.');
        }
      } else if (action === 'tags') {
        const tagCount    = Object.keys(tagIndex).length;
        const kernelCount = new Set(Object.values(tagIndex).flat().map(k => k.id)).size;
        appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
        appendSystemLog({ time: now, msg: `TAG_INDEX :: ${tagCount} unique tags across ${kernelCount} kernels` });
        setTagCloudView(true);
        setSelectedArticle(null);
        setArchitectThesis(false);
        setActiveTab('kernel');
        setCurrentPath('~/system/kernel/tags');
      } else if (action === 'clear') {
        setSystemLogs([]);
        executeCommand(rawCmd, "System log cleared.");
      } else if (action === 'exit') {
        executeCommand(rawCmd, "Session integrity maintained. Disconnecting terminal interface.");
      } else {
        executeCommand(rawCmd, `ERROR: Command '${action}' not recognized. Type 'help' for assistance.`);
      }
    }
  };

  return (
    <div className={`min-h-screen font-mono selection:bg-fuchsia-900 selection:text-white flex flex-col overflow-hidden relative transition-colors duration-700 ${selectedArticle || architectThesis ? 'bg-[#09090b]' : 'bg-black'}`}>

      {/* ── Boot sequence — unmounts when onDone fires ─────────────────────── */}
      {bootSequence && <BootSequence onDone={handleBootDone} />}

      {/*
       * ── Global scanlines — permanent, root-level, never unmounted ─────────
       * Rendered unconditionally so the bs-scan animation runs in one
       * unbroken loop from boot through every route/view change.
       * Removing the bootSequence gate was the only change needed: the
       * browser compositor keeps the animation position intact as long as
       * the DOM node stays mounted.
       * z-[101]: above BootSequence (z-100) and the boot overlay (z-97).
       * pointer-events: none on both divs — zero interaction impact.
       */}
      {/*
       * ── CRT scanline texture — fixed, z-2, BEHIND all content ────────────
       * Keeping z-index LOW (2) means the scanlines sit beneath the main UI
       * layers (header z-40, main z-10) and never visually stripe text or
       * nav buttons. The effect reads as subtle screen texture on the dark
       * terminal background while leaving all foreground elements clean.
       * Opacity 0.05 — barely perceptible as intended; no mix-blend-mode
       * so behaviour is compositor-predictable on all browsers/screens.
       */}
      <div style={{
        position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
        zIndex: 2,
        pointerEvents: 'none', userSelect: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 3px)',
        transition: 'none',
        transform: 'translateZ(0)',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
        pointerEvents: 'none', userSelect: 'none', zIndex: 101,
        background: 'linear-gradient(transparent, rgba(6,182,212,0.5), transparent)',
        animation: 'bs-scan 0.9s linear 1 forwards',
        transition: 'none',
        transform: 'translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }} />

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
       * ── Unified global reveal mask + render beam ────────────────────────────
       * Mounts in the same React commit that unmounts BootSequence.
       * No clip-path, no opacity transition — pure GPU translateY.
       *
       * Mask (z-49): solid black div slides from translateY(0) → translateY(100vh)
       *   in 0.9s linear. Covers the main UI (z-10 / z-40 header) while passing.
       *   forwards: parks off-screen below viewport, never blocks interaction.
       *   pointerEvents: none — never traps clicks.
       *
       * Beam (z-50): 3px line travels with the mask edge via the same translateY
       *   animation. Opacity fades in at 5% and out at 95% to avoid hard edges.
       *
       * Both use translate3d(0,0,0) + willChange + backfaceVisibility for GPU subpixel locking.
       */}
      {!bootSequence && (
        <>
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#000',
            zIndex: 49,
            animation: 'global-reveal-mask 1.2s linear forwards',
            transform: 'translate3d(0,0,0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            perspective: '1000px',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: '3px',
            zIndex: 50, pointerEvents: 'none',
            background: 'linear-gradient(transparent, rgba(6,182,212,0.9) 50%, transparent)',
            boxShadow: '0 0 12px rgba(6,182,212,0.6), 0 0 28px rgba(6,182,212,0.2)',
            animation: 'global-beam 1.2s linear forwards',
            transform: 'translate3d(0,0,0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            perspective: '1000px',
          }} />
        </>
      )}

      {/*
       * ── Terminal content ────────────────────────────────────────────────────
       * No clip-path. The UI renders normally at all times. During boot,
       * BootSequence (z-100) covers it. After boot, the global-reveal-mask
       * (z-49) slides down — both mount in the same React commit so there
       * is no single-frame flash between BootSequence unmounting and the
       * mask appearing.
       */}
      <div className="flex flex-col flex-grow">
        <OctagonGrid visible={!selectedArticle && !architectThesis && !tagCloudView} />

      {/* ── Offline indicator ─────────────────────────────────────────────── */}
      {!isOnline && (
        <div className="sticky top-0 z-[45] flex items-center justify-center gap-2 bg-amber-950/95 border-b border-amber-500/40 py-1 text-[10px] font-bold tracking-widest text-amber-400 font-mono uppercase backdrop-blur">
          <span className="animate-pulse">●</span>
          OFFLINE MODE // SERVING FROM CACHE // SORBE NODE UNREACHABLE
        </div>
      )}

      <header className="border-b border-cyan-900/30 bg-black/90 p-4 sticky top-0 z-40 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.1)] overflow-x-hidden w-full">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 w-full min-w-0">
          <div className="flex items-center gap-2 group cursor-pointer shrink-0" onClick={() => handleNav('~/system/kernel', 'kernel')}>
            <Hexagon className="w-5 h-5 text-fuchsia-500 animate-spin-slow group-hover:text-cyan-400 transition-colors" />
            <span className="font-bold tracking-widest text-lg lowercase text-[#39ff14] group-hover:text-cyan-400 transition-colors">scale_9.4</span>
          </div>
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm font-bold tracking-wide min-w-0 w-full md:w-auto">
            <button aria-label="Kernel" aria-current={activeTab === 'kernel' ? 'page' : undefined} onClick={() => handleNav('~/system/kernel', 'kernel')} className={`${activeTab === 'kernel' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-cyan-500 hover:text-white hover:bg-cyan-900/30'} px-4 py-1.5 transition-all duration-300 flex items-center gap-2 uppercase rounded-sm`}><Cpu className="w-3 h-3" /> /Kernel</button>

            <button aria-label="Scaling" aria-current={activeTab === 'scaling' ? 'page' : undefined} onClick={() => handleNav('~/system/scaling', 'scaling')} className={`${activeTab === 'scaling' ? 'bg-fuchsia-500 text-black shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'text-fuchsia-500 hover:text-white hover:bg-fuchsia-900/30'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm flex items-center gap-2`}><Scale className="w-3 h-3" /> /Scaling</button>

            <button aria-label="Transmission" aria-current={activeTab === 'transmission' ? 'page' : undefined} onClick={() => handleNav('~/system/transmission', 'transmission')} className={`${activeTab === 'transmission' ? 'bg-fuchsia-500 text-black shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'text-fuchsia-500 hover:text-white hover:bg-fuchsia-900/30'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm`}>⌖ /Transmission</button>

            <button aria-label="Manifesto" aria-current={activeTab === 'manifesto' ? 'page' : undefined} onClick={() => handleNav('~/system/manifesto', 'manifesto')} className={`${activeTab === 'manifesto' ? 'bg-cyan-900 text-cyan-100 shadow-[0_0_10px_rgba(22,78,99,0.5)]' : 'text-cyan-500 hover:text-white hover:bg-cyan-900/30'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm`}><Eye className="w-3 h-3" /> /Manifesto</button>
            <button aria-label="Privacy" aria-current={activeTab === 'privacy' ? 'page' : undefined} onClick={() => handleNav('~/system/privacy', 'privacy')} className={`${activeTab === 'privacy' ? 'bg-gray-700 text-white shadow-[0_0_10px_rgba(100,100,100,0.5)]' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/30'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm`}><Lock className="w-3 h-3" /> /Privacy</button>

            <button aria-label="Surveillance" aria-current={activeTab === 'surveillance' ? 'page' : undefined} onClick={() => handleNav('~/system/surveillance', 'surveillance')} className={`${activeTab === 'surveillance' ? 'bg-red-900 text-red-100 shadow-[0_0_10px_rgba(248,113,113,0.4)]' : 'text-red-500/70 hover:text-red-300 hover:bg-red-900/20'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm flex items-center gap-2`}><ShieldAlert className="w-3 h-3" /> /Surveillance</button>

            <button aria-label="BSKY" aria-current={activeTab === 'bsky' ? 'page' : undefined} onClick={() => handleNav('~/system/bsky', 'bsky')} className={`${activeTab === 'bsky' ? 'bg-sky-600 text-white shadow-[0_0_12px_rgba(56,189,248,0.5)]' : 'text-sky-400/80 hover:text-sky-200 hover:bg-sky-900/20'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm flex items-center gap-2`}><NavButterflyIcon /> /BSKY</button>
            <button aria-label="Classified" aria-current={activeTab === 'classified' ? 'page' : undefined} onClick={() => handleNav('~/system/classified', 'classified')} className={`${activeTab === 'classified' ? 'bg-green-900 text-green-100 shadow-[0_0_10px_rgba(74,222,128,0.4)]' : 'text-green-500/70 hover:text-green-300 hover:bg-green-900/20'} px-4 py-1.5 transition-all duration-300 uppercase rounded-sm flex items-center gap-2`}><KeyRound className="w-3 h-3" /> /Classified</button>
          </nav>
        </div>
      </header>

      <main ref={mainRef} className="flex-grow overflow-y-auto overflow-x-hidden p-4 md:p-8 relative z-10 scroll-smooth" style={{ scrollPaddingTop: '100px' }}>
        <Suspense fallback={<div className="text-cyan-400 font-mono tracking-widest animate-pulse p-8">{'// LOADING MODULE...'}</div>}>
        <div className="max-w-[1600px] mx-auto">
          <div className="mb-8 flex items-center text-sm font-bold tracking-wider min-w-0 overflow-hidden">
            <span className="mr-2 text-fuchsia-500">scale@node:</span>
            <span className="text-cyan-300">{currentPath}</span>
            {selectedArticle && <span className="ml-0 text-cyan-400">/{selectedArticle.id}</span>}
            {architectThesis && <span className="ml-0 text-cyan-400">/thesis_log</span>}
            <span className="animate-pulse ml-2 inline-block w-2 h-4 bg-fuchsia-500 align-middle shadow-[0_0_8px_rgba(217,70,239,0.8)]"></span>
          </div>

          {/* Kernel Tab */}
          {activeTab === 'kernel' && !selectedArticle && !tagCloudView && (
            <KernelTab
              kernelAxioms={kernelAxioms}
              kernelBuilds={filteredBuilds}
              handleKernelClick={handleKernelClick}
              loadingKernel={loadingKernel}
              visibleLogs={visibleLogs}
              logRef={logRef}
              searchFilter={searchFilter}
              onClearFilter={() => setSearchFilter('')}
              listRef={kernelListRef}
            />
          )}

          {/* Scaling Tab */}
          {activeTab === 'scaling' && !selectedArticle && !architectThesis && (
            <ScalingTab
              setArchitectThesis={setArchitectThesis}
              setCurrentPath={setCurrentPath}
              loadKernel={handleNeuralLink}
            />
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
            <ManifestoTab systemArticles={systemArticles} />
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

          {/* Classified Tab — ML-KEM-768 PQC + Gray-Scott kernel reference */}
          {activeTab === 'classified' && !selectedArticle && !architectThesis && (
            <ClassifiedTab />
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

          {/* Tag Cloud */}
          {tagCloudView && !selectedArticle && (
            <TagCloudView handleReturnToRoot={handleReturnToRoot} tagIndex={tagIndex} />
          )}
        </div>
        </Suspense>
      </main>

      <footer className="border-t border-cyan-900/50 p-2 bg-black/90 backdrop-blur-md z-40 shadow-[0_0_15px_rgba(6,182,212,0.1)] [overflow-x:clip] w-full">
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

          <span className="text-fuchsia-500 hidden md:inline" aria-hidden="true">scale@node:~$</span>
          <span className="text-fuchsia-500 md:hidden" aria-hidden="true">~$</span>
          <label htmlFor="terminal-input" className="sr-only">Enter terminal command</label>
          <input
            id="terminal-input"
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
        </div>
      </footer>
      </div>{/* end CRT content wrapper */}
    </div>
  );
};

export default App;

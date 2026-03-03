// ─── ALL STATIC IMPORTS MUST APPEAR BEFORE ANY EXECUTABLE CODE ──────────────
// ES module spec §15.2.2: ImportDeclaration cannot follow a Statement.
// Rollup (Vite prod bundler) hoists these, but bundler behaviour diverges from
// esbuild (Vite dev). Keep all imports at the top to guarantee identical
// module evaluation order in both environments.
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Hexagon, Cpu, Lock, Scale, Eye } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

// Data
import kernelAxioms    from './data/kernelAxioms';
import kernelBuilds    from './data/kernelBuilds';
import staticArticles  from './data/articles';      // existing articles — keeps kernelBuilds IDs intact
import autoArticles    from './data/loadArticles';   // auto-loaded .md files from content/soma_kernel

// Components
import OctagonGrid   from './components/OctagonGrid';
import BootSequence  from './components/BootSequence';

// Hooks
import useSystemLog  from './hooks/useSystemLog';

// KernelTab — static import (landing tab, always needed, avoids .df.js chunk on Firefox Android)
import KernelTab from './views/KernelTab';

// Views — lazy-loaded so each tab bundle is only fetched when first visited
const ScalingTab      = lazy(() => import('./views/ScalingTab'));
const ManifestoTab    = lazy(() => import('./views/ManifestoTab'));
const PrivacyTab      = lazy(() => import('./views/PrivacyTab'));
const ArticleView     = lazy(() => import('./views/ArticleView'));
const ThesisView      = lazy(() => import('./views/ThesisView'));
const TransmissionTab = lazy(() => import('./views/TransmissionTab'));

// ─── MODULE-LEVEL DERIVED DATA ────────────────────────────────────────────────
// Normalise a title for duplicate detection — strips everything except a-z and digits.
const normaliseTitle = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Merge: static articles always win (they carry the exact IDs kernelBuilds references).
// Auto-loaded .md files are only appended when genuinely new.
const staticIds    = new Set(staticArticles.map(a => a.id));
const staticTitles = new Set(staticArticles.map(a => normaliseTitle(a.title)));
const articles     = [
  ...staticArticles,
  ...autoArticles.filter(a =>
    !staticIds.has(a.id) && !staticTitles.has(normaliseTitle(a.title))
  ),
];

const App = () => {
  const [currentPath, setCurrentPath] = useState('~/system/kernel');
  const [activeTab, setActiveTab] = useState('kernel');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [bootSequence, setBootSequence] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingKernel, setLoadingKernel] = useState(null);
  const [originTab, setOriginTab] = useState('kernel');
  const [architectThesis, setArchitectThesis] = useState(false);
  const [suggestions, setSuggestions]   = useState([]);
  const [activeSugg,   setActiveSugg]   = useState(-1);
  const [cmdHistory,   setCmdHistory]   = useState([]);   // most-recent first
  const [historyIdx,   setHistoryIdx]   = useState(-1);   // -1 = live input
  const [savedInput,   setSavedInput]   = useState('');

  const { appendSystemLog, setSystemLogs, visibleLogs, logRef } = useSystemLog();

  const mainRef = useRef(null);

  // Fiction articles for Transmission tab — memoised (articles is module-level, never changes)
  const transmissionStories = useMemo(() => articles.filter(a => a.type === 'fiction'), []);

  // Kernel ordering — pinned first, rest reversed. kernelBuilds is a static import so [] dep is safe.
  const sortedBuilds = useMemo(() => {
    const [pinned, ...rest] = kernelBuilds;
    return [pinned, ...rest.slice().reverse()];
  }, []);

  // Filtered subset — used by KernelTab when a search/load filter is active.
  const norm = useCallback((s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), []);
  const filteredBuilds = useMemo(() => {
    if (!searchFilter) return sortedBuilds;
    const q = norm(searchFilter);
    return sortedBuilds.filter(k =>
      norm(k.id).includes(q) || norm(k.name).includes(q) || norm(k.desc || '').includes(q)
    );
  }, [sortedBuilds, searchFilter, norm]);

  // Boot completion is signalled by BootSequence itself via onDone — App.jsx no
  // longer needs to know the duration. Memoised so the ref is stable across renders.
  const handleBootDone = useCallback(() => setBootSequence(false), []);

  // Scroll to top on initial mount — prevents autoFocus on the footer input
  // from pulling mobile browsers down to the keyboard on first load.
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  // Scroll to top on navigation
  useLayoutEffect(() => {
    if (mainRef.current) {
      mainRef.current.style.scrollBehavior = 'auto';
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, [currentPath, selectedArticle, activeTab, architectThesis]);

  // Handle loading a kernel module
  const handleKernelClick = useCallback((kernel) => {
    if (loadingKernel) return;
    setLoadingKernel(kernel.id);
    const now = new Date();
    appendSystemLog({ time: now.toLocaleTimeString('en-US', { hour12: false }), msg: `Initializing ${kernel.name}...` });

    setTimeout(() => {
      const later = new Date();
      appendSystemLog({ time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `${kernel.name} loaded successfully.` });
      setLoadingKernel(null);

      if (kernel.articleId) {
        const foundArticle = articles.find(a => a.id === kernel.articleId);
        if (foundArticle) {
          setOriginTab('kernel');
          setSelectedArticle(foundArticle);
          setCurrentPath('~/system/kernel');
          if (mainRef.current) {
            mainRef.current.style.scrollBehavior = 'auto';
            mainRef.current.scrollTop = 0;
            window.scrollTo(0, 0);
          }
        } else {
          appendSystemLog({ time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `ERROR: Article ID '${kernel.articleId}' not found.` });
        }
      } else {
        appendSystemLog({ time: later.toLocaleTimeString('en-US', { hour12: false }), msg: `NOTICE: No public file attached.` });
      }
    }, 1200);
  }, [loadingKernel, appendSystemLog]);

  const handleReturnToRoot = useCallback(() => {
    const targetTab = originTab === 'kernel_doc' || originTab === 'kernel' ? 'kernel' : originTab;
    setSelectedArticle(null);
    setArchitectThesis(false);
    setActiveTab(targetTab);
    setCurrentPath('~/' + targetTab);
  }, [originTab]);

  const handleNav = useCallback((path, tab) => {
    setCurrentPath(path);
    setActiveTab(tab);
    setSelectedArticle(null);
    setArchitectThesis(false);
    setSearchFilter('');
  }, []);

  // Autocomplete — fires on every keystroke, populates suggestion list
  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setCommandInput(val);
    const trimmed = val.trimStart();
    if (trimmed.toLowerCase().startsWith('load ')) {
      const q = norm(trimmed.slice(5).trim());
      if (q.length >= 1) {
        setSuggestions(
          kernelBuilds
            .filter(k => norm(k.id).includes(q) || norm(k.name).includes(q))
            .slice(0, 5)
        );
      } else {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
    setActiveSugg(-1);
  }, [norm]);

  // Shared: fire a suggestion (from keyboard Enter or click)
  const executeSuggestion = useCallback((kernel) => {
    setSuggestions([]);
    setActiveSugg(-1);
    setCommandInput('');
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    appendSystemLog({ time: t, msg: `COMMAND: load ${kernel.name}` });
    appendSystemLog({ time: t, msg: `Locating kernel module "${kernel.name}"...` });
    handleKernelClick(kernel);
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
        setCommandInput(`load ${k.name}`);
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

      if (['home', 'kernel', 'system'].includes(action)) {
        handleNav('~/system/kernel', 'kernel');
        executeCommand(rawCmd, "Switching directory to /system/kernel...");
      } else if (['scaling', 'services', 'custom'].includes(action)) {
        handleNav('~/system/scaling', 'scaling');
        executeCommand(rawCmd, "Switching directory to /system/scaling...");
      } else if (action === 'transmission') {
        handleNav('~/system/transmission', 'transmission');
        executeCommand(rawCmd, "Switching directory to /system/transmission...");
      } else if (['research', 'fiction', 'ls'].includes(action)) {
        executeCommand(rawCmd, "ERROR: Target directory purged. Content migrated to external archive.");
      } else if (action === 'privacy') {
        handleNav('~/system/privacy', 'privacy');
        executeCommand(rawCmd, "Switching directory to /system/privacy...");
      } else if (action === 'about' || action === 'manifesto') {
        handleNav('~/system/manifesto', 'manifesto');
        executeCommand(rawCmd, "Switching directory to /system/manifesto...");
      } else if (action === 'thesis') {
        handleNav('~/system/scaling/thesis', 'scaling');
        setArchitectThesis(true);
        executeCommand(rawCmd, "Loading ARCHITECT_THESIS...");
      } else if (action === 'load' && query) {
        // Normalise: strip everything except alphanumerics for fuzzy matching
        // "load fish scale 11.4" → "fishscale114"  matches  "FISH_SCALE_KERNEL_11_4_0..."
        const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
          // 2. Fall back to full article search (covers articles not in kernelBuilds panel)
          const aMatches = articles.filter(a => a.type === 'kernel_doc' &&
            (norm(a.id).includes(q) ||
             norm(a.title).includes(q) ||
             norm(a.subtitle).includes(q) ||
             (a.tags && a.tags.some(t => norm(t).includes(q))))
          );
          if (aMatches.length === 1) {
            setOriginTab('kernel');
            setActiveTab('kernel');
            setSelectedArticle(aMatches[0]);
            setCurrentPath('~/system/kernel');
            setSearchFilter('');
            executeCommand(rawCmd, `Loading file '${aMatches[0].id}'...`);
          } else if (aMatches.length > 1) {
            setActiveTab('kernel');
            setSelectedArticle(null);
            setSearchFilter(query);
            setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
            executeCommand(rawCmd, `${aMatches.length} matches found. Filter applied.`);
          } else {
            executeCommand(rawCmd, `ERROR: Object '${query}' not found in kernel index.`);
          }
        }
      } else if (action === 'list') {
        executeCommand(rawCmd, `KERNEL_INDEX :: ${kernelBuilds.length} modules`);
        setSystemLogs(prev => [
          ...prev,
          ...kernelBuilds.map(k => ({ time: now, msg: `  · ${k.name}` }))
        ].slice(-2000));
      } else if (action === 'search' && query) {
        setActiveTab('kernel');
        setSelectedArticle(null);
        setSearchFilter(query);
        setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
        executeCommand(rawCmd, `Applying search filter to kernel index: "${query}".`);
      } else if (action === 'help') {
        executeCommand(rawCmd, "Commands: load [term], list, search [term], home/kernel, scaling, transmission, manifesto, privacy, thesis, clear, help. ↑↓ history.");
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

  // --- BOOT SEQUENCE ---
  if (bootSequence) {
    return <BootSequence onDone={handleBootDone} />;
  }

  return (
    <div className={`min-h-screen font-mono selection:bg-fuchsia-900 selection:text-white flex flex-col overflow-hidden relative transition-colors duration-700 ${selectedArticle || architectThesis ? 'bg-[#09090b]' : 'bg-black'}`}>
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
      <OctagonGrid visible={!selectedArticle && !architectThesis} />

      <Analytics />

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
          </nav>
        </div>
      </header>

      <main ref={mainRef} className="flex-grow overflow-y-auto overflow-x-hidden p-4 md:p-8 relative z-10 scroll-smooth">
        <Suspense fallback={<div className="text-cyan-400 font-mono tracking-widest animate-pulse p-8">// LOADING MODULE...</div>}>
        <div className="max-w-[1600px] mx-auto">
          <div className="mb-8 flex items-center text-sm font-bold tracking-wider min-w-0 overflow-hidden">
            <span className="mr-2 text-fuchsia-500">scale@node:</span>
            <span className="text-cyan-300">{currentPath}</span>
            {selectedArticle && <span className="ml-0 text-cyan-400">/{selectedArticle.id}</span>}
            {architectThesis && <span className="ml-0 text-cyan-400">/thesis_log</span>}
            <span className="animate-pulse ml-2 inline-block w-2 h-4 bg-fuchsia-500 align-middle shadow-[0_0_8px_rgba(217,70,239,0.8)]"></span>
          </div>

          {/* Kernel Tab */}
          {activeTab === 'kernel' && !selectedArticle && (
            <KernelTab
              kernelAxioms={kernelAxioms}
              kernelBuilds={filteredBuilds}
              handleKernelClick={handleKernelClick}
              loadingKernel={loadingKernel}
              visibleLogs={visibleLogs}
              logRef={logRef}
              searchFilter={searchFilter}
              onClearFilter={() => setSearchFilter('')}
            />
          )}

          {/* Scaling Tab */}
          {activeTab === 'scaling' && !selectedArticle && !architectThesis && (
            <ScalingTab
              setArchitectThesis={setArchitectThesis}
              setCurrentPath={setCurrentPath}
            />
          )}

          {/* Architect Thesis View */}
          {architectThesis && (
            <ThesisView handleReturnToRoot={handleReturnToRoot} />
          )}

          {/* Transmission Tab */}
          {activeTab === 'transmission' && !selectedArticle && !architectThesis && (
            <TransmissionTab
              stories={transmissionStories}
              onSelect={(story) => {
                setOriginTab('transmission');
                setSelectedArticle(story);
                setCurrentPath('~/system/transmission');
              }}
            />
          )}

          {/* Manifesto Tab */}
          {activeTab === 'manifesto' && !selectedArticle && !architectThesis && (
            <ManifestoTab />
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && !selectedArticle && !architectThesis && (
            <PrivacyTab />
          )}

          {/* Article Detail */}
          {selectedArticle && (
            <ArticleView
              article={selectedArticle}
              originTab={originTab}
              handleReturnToRoot={handleReturnToRoot}
            />
          )}
        </div>
        </Suspense>
      </main>

      <footer className="border-t border-cyan-900/50 p-2 bg-black/90 backdrop-blur-md z-40 shadow-[0_0_15px_rgba(6,182,212,0.1)] [overflow-x:clip] w-full">
        <div className="max-w-[1600px] mx-auto relative flex items-center gap-2 text-sm font-bold tracking-wide min-w-0 w-full">

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
    </div>
  );
};

export default App;

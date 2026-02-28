import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Hexagon, Cpu, Lock, Scale, Eye } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

// Data
import kernelAxioms from './data/kernelAxioms';
import kernelBuilds from './data/kernelBuilds';
import staticArticles from './data/articles';     // existing articles — keeps kernelBuilds IDs intact
import autoArticles   from './data/loadArticles'; // auto-loaded .md files from content/soma_kernel

// Normalise a title for duplicate detection — strips everything except a-z and digits.
// e.g. "FISH SCALE KERNEL 11.1.1" and "FISH_SCALE_KERNEL11.1.1" both → "fishscalekernel1111"
const normaliseTitle = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Merge: static articles always win (they carry the exact IDs kernelBuilds references).
// Auto-loaded .md files are only appended when they are genuinely new — i.e. not already
// covered by articles.js either by ID or by normalised title.
const staticIds     = new Set(staticArticles.map(a => a.id));
const staticTitles  = new Set(staticArticles.map(a => normaliseTitle(a.title)));
const articles      = [
  ...staticArticles,
  ...autoArticles.filter(a =>
    !staticIds.has(a.id) && !staticTitles.has(normaliseTitle(a.title))
  ),
];

// Components
import OctagonGrid from './components/OctagonGrid';
import BootSequence from './components/BootSequence';

// Hooks
import useSystemLog from './hooks/useSystemLog';

// Views
import KernelTab from './views/KernelTab';
import ScalingTab from './views/ScalingTab';
import ManifestoTab from './views/ManifestoTab';
import PrivacyTab from './views/PrivacyTab';
import ArticleView from './views/ArticleView';
import ThesisView from './views/ThesisView';
import TransmissionTab from './views/TransmissionTab';

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

  const { appendSystemLog, setSystemLogs, visibleLogs, logRef } = useSystemLog();

  const mainRef = useRef(null);

  // Fiction articles for Transmission tab
  const transmissionStories = articles.filter(a => a.type === 'fiction');

  // searchFilter is set by the 'search' terminal command but the results panel
  // is not yet wired to a view — keeping the state for future use.

  useEffect(() => {
    const timer = setTimeout(() => setBootSequence(false), 2000);
    return () => clearTimeout(timer);
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
  const handleKernelClick = (kernel) => {
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
  };

  const handleReturnToRoot = () => {
    const targetTab = originTab === 'kernel_doc' || originTab === 'kernel' ? 'kernel' : originTab;
    setSelectedArticle(null);
    setArchitectThesis(false);
    setActiveTab(targetTab);
    setCurrentPath('~/' + targetTab);
  };

  const handleNav = (path, tab) => {
    setCurrentPath(path);
    setActiveTab(tab);
    setSelectedArticle(null);
    setArchitectThesis(false);
    setSearchFilter('');
  };

  // Command handler
  const handleCommand = (e) => {
    if (e.key === 'Enter') {
      const rawCmd = commandInput.trim();
      const cmdParts = rawCmd.toLowerCase().split(' ').filter(Boolean);
      const action = cmdParts[0] ? (cmdParts[0].startsWith('/') ? cmdParts[0].substring(1) : cmdParts[0]) : '';
      const query = cmdParts.slice(1).join(' ');
      setCommandInput('');

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
        const matches = articles.filter(a => a.type === 'kernel_doc' &&
          ((a.id || '').toLowerCase().includes(query) ||
          (a.title || '').toLowerCase().includes(query) ||
          (a.subtitle || '').toLowerCase().includes(query) ||
          (a.tags && a.tags.some(t => t.toLowerCase().includes(query))))
        );
        if (matches.length === 1) {
          const match = matches[0];
          const targetTab = match.type === 'kernel_doc' ? 'kernel' : match.type;
          setOriginTab(targetTab);
          setActiveTab(targetTab);
          setSelectedArticle(match);
          setCurrentPath(`~/system/${targetTab}`);
          setSearchFilter('');
          executeCommand(rawCmd, `Loading file '${match.id}'...`);
        } else if (matches.length > 1) {
          setActiveTab('kernel');
          setSelectedArticle(null);
          setSearchFilter(query);
          setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
          executeCommand(rawCmd, `Multiple kernel matches found. Applying filter "${query}".`);
        } else {
          executeCommand(rawCmd, `ERROR: Object '${query}' not found in local kernel index. Check external archive.`);
        }
      } else if (action === 'search' && query) {
        setActiveTab('kernel');
        setSelectedArticle(null);
        setSearchFilter(query);
        setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
        executeCommand(rawCmd, `Applying search filter to kernel index: "${query}".`);
      } else if (action === 'help') {
        executeCommand(rawCmd, "Available commands: load [id/term], search [term], home/kernel, scaling, transmission, manifesto, privacy, thesis, clear, help.");
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
    return <BootSequence />;
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
        <div className="max-w-[1600px] mx-auto">
          <div className="mb-8 flex items-center text-sm font-bold tracking-wider min-w-0 overflow-hidden">
            <span className="mr-2 text-fuchsia-500">scale@node:</span>
            <span className="text-cyan-300">{currentPath}</span>
            {selectedArticle && <span className="ml-0 text-cyan-400">/{selectedArticle.id}</span>}
            {architectThesis && <span className="ml-0 text-cyan-400">/thesis_log</span>}
            <span className="animate-pulse ml-2 inline-block w-2 h-4 bg-fuchsia-500 align-middle shadow-[0_0_8px_rgba(217,70,239,0.8)]"></span>
          </div>

          {/* Kernel Tab */}
          {activeTab === 'kernel' && !selectedArticle && (() => {
            // Build a date-lookup map from the merged articles array
            const dateMap = new Map(articles.map(a => [a.id, a.date || '']));
            // Pin FISH_SCALE_11.1 first, then sort the rest newest → oldest by article date.
            // Tiebreak by original array position descending so newly-appended entries
            // (no date yet) still surface at the top rather than sinking to the bottom.
            const [pinned, ...rest] = kernelBuilds;
            const sortedBuilds = [
              pinned,
              ...rest
                .map((k, i) => ({ k, i }))
                .sort((a, b) => {
                  const dateA = dateMap.get(a.k.articleId) || '';
                  const dateB = dateMap.get(b.k.articleId) || '';
                  if (dateA !== dateB) return dateB.localeCompare(dateA); // newest date first
                  return b.i - a.i;                                        // tiebreak: last in array → shown first
                })
                .map(({ k }) => k),
            ];
            return (
              <KernelTab
                kernelAxioms={kernelAxioms}
                kernelBuilds={sortedBuilds}
                handleKernelClick={handleKernelClick}
                loadingKernel={loadingKernel}
                visibleLogs={visibleLogs}
                logRef={logRef}
              />
            );
          })()}

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
      </main>

      <footer className="border-t border-cyan-900/50 p-2 bg-black/90 backdrop-blur-md z-40 shadow-[0_0_15px_rgba(6,182,212,0.1)] overflow-x-hidden w-full">
        <div className="max-w-[1600px] mx-auto flex items-center gap-2 text-sm font-bold tracking-wide min-w-0 w-full">
          <span className="text-fuchsia-500 hidden md:inline" aria-hidden="true">scale@node:~$</span>
          <span className="text-fuchsia-500 md:hidden" aria-hidden="true">~$</span>
          <label htmlFor="terminal-input" className="sr-only">Enter terminal command</label>
          <input
            id="terminal-input"
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleCommand}
            className="bg-transparent border-none outline-none flex-grow text-cyan-400 placeholder-cyan-900/50 font-bold"
            placeholder="enter command (e.g. load soma-9.0)"
          />
        </div>
      </footer>
    </div>
  );
};

export default App;

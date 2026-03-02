import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, Suspense } from 'react';
import { Hexagon, Cpu, Lock, Scale, Eye } from 'lucide-react';

// --- MOCKED DEPENDENCIES FOR PREVIEW ENVIRONMENT ---
// The environment cannot resolve external local files. We mock them inline here to ensure compilation.
const Analytics = () => null;

const kernelAxioms = [
  "01 :: TRANSMUTE",
  "02 :: SUSTAIN",
  "03 :: INTEGRITY"
];

const _rawBuilds = [
  { id: 'scale_9.4', name: 'SCALE_9.4', desc: 'Fish Scale Necromancer', articleId: 'manifesto' },
  { id: 'soma_kernel_5.5', name: 'SOMA_KERNEL_V5.5', desc: 'Core Kernel Update', articleId: 'legacy' }
];

const staticArticles = [
  { id: 'manifesto', title: 'The Manifesto', type: 'doc' }
];
const autoArticles = [];

const OctagonGrid = ({ visible }) => visible ? <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d415_1px,transparent_1px),linear-gradient(to_bottom,#06b6d415_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" /> : null;
const KernelTab = ({ searchFilter }) => <div className="p-8 text-cyan-400 font-bold uppercase animate-pulse">Kernel View Initialized {searchFilter && `[FILTER: ${searchFilter}]`}</div>;
const ScalingTab = () => <div className="p-8 text-fuchsia-400 font-bold uppercase">Scaling Parameters Optimal</div>;
const ManifestoTab = () => <div className="p-8 text-cyan-100 font-bold uppercase">Decoding Manifesto Data...</div>;
const PrivacyTab = () => <div className="p-8 text-gray-300 font-bold uppercase">Privacy Protocols Enforced</div>;
const ArticleView = ({ article }) => <div className="p-8 text-cyan-300 font-bold uppercase">Accessing Record: {article?.id}</div>;
const ThesisView = () => <div className="p-8 text-fuchsia-300 font-bold uppercase">Architect Thesis Loaded</div>;
const TransmissionTab = () => <div className="p-8 text-cyan-500 font-bold uppercase tracking-widest">Awaiting Transmissions...</div>;

const useSystemLog = () => {
  const [visibleLogs, setSystemLogs] = useState([]);
  const logRef = useRef(null);
  const appendSystemLog = useCallback((log) => setSystemLogs(prev => [...prev, log]), []);
  return { appendSystemLog, setSystemLogs, visibleLogs, logRef };
};

const useTerminalCommands = () => {
  const [commandInput, setCommandInput] = useState('');
  const suggestions = [];
  const activeSugg = -1;
  const handleInputChange = (e) => setCommandInput(e.target.value);
  const handleCommand = (e) => { if (e.key === 'Enter') setCommandInput(''); };
  const executeSuggestion = () => {};
  return { commandInput, setCommandInput, suggestions, activeSugg, handleInputChange, handleCommand, executeSuggestion };
};


// --- PERFECTED BOOT SEQUENCE (3 SECONDS) ---
const BOOT_LINES = [
  ['MOUNTING VOLUMES',          'OK'],
  ['LOADING SOMA_KERNEL_V5.5',  'OK'],
  ['ESTABLISHING SECURE CONN',  'OK'],
  ['DECRYPTING ARCHIVES',       'OK'],
  ['INTEGRITY CHECK',           'PASS'],
];

const BootSequence = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let frame2;
    const frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        setMounted(true);
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      if (frame2) cancelAnimationFrame(frame2);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black font-mono flex items-center justify-center p-4 overflow-hidden relative">
      <style>{`
        @keyframes sk-cpuGlow {
          0%,100% { filter: drop-shadow(0 0 4px rgba(57,255,20,0.5)); }
          50%     { filter: drop-shadow(0 0 16px rgba(57,255,20,1)) drop-shadow(0 0 32px rgba(57,255,20,0.4)); }
        }
        @keyframes sk-titleReveal {
          from { opacity: 0; transform: translateY(-10px); filter: blur(10px); }
          to   { opacity: 1; transform: translateY(0);     filter: blur(0); }
        }
        @keyframes sk-glitch {
          0%  { text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff; transform: translate(0); }
          20% { text-shadow:  3px 0 #ff00ff,-3px 0 #00ffff; transform: translate(-2px, 1px); }
          40% { text-shadow: -2px 0 #ff00ff, 2px 0 #00ffff; transform: translate(2px,-1px); }
          60% { text-shadow:  1px 0 #ff00ff,-1px 0 #00ffff; transform: translate(0); }
          80% { text-shadow: -3px 0 #ff00ff, 3px 0 #00ffff; transform: translate(1px, 2px); }
          100%{ text-shadow: none;                           transform: translate(0); }
        }
        @keyframes sk-lineIn {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes sk-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes sk-scan {
          0%   { top: -4%; }
          100% { top: 104%; }
        }
        @keyframes sk-flicker {
          0%,94%,96%,98%,100% { opacity: 1; }
          95%  { opacity: 0.7; }
          97%  { opacity: 0.85; }
        }
        @keyframes sk-glow {
          0%,100% { box-shadow: 0 0 12px rgba(6,182,212,0.35), 0 0 40px rgba(217,70,239,0.12); }
          50%     { box-shadow: 0 0 28px rgba(6,182,212,0.7),  0 0 80px rgba(217,70,239,0.3);  }
        }
        @keyframes sk-active {
          0%,100% { color: #39ff14; text-shadow: 0 0 8px #39ff14; }
          50%     { color: #00ffaa; text-shadow: 0 0 20px #00ffaa; }
        }
        @keyframes sk-gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        /* Adjusted for 'settle' feel: Stays solid until 2.8s, then fades fast before 3s unmount */
        @keyframes sk-cardFade {
          0%, 92% { opacity: 1; filter: blur(0px); }
          100%    { opacity: 0; filter: blur(4px); }
        }
      `}</style>

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 2px)',
      }} />

      <div style={{
        position: 'absolute', left: 0, right: 0, height: '3px', zIndex: 2, pointerEvents: 'none',
        background: 'linear-gradient(transparent, rgba(6,182,212,0.5), transparent)',
        animation: 'sk-scan 0.9s linear infinite',
      }} />

      <div className="max-w-lg w-full relative z-10" style={{ animation: 'sk-flicker 3s linear forwards' }}>
        <div style={{ animation: 'sk-cardFade 3s linear forwards' }}>
          <div style={{
            padding: '1.5px',
            background: 'linear-gradient(135deg, rgba(6,182,212,0.6), rgba(217,70,239,0.5), rgba(6,182,212,0.6))',
            borderRadius: '3px',
            animation: 'sk-glow 0.8s ease-in-out infinite',
          }}>
            <div className="bg-black px-6 py-7 md:px-10 md:py-9 rounded-sm">

              <div className="flex justify-between items-center mb-6 text-[9px] tracking-widest">
                <span className="text-cyan-900/70">SYS::BOOT_SEQUENCE</span>
                <span className="text-fuchsia-900/70">NODE::scale-9.4</span>
              </div>

              <div className="flex items-center gap-4" style={{ animation: 'sk-titleReveal 0.35s ease-out forwards' }}>
                <div
                  className="sk-rotation-target shrink-0 flex items-center justify-center"
                  style={{
                    width: '2.75rem',
                    height: '2.75rem',
                    animation: 'none !important',
                    transform: mounted ? 'rotate(720deg)' : 'rotate(0deg)',
                    transition: 'transform 2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <Cpu
                    className="text-[#39ff14] w-full h-full"
                    style={{ 
                      animation: 'sk-cpuGlow 1.2s ease-in-out 0.4s infinite',
                      transform: 'none !important' 
                    }}
                  />
                </div>

                <div>
                  <div
                    className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none text-transparent bg-clip-text bg-gradient-to-r from-[#39ff14] via-cyan-300 to-cyan-500"
                    style={{
                      backgroundSize: '200% auto',
                      animation: 'sk-glitch 0.25s steps(1) 0.45s 5 forwards, sk-gradient-x 2s ease forwards'
                    }}
                  >
                    SOMA_KERNEL
                  </div>
                  <div className="text-fuchsia-500 text-xs font-bold tracking-[0.25em] mt-2 uppercase">
                    v5.5 &nbsp;//&nbsp; FISH_SCALE_NECROMANCER
                  </div>
                </div>
              </div>

              <div className="border-t border-cyan-900/40 my-5" />

              <div className="space-y-2 text-xs font-bold mb-6">
                {BOOT_LINES.map(([label, status], i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-cyan-500"
                    style={{ opacity: 0, animation: `sk-lineIn 0.18s ease-out ${200 + i * 290}ms forwards` }}
                  >
                    <span>
                      <span className="text-fuchsia-500 mr-1">{'>'}</span>
                      {label}
                      <span className="text-cyan-900/60">...</span>
                    </span>
                    <span className="text-[#39ff14] ml-6 tracking-widest">[{status}]</span>
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <div className="h-[2px] bg-cyan-950 w-full rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: 0,
                      animation: 'sk-progress 2.1s cubic-bezier(0.4,0,0.2,1) 0.2s forwards',
                      background: 'linear-gradient(90deg, #06b6d4, #d946ef, #39ff14)',
                      boxShadow: '0 0 10px rgba(6,182,212,0.9)',
                    }}
                  />
                </div>
              </div>

              <div
                className="text-xs font-black tracking-widest"
                style={{
                  opacity: 0,
                  color: '#39ff14',
                  animation: 'sk-lineIn 0.2s ease-out 1.6s forwards, sk-active 0.35s ease-in-out 1.8s infinite',
                }}
              >
                {'>'} scale_9.4 ACTIVE :: ALL SYSTEMS OPERATIONAL
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- DATA PROCESSING ---
const kernelBuilds = _rawBuilds.filter((k, i, arr) => arr.findIndex(x => x.name === k.name) === i);
const normaliseTitle = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const staticIds     = new Set(staticArticles.map(a => a.id));
const staticTitles  = new Set(staticArticles.map(a => normaliseTitle(a.title)));
const articles      = [
  ...staticArticles,
  ...autoArticles.filter(a =>
    !staticIds.has(a.id) && !staticTitles.has(normaliseTitle(a.title))
  ),
];

// --- MAIN APP ---
const App = () => {
  const [currentPath, setCurrentPath] = useState('~/system/kernel');
  const [activeTab, setActiveTab] = useState('kernel');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [bootSequence, setBootSequence] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingKernel, setLoadingKernel] = useState(null);
  const [originTab, setOriginTab] = useState('kernel');
  const [architectThesis, setArchitectThesis] = useState(false);

  const { appendSystemLog, setSystemLogs, visibleLogs, logRef } = useSystemLog();

  const mainRef = useRef(null);

  const transmissionStories = useMemo(() => articles.filter(a => a.type === 'fiction'), []);

  const sortedBuilds = useMemo(() => {
    const [pinned, ...rest] = kernelBuilds;
    return [pinned, ...rest.slice().reverse()];
  }, []);

  const norm = useCallback((s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''), []);
  
  const filteredBuilds = useMemo(() => {
    if (!searchFilter) return sortedBuilds;
    const q = norm(searchFilter);
    return sortedBuilds.filter(k =>
      norm(k.id).includes(q) || norm(k.name).includes(q) || norm(k.desc || '').includes(q)
    );
  }, [sortedBuilds, searchFilter, norm]);

  useEffect(() => {
    // Synced perfectly to the 3-second BootSequence timeline
    const timer = setTimeout(() => setBootSequence(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    if (mainRef.current) {
      mainRef.current.style.scrollBehavior = 'auto';
      mainRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, [currentPath, selectedArticle, activeTab, architectThesis]);

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

  const {
    commandInput, setCommandInput,
    suggestions, activeSugg,
    handleInputChange, handleCommand, executeSuggestion,
  } = useTerminalCommands({
    kernelBuilds,
    articles,
    norm,
    handleKernelClick,
    handleNav,
    appendSystemLog,
    setSystemLogs,
    setActiveTab,
    setSelectedArticle,
    setCurrentPath,
    setSearchFilter,
    setArchitectThesis,
    setOriginTab,
  });

  if (bootSequence) {
    return <BootSequence />;
  }

  return (
    <div className={`animate-app-reveal min-h-screen font-mono selection:bg-fuchsia-900 selection:text-white flex flex-col overflow-hidden relative transition-colors duration-700 ${selectedArticle || architectThesis ? 'bg-[#09090b]' : 'bg-black'}`}>
      <style>{`
        /* Smooth fade-in when the boot sequence unmounts */
        @keyframes appReveal {
          from { opacity: 0; filter: blur(4px); }
          to   { opacity: 1; filter: blur(0); }
        }
        .animate-app-reveal {
          animation: appReveal 0.6s ease-out forwards;
        }

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

          {/* Render the appropriate tab contents */}
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

          {activeTab === 'scaling' && !selectedArticle && !architectThesis && (
            <ScalingTab
              setArchitectThesis={setArchitectThesis}
              setCurrentPath={setCurrentPath}
            />
          )}

          {architectThesis && (
            <ThesisView handleReturnToRoot={handleReturnToRoot} />
          )}

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

          {activeTab === 'manifesto' && !selectedArticle && !architectThesis && (
            <ManifestoTab />
          )}

          {activeTab === 'privacy' && !selectedArticle && !architectThesis && (
            <PrivacyTab />
          )}

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
import { useState, useCallback, useRef } from 'react';
import { normalizeQuery } from '../lib/normalize';
import wasmRegistry from '../../wasm/wasm.generated';

/**
 * useTerminalCommands
 *
 * Encapsulates all terminal command parsing, autocomplete, and command history.
 * App.jsx passes callbacks for every side-effect that touches UI state it owns.
 */
export default function useTerminalCommands({
  kernelBuilds,
  articles,
  transmissionStories,
  norm,
  handleKernelClick,
  handleTransmissionSelect,
  handleNav,
  appendSystemLog,
  setSystemLogs,
  setActiveTab,
  setSelectedArticle,
  setCurrentPath,
  setSearchFilter,
  setArchitectThesis,
  setOriginTab,
}) {
  const [commandInput, setCommandInput] = useState('');
  const [suggestions,  setSuggestions]  = useState([]);
  const [activeSugg,   setActiveSugg]   = useState(-1);
  const [cmdHistory,   setCmdHistory]   = useState([]);  // most-recent first
  const [historyIdx,   setHistoryIdx]   = useState(-1);  // -1 = live input
  const [savedInput,   setSavedInput]   = useState('');

  // Persistent WASM struct instances — keyed by wasmEntry.id.
  // useRef so the pointer survives re-renders without triggering them.
  const activeKernels = useRef({});

  // ── Autocomplete ────────────────────────────────────────────────────────────
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
  }, [norm, kernelBuilds]);

  // ── Execute a suggestion (keyboard Enter or mouse click) ───────────────────
  const executeSuggestion = useCallback((kernel) => {
    setSuggestions([]);
    setActiveSugg(-1);
    setCommandInput('');
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    appendSystemLog({ time: t, msg: `COMMAND: load ${kernel.name}` });
    appendSystemLog({ time: t, msg: `Locating kernel module "${kernel.name}"...` });
    handleKernelClick(kernel);
  }, [appendSystemLog, handleKernelClick]);

  // ── Main keyboard handler ───────────────────────────────────────────────────
  const handleCommand = useCallback((e) => {
    // Suggestion dropdown navigation
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

    // Command history navigation (↑↓ when dropdown is closed)
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

    if (e.key !== 'Enter') return;

    setSuggestions([]);
    setActiveSugg(-1);
    const rawCmd   = commandInput.trim();
    const cmdParts = rawCmd.toLowerCase().split(' ').filter(Boolean);
    const action   = cmdParts[0]
      ? (cmdParts[0].startsWith('/') ? cmdParts[0].substring(1) : cmdParts[0])
      : '';
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

    const n = normalizeQuery;

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
      const q = n(query);

      // 1. Search kernelBuilds first — triggers the full handleKernelClick animation
      const kMatches = kernelBuilds.filter(k =>
        n(k.id).includes(q) || n(k.name).includes(q) || n(k.articleId).includes(q)
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
        // 2. Fall back to full article search
        const aMatches = articles.filter(a => a.type === 'kernel_doc' &&
          (n(a.id).includes(q) || n(a.title).includes(q) || n(a.subtitle).includes(q) ||
           (a.tags && a.tags.some(t => n(t).includes(q))))
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
          // 3. Bunker check — query the Transmission Stream (fiction / signal archive).
          // normalizeQuery ensures "Cigar Heist", "cigar heist", and "Cigar-Heist"
          // all collapse to "cigarheist" before comparison.
          const tMatches = transmissionStories.filter(s =>
            n(s.id).includes(q) ||
            n(s.title).includes(q) ||
            n(s.subtitle || '').includes(q) ||
            (s.tags && s.tags.some(t => n(t).includes(q)))
          );
          if (tMatches.length === 1) {
            executeCommand(rawCmd, `SIGNAL_INGEST: Routing to transmission "${tMatches[0].title}"...`);
            handleTransmissionSelect(tMatches[0]);
          } else if (tMatches.length > 1) {
            handleNav('~/system/transmission', 'transmission');
            executeCommand(rawCmd, `${tMatches.length} transmissions match "${query}". Switching to Transmission stream.`);
          } else {
            executeCommand(rawCmd, `ERROR: Object '${query}' not found in kernel index or transmission stream.`);
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
      setActiveTab('kernel');
      setSelectedArticle(null);
      setSearchFilter(query);
      setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
      executeCommand(rawCmd, `Applying search filter to kernel index: "${query}".`);
    } else if (action === 'help') {
      executeCommand(rawCmd, "Commands: load [term], list, search [term], home/kernel, scaling, transmission, manifesto, privacy, thesis, clear, help. ↑↓ history.");
    } else if (action === 'run') {
      // ── WASM-exclusive executor ─────────────────────────────────────────────
      const currentRegistry = wasmRegistry;
      console.log('[RUN/hook] Registry keys:', Object.keys(currentRegistry));

      if (!query) {
        executeCommand(rawCmd, `RUN_FAIL :: No target specified. Try: run vcache_burn | run climate | run bosonic`);
      } else {
        const [baseCmd, ...flagTokens] = query.split(' ').filter(Boolean);

        // Standalone commands that are not WASM kernels — redirect with hint
        if (['breach', 'relic'].includes(baseCmd.toLowerCase())) {
          appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
          setSystemLogs(prev => [
            ...prev,
            { time: now, msg: `  RUN_REDIRECT :: '${baseCmd}' is a standalone command, not a WASM kernel.` },
            { time: now, msg: `  Type '${baseCmd.toLowerCase()}' directly to execute it.` },
          ].slice(-2000));
          return;
        }

        // Seraphine-8.8.8.8.8.8.8.8 triad concept nodes — tensor inputs, not runnable kernels
        const TRIAD_NODES = ['white_irid','pitch_black_steel','bouligand_36','polymorph_pqc','magic_angle','magic_angle_1p1','zero_effort_flow'];
        if (TRIAD_NODES.includes(baseCmd.toLowerCase())) {
          appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
          setSystemLogs(prev => [
            ...prev,
            { time: now, msg: `  RUN_REDIRECT :: '${baseCmd}' is a Seraphine-8.8.8.8.8.8.8.8 triad concept node.` },
            { time: now, msg: `  These nodes are tensor inputs to the bone fusion engine, not standalone kernels.` },
            { time: now, msg: `  To compute fusion across all 31 nodes including the triads:` },
            { time: now, msg: `  run bone --nodes 31` },
          ].slice(-2000));
          return;
        }

        // vcache_burn hardwire — direct call, no lookup
        if (baseCmd.toLowerCase() === 'vcache_burn') {
          appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
          setSystemLogs(prev => [
            ...prev,
            { time: now, msg: `  WASM_BOOT :: Leviathan Cellular Automata v1.0` },
            { time: now, msg: `  Instantiating WASM module...` },
          ].slice(-2000));
          (async () => {
            try {
              const mod = await import('../../wasm/scale94_kernels.js');
              await mod.default({ module_or_path: '/wasm/scale94_kernels_bg.wasm' });
              const result   = mod.boot_leviathan_benchmark(100000.0, 100.0);
              const lines    = result.split('\n');
              const doneTime = new Date().toLocaleTimeString('en-US', { hour12: false });
              setSystemLogs(prev => [
                ...prev,
                { time: now,      msg: `  ── KERNEL OUTPUT ─────────────────────────`, rust: true },
                ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
                { time: now,      msg: `  ──────────────────────────────────────────`, rust: true },
                { time: doneTime, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE`, rust: true },
              ].slice(-2000));
            } catch (err) {
              setSystemLogs(prev => [...prev, { time: now, msg: `  WASM_RUNTIME_ERROR :: ${err.message}` }].slice(-2000));
            }
          })();
          return;
        }

        // Parse flags
        const parsedFlags = {};
        for (let i = 0; i < flagTokens.length; i++) {
          if (flagTokens[i].startsWith('--') && flagTokens[i + 1] && !flagTokens[i + 1].startsWith('--')) {
            parsedFlags[flagTokens[i].slice(2)] = parseFloat(flagTokens[i + 1]);
            i++;
          }
        }

        // 4-tier registry lookup
        const kq = normalizeQuery(baseCmd);
        const wasmEntry = currentRegistry[baseCmd.toUpperCase()]
          ?? currentRegistry[baseCmd]
          ?? Object.values(currentRegistry).find(e => normalizeQuery(e.id) === kq)
          ?? Object.values(currentRegistry).find(e => normalizeQuery(e.id).includes(kq))
          ?? Object.values(currentRegistry).find(e => e.aliases?.some(a => normalizeQuery(a) === kq))
          ?? Object.values(currentRegistry).find(e => e.aliases?.some(a => normalizeQuery(a).includes(kq)))
          ?? null;

        if (wasmEntry) {
          appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
          setSystemLogs(prev => [
            ...prev,
            { time: now, msg: `  WASM_BOOT :: ${wasmEntry.label}` },
            { time: now, msg: `  MODULE: ${wasmEntry.module}` },
            { time: now, msg: `  Instantiating WASM module...` },
          ].slice(-2000));
          (async () => {
            try {
              const mod = await import('../../wasm/scale94_kernels.js');
              const wasmUrl = wasmEntry.wasmUrl ?? wasmEntry.module.replace(/\.js$/, '_bg.wasm');
              await mod.default({ module_or_path: wasmUrl });
              const callArgs = [...(wasmEntry.args ?? [])];
              if (wasmEntry.argMap) {
                for (const [flag, idx] of Object.entries(wasmEntry.argMap)) {
                  if (parsedFlags[flag] !== undefined) callArgs[idx] = parsedFlags[flag];
                }
              }
              let result;
              if (wasmEntry.isStateful) {
                // ── Stateful path: create once, drive cycle-by-cycle ──────────
                if (!activeKernels.current[wasmEntry.id]) {
                  activeKernels.current[wasmEntry.id] = new mod[wasmEntry.struct]();
                  setSystemLogs(prev => [
                    ...prev,
                    { time: now, msg: `  KERNEL_INSTANCE_BOOT :: ${wasmEntry.id}` },
                    { time: now, msg: `  new ${wasmEntry.struct}() initialised – state will persist across calls` },
                  ].slice(-2000));
                }
                const instance = activeKernels.current[wasmEntry.id];
                // Allow `run soma_live reset` to wipe state without a cycle
                if (flagTokens.includes('reset')) {
                  instance.reset();
                  result = `SOMA_KERNEL_5.5 // RESET\nAll state cleared. Year counter reset to 0.\nCall run soma_live to begin a new simulation.`;
                } else {
                  result = instance[wasmEntry.cycle](...callArgs);
                }
              } else {
                // ── Stateless path (legacy free-function or struct-boot) ───────
                result = wasmEntry.fn
                  ? mod[wasmEntry.fn](...callArgs)
                  : mod[wasmEntry.struct][wasmEntry.boot]();
              }
              const lines    = result.split('\n');
              const doneTime = new Date().toLocaleTimeString('en-US', { hour12: false });
              setSystemLogs(prev => [
                ...prev,
                { time: now,      msg: `  ── KERNEL OUTPUT ─────────────────────────`, rust: true },
                ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
                { time: now,      msg: `  ──────────────────────────────────────────`, rust: true },
                { time: doneTime, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE`, rust: true },
              ].slice(-2000));
            } catch (err) {
              setSystemLogs(prev => [
                ...prev,
                { time: now, msg: `  WASM_RUNTIME_ERROR :: ${err.message}` },
              ].slice(-2000));
            }
          })();
        } else {
          console.log('[RUN_FAIL/hook] Registry keys:', Object.keys(currentRegistry));
          appendSystemLog({ time: now, msg: `COMMAND: ${rawCmd}` });
          setSystemLogs(prev => [
            ...prev,
            { time: now, msg: `  RUN_FAIL :: "${baseCmd}" – not found in WASM registry.` },
            { time: now, msg: `  ${Object.keys(currentRegistry).length} kernel(s) registered. Try: run vcache_burn | run climate | run bosonic` },
            { time: now, msg: `  Use 'load ${baseCmd}' to open a lore article instead.` },
          ].slice(-2000));
        }
      }
    } else if (action === 'clear') {
      setSystemLogs([]);
      executeCommand(rawCmd, "System log cleared.");
    } else if (action === 'exit') {
      executeCommand(rawCmd, "Session integrity maintained. Disconnecting terminal interface.");
    } else {
      executeCommand(rawCmd, `ERROR: Command '${action}' not recognized. Type 'help' for assistance.`);
    }
  }, [
    suggestions, activeSugg, cmdHistory, historyIdx, savedInput, commandInput,
    kernelBuilds, articles, transmissionStories,
    appendSystemLog, setSystemLogs, handleKernelClick, handleTransmissionSelect, handleNav,
    setActiveTab, setSelectedArticle, setCurrentPath, setSearchFilter,
    setArchitectThesis, setOriginTab,
    executeSuggestion,
  ]);

  return {
    commandInput,
    setCommandInput,
    suggestions,
    activeSugg,
    handleInputChange,
    handleCommand,
    executeSuggestion,
  };
}

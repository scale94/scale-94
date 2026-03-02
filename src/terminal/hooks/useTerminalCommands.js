import { useState, useCallback } from 'react';

/**
 * useTerminalCommands
 *
 * Encapsulates all terminal command parsing, autocomplete, and command history.
 * App.jsx passes callbacks for every side-effect that touches UI state it owns.
 */
export default function useTerminalCommands({
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
}) {
  const [commandInput, setCommandInput] = useState('');
  const [suggestions,  setSuggestions]  = useState([]);
  const [activeSugg,   setActiveSugg]   = useState(-1);
  const [cmdHistory,   setCmdHistory]   = useState([]);  // most-recent first
  const [historyIdx,   setHistoryIdx]   = useState(-1);  // -1 = live input
  const [savedInput,   setSavedInput]   = useState('');

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

    const n = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
  }, [
    suggestions, activeSugg, cmdHistory, historyIdx, savedInput, commandInput,
    norm, kernelBuilds, articles,
    appendSystemLog, setSystemLogs, handleKernelClick, handleNav,
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

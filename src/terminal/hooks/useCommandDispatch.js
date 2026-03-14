// ── useCommandDispatch ─────────────────────────────────────────────────────────
// Owns the full command execution logic (the `Enter` branch of handleCommand).
// Extracted from App.jsx to keep that file manageable.
//
// Pattern: ctxRef — the returned callback is stable (created once, deps: []).
// All state/callbacks are read through ctxRef.current which is kept fresh on
// every render via the effect below. This avoids both stale closures and the
// cost of recreating the callback whenever any dep changes.
//
// Relic cleanup: interval + timeout refs are tracked here so they are cleared
// on unmount even if the 5-second window hasn't elapsed.

import { useCallback, useEffect, useRef } from 'react';
import wasmRegistry    from '../../wasm/wasm.generated';
import kernelBuildsData from '../data/kernelBuilds';
import { normalizeQuery } from '../../lib/normalize';
import { formatKernelHelp, formatRunHelp } from '../commands/runHelpers';

// Tab name → tab id — used by `load <tabname>` guard
const LOAD_TAB_MAP = {
  surveillance: 'surveillance', panopticon: 'surveillance', legislation: 'surveillance',
  cryptography: 'cryptography', classified: 'cryptography', pqc: 'cryptography', mlkem: 'cryptography',
  kernel: 'kernel', home: 'kernel', scaling: 'scaling', transmission: 'transmission',
  manifesto: 'manifesto', bsky: 'bsky', bluesky: 'bsky', privacy: 'privacy',
  art: 'art', graph: 'art', fade: 'art', 'fade_doctrine': 'art', visual: 'art',
};

const HEX_POOL    = ['BD','E9','1C','7A','55','FF','E3','9A','C2','4F','A1','3D'];
const ERR_TYPES   = ['SYNAPSE_OVERFLOW','DNA_OVERWRITE','ENGRAM_COLLAPSE','CORTEX_BREACH'];
const norm        = normalizeQuery;

export function useCommandDispatch(ctx) {
  // Keep ctxRef in sync with the latest render so the stable callback always
  // reads current state without needing to be re-created.
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; });

  // Relic mode timer refs — cleared on unmount to prevent post-unmount setState
  const relicIntervalRef = useRef(null);
  const relicTimeoutRef  = useRef(null);
  useEffect(() => () => {
    clearInterval(relicIntervalRef.current);
    clearTimeout(relicTimeoutRef.current);
  }, []);

  return useCallback((action, query, rawCmd, now) => {
    const {
      articles, classifiedSession, transmissionStories, tagIndex, systemArticles, activeTab,
      setSystemLogs, setClassifiedSession, setActiveTab, setSelectedArticle,
      setSearchFilter, setCurrentPath, setRelicMode, setBreachOpen, applyEcoCost,
      setOriginTab, setArchitectThesis, setTagCloudView,
      appendSystemLog, handleNav, handleKernelClick, handleTransmissionSelect,
      loadAbortRef, activeKernels, setKuramotoViz, setAssociativeField, setSpectralBridges, setEnclaveKeys,
    } = ctxRef.current;

    const log  = (msg, rust = false) => appendSystemLog({ time: now, msg, rust });
    const logs = (...msgs) => setSystemLogs(prev =>
      [...prev, ...msgs.map(m => (typeof m === 'string' ? { time: now, msg: m } : { time: now, ...m }))].slice(-2000)
    );
    const executeCommand = (cmd, result) => {
      log(`COMMAND: ${cmd}`);
      log(result);
    };

    // ── run ──────────────────────────────────────────────────────────────────
    if (action === 'run') {
      const currentRegistry = wasmRegistry;
      console.log('[RUN] Registry keys at dispatch:', Object.keys(currentRegistry));

      if (!query) {
        executeCommand(rawCmd, `RUN_FAIL :: No target specified. Try: run vcache_burn | run climate | run bosonic`);
        return;
      }

      const [baseCmd, ...flagTokens] = query.split(' ').filter(Boolean);

      // Standalone commands that are not WASM kernels
      if (['breach', 'relic'].includes(baseCmd.toLowerCase())) {
        log(`COMMAND: ${rawCmd}`);
        logs(
          `  RUN_REDIRECT :: '${baseCmd}' is a standalone command, not a WASM kernel.`,
          `  Type '${baseCmd.toLowerCase()}' directly to execute it.`,
        );
        return;
      }

      // Global help
      if (baseCmd === '--help' || baseCmd === '-h') {
        log(`COMMAND: ${rawCmd}`);
        setSystemLogs(prev => [
          ...prev,
          ...formatRunHelp(currentRegistry).map(msg => ({ time: now, msg })),
        ].slice(-2000));
        return;
      }

      // Arg parser: strip --help, collect positionals + named flags
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

      // 7-tier registry lookup
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
        // Per-kernel help
        if (isHelp) {
          log(`COMMAND: ${rawCmd}`);
          setSystemLogs(prev => [
            ...prev,
            ...formatKernelHelp(wasmEntry).map(msg => ({ time: now, msg })),
          ].slice(-2000));
          return;
        }

        log(`COMMAND: ${rawCmd}`);
        const callArgs = [...(wasmEntry.args ?? [])];
        positionalArgs.forEach((val, idx) => { if (idx < callArgs.length) callArgs[idx] = val; });
        if (wasmEntry.argMap) {
          for (const [flag, idx] of Object.entries(wasmEntry.argMap)) {
            if (parsedFlags[flag] !== undefined) callArgs[idx] = parsedFlags[flag];
          }
        }
        applyEcoCost(wasmEntry.aliases?.[0] ?? wasmEntry.id);
        logs(
          `  WASM_BOOT :: ${wasmEntry.label}`,
          `  MODULE: ${wasmEntry.module}`,
          `  ARGS: [${callArgs.join(', ')}]`,
          `  Instantiating WASM module...`,
        );

        (async () => {
          try {
            // eslint-disable-next-line import/no-unresolved
            const mod = await import('../../wasm/scale94_kernels.js');
            const wasmUrl = wasmEntry.wasmUrl ?? wasmEntry.module.replace(/\.js$/, '_bg.wasm');
            await mod.default({ module_or_path: wasmUrl });

            const t0 = performance.now();
            let result;
            if (wasmEntry.isStateful) {
              if (!activeKernels.current[wasmEntry.id]) {
                activeKernels.current[wasmEntry.id] = new mod[wasmEntry.struct]();
                logs(
                  `  KERNEL_INSTANCE_BOOT :: ${wasmEntry.id}`,
                  `  new ${wasmEntry.struct}() initialised – state persists across calls`,
                );
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
            // Strip DATA: suffix before display; parse it for visualizer hooks
            const dataMatch = result.match(/\nDATA:(\{.*\})$/s);
            const displayResult = dataMatch ? result.slice(0, result.length - dataMatch[0].length) : result;
            const lines    = displayResult.split('\n');
            const doneTime = new Date().toLocaleTimeString('en-US', { hour12: false });
            setSystemLogs(prev => [
              ...prev,
              { time: now,      msg: `  ── KERNEL OUTPUT ─────────────────────────`, rust: true },
              ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
              { time: now,      msg: `  ──────────────────────────────────────────`, rust: true },
              { time: doneTime, msg: `SYSTEM_KERNEL_LOG: CALCULATION COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
            ].slice(-2000));


            // Post-kuramoto hook — launch live visual field
            if (wasmEntry.id === 'KURAMOTO-SYNCHRONY' && setKuramotoViz) {
              setKuramotoViz({ active: true, n: callArgs[0], k: callArgs[1], sigma: callArgs[2] });
            }

            // Post-associative-field hook — feed attractor state into ArtTab
            if (wasmEntry.id === 'ASSOCIATIVE-FIELD-1.0' && setAssociativeField && dataMatch) {
              try {
                const data = JSON.parse(dataMatch[1]);
                setAssociativeField(data);
              } catch (_) { /* malformed DATA: — ignore */ }
            }

            // Post-spectral-bridge hook — feed discovered bridges into ArtTab
            if (wasmEntry.id === 'SPECTRAL-BRIDGE-1.0' && setSpectralBridges && dataMatch) {
              try {
                const data = JSON.parse(dataMatch[1]);
                setSpectralBridges(data);
              } catch (_) { /* malformed DATA: — ignore */ }
            }

            // Post-classified hook — only for ML-KEM-CLASSIFIED
            if (wasmEntry.id === 'ML-KEM-CLASSIFIED') {
              handleNav('~/system/cryptography', 'cryptography');
              setClassifiedSession({ status: 'pending' });
              const ct = new Date().toLocaleTimeString('en-US', { hour12: false });
              setSystemLogs(prev => [...prev,
                { time: ct, msg: `[ENCLAVE] Initiating time-locked decryption session...` },
              ].slice(-2000));
              try {
                const resp = await fetch('/api/classified/challenge', {
                  method:  'POST',
                  headers: { 'Content-Type': 'application/json' },
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const challenge = await resp.json();
                setClassifiedSession({
                  status:         'challenged',
                  token:          challenge.token,
                  code:           challenge.challenge,
                  expiresAt:      challenge.expiresAt,
                  sessionId:      challenge.sessionId,
                  algorithm:      challenge.algorithm,
                  encapKeySize:   challenge.encapKeySize,
                  ciphertextSize: challenge.ciphertextSize,
                });
                const ct2 = new Date().toLocaleTimeString('en-US', { hour12: false });
                setSystemLogs(prev => [...prev,
                  { time: ct2, msg: `[ENCLAVE] SESSION_ID: ${challenge.sessionId}` },
                  { time: ct2, msg: `[ENCLAVE] CHALLENGE:  ${challenge.challenge}` },
                  { time: ct2, msg: `[ENCLAVE] EXPIRES:   ${new Date(challenge.expiresAt).toLocaleTimeString('en-US', { hour12: false })} (60s)` },
                  { time: ct2, msg: `[ENCLAVE] ── Type: verify ${challenge.challenge} ──` },
                ].slice(-2000));
              } catch (apiErr) {
                setClassifiedSession(null);
                const ct2 = new Date().toLocaleTimeString('en-US', { hour12: false });
                setSystemLogs(prev => [...prev,
                  { time: ct2, msg: `[ENCLAVE] CHALLENGE_ERROR :: ${apiErr.message}` },
                  { time: ct2, msg: `[ENCLAVE] Check Vercel env vars or run: vercel dev` },
                ].slice(-2000));
              }
            }
          } catch (err) {
            logs(
              `  WASM_RUNTIME_ERROR :: ${err.message}`,
              `  Run: node scripts/import-rust.js  to compile the module.`,
            );
          }
        })();
      } else {
        console.log('[RUN_FAIL] Terminal registry keys:', Object.keys(currentRegistry));
        log(`COMMAND: ${rawCmd}`);
        logs(
          `  RUN_FAIL :: "${baseCmd}" – not found in WASM registry.`,
          `  ${Object.keys(currentRegistry).length} kernel(s) available. Try: run vcache_burn | run climate | run bosonic`,
          `  Use 'load ${baseCmd}' to open a lore article instead.`,
        );
      }
      return;
    }

    // ── Tab navigation ────────────────────────────────────────────────────────
    if (['home', 'kernel', 'system'].includes(action)) {
      handleNav('~/system/kernel', 'kernel');
      executeCommand(rawCmd, "Switching directory to /system/kernel...");
      return;
    }
    if (['scaling', 'services', 'custom'].includes(action)) {
      handleNav('~/system/scaling', 'scaling');
      executeCommand(rawCmd, "Switching directory to /system/scaling...");
      return;
    }
    if (action === 'transmission') {
      handleNav('~/system/transmission', 'transmission');
      executeCommand(rawCmd, "Switching directory to /system/transmission...");
      return;
    }
    if (action === 'surveillance' || action === 'panopticon' || action === 'legislation') {
      handleNav('~/system/surveillance', 'surveillance');
      executeCommand(rawCmd, "Switching directory to /system/surveillance...");
      return;
    }
    if (['research', 'fiction', 'ls'].includes(action)) {
      executeCommand(rawCmd, "ERROR: Target directory purged. Content migrated to external archive.");
      return;
    }
    if (action === 'bsky' || action === 'bluesky' || action === 'atproto') {
      handleNav('~/system/bsky', 'bsky');
      executeCommand(rawCmd, "Switching directory to /system/bsky...");
      return;
    }
    if (action === 'privacy') {
      handleNav('~/system/privacy', 'privacy');
      executeCommand(rawCmd, "Switching directory to /system/privacy...");
      return;
    }
    if (action === 'cryptography' || action === 'classified' || action === 'pqc' || action === 'mlkem') {
      handleNav('~/system/cryptography', 'cryptography');
      executeCommand(rawCmd, "Switching directory to /system/cryptography...");
      return;
    }
    if (action === 'about' || action === 'manifesto') {
      handleNav('~/system/manifesto', 'manifesto');
      executeCommand(rawCmd, "Switching directory to /system/manifesto...");
      return;
    }
    if (action === 'thesis') {
      handleNav('~/system/scaling/thesis', 'scaling');
      setArchitectThesis(true);
      executeCommand(rawCmd, "Loading ARCHITECT_THESIS...");
      return;
    }

    // ── verify ────────────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!query) {
        executeCommand(rawCmd, `VERIFY_FAIL :: No passphrase supplied. Usage: verify <CODE>`);
      } else if (!classifiedSession || classifiedSession.status !== 'challenged') {
        executeCommand(rawCmd, `VERIFY_FAIL :: No active classified session. Type: run classified`);
      } else if (Date.now() > classifiedSession.expiresAt) {
        setClassifiedSession(null);
        executeCommand(rawCmd, `VERIFY_FAIL :: Session window expired. Type: run classified to restart.`);
      } else {
        log(`COMMAND: ${rawCmd}`);
        logs(`  ENCLAVE_VERIFY :: Submitting challenge response...`);
        (async () => {
          try {
            const resp = await fetch('/api/classified/verify', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ token: classifiedSession.token, passphrase: query.toUpperCase() }),
            });
            const data = await resp.json();
            const t = new Date().toLocaleTimeString('en-US', { hour12: false });
            if (resp.ok && data.success) {
              setClassifiedSession({
                status:      'unlocked',
                content:     data.content,
                sessionId:   data.sessionId,
                decryptedAt: data.decryptedAt,
                remainingMs: data.remainingMs,
              });
              handleNav('~/system/cryptography', 'cryptography');
              setSystemLogs(prev => [...prev,
                { time: t, msg: `  ENCLAVE_DECRYPT :: AES-256-GCM AUTH TAG VERIFIED`, rust: true },
                { time: t, msg: `  PLAINTEXT DELIVERED – ${(data.remainingMs / 1000).toFixed(1)}s remaining`, rust: true },
                { time: t, msg: `  Navigate to /cryptography to read.`, rust: true },
              ].slice(-2000));
              // Zeroize ephemeral KEM residue from WASM linear memory now that
              // the payload has been delivered. Best-effort — silently skipped
              // if the WASM instance is not live (e.g. direct verify after reload).
              try {
                const mod = await import('../../wasm/scale94_kernels.js');
                const flushResult = mod.log_entropy_flush();
                const tf = new Date().toLocaleTimeString('en-US', { hour12: false });
                setSystemLogs(prev => [
                  ...prev,
                  ...flushResult.split('\n').filter(Boolean).map(msg => ({ time: tf, msg, rust: true })),
                ].slice(-2000));
              } catch (_) { /* WASM not initialised — flush is a no-op */ }
            } else {
              setSystemLogs(prev => [...prev,
                { time: t, msg: `  ENCLAVE_REJECT :: ${data.msg ?? data.error}` },
              ].slice(-2000));
              if (data.error === 'TIME_EXCEEDED') setClassifiedSession(null);
            }
          } catch (err) {
            const t = new Date().toLocaleTimeString('en-US', { hour12: false });
            setSystemLogs(prev => [...prev,
              { time: t, msg: `  VERIFY_ERROR :: ${err.message}` },
            ].slice(-2000));
          }
        })();
      }
      return;
    }

    // ── keygen / seal / open — ML-KEM-768 + AES-256-GCM enclave ──────────────
    if (action === 'keygen') {
      log(`COMMAND: ${rawCmd}`);
      (async () => {
        try {
          const mod = await import('../../wasm/scale94_kernels.js');
          const wasmEntry = Object.values(wasmRegistry).find(e => e.fn === 'run_spectral_bridge');
          const wasmUrl = wasmEntry?.wasmUrl ?? '/wasm/scale94_kernels_bg.wasm';
          await mod.default({ module_or_path: wasmUrl });
          const t0 = performance.now();
          const result = mod.enclave_keygen();
          const elapsed = (performance.now() - t0).toFixed(4);
          const dataMatch = result.match(/\nDATA:(\{.*\})$/s);
          const displayResult = dataMatch ? result.slice(0, result.length - dataMatch[0].length) : result;
          const lines = displayResult.split('\n');
          const doneTime = new Date().toLocaleTimeString('en-US', { hour12: false });
          setSystemLogs(prev => [
            ...prev,
            { time: now, msg: `  ── ENCLAVE KEYGEN ────────────────────────`, rust: true },
            ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
            { time: now, msg: `  ──────────────────────────────────────────`, rust: true },
            { time: doneTime, msg: `ENCLAVE: KEYGEN COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
          ].slice(-2000));
          if (dataMatch) {
            try {
              const data = JSON.parse(dataMatch[1]);
              // Store ek/dk hex in session for display — actual keys live in WASM memory
              ctxRef.current.setEnclaveKeys?.({ ek: data.ek, dk: data.dk });
            } catch (_) { /* malformed DATA: — ignore */ }
          }
        } catch (err) {
          logs(`  WASM_RUNTIME_ERROR :: ${err.message}`);
        }
      })();
      return;
    }

    if (action === 'seal') {
      if (!query) {
        executeCommand(rawCmd, `SEAL_FAIL :: No plaintext supplied. Usage: seal <message>`);
        return;
      }
      log(`COMMAND: ${rawCmd}`);
      (async () => {
        try {
          const mod = await import('../../wasm/scale94_kernels.js');
          const wasmEntry = Object.values(wasmRegistry).find(e => e.wasmUrl);
          const wasmUrl = wasmEntry?.wasmUrl ?? '/wasm/scale94_kernels_bg.wasm';
          await mod.default({ module_or_path: wasmUrl });
          const t0 = performance.now();
          const result = mod.enclave_seal(query);
          const elapsed = (performance.now() - t0).toFixed(4);
          const dataMatch = result.match(/\nDATA:(\{.*\})$/s);
          const displayResult = dataMatch ? result.slice(0, result.length - dataMatch[0].length) : result;
          const lines = displayResult.split('\n');
          const doneTime = new Date().toLocaleTimeString('en-US', { hour12: false });
          setSystemLogs(prev => [
            ...prev,
            { time: now, msg: `  ── ENCLAVE SEAL ──────────────────────────`, rust: true },
            ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
            { time: now, msg: `  ──────────────────────────────────────────`, rust: true },
            { time: doneTime, msg: `ENCLAVE: SEAL COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
          ].slice(-2000));
        } catch (err) {
          logs(`  ENCLAVE_ERROR :: ${err.message}`, `  Have you run 'keygen' first?`);
        }
      })();
      return;
    }

    if (action === 'open') {
      if (!query) {
        executeCommand(rawCmd, `OPEN_FAIL :: No sealed blob supplied. Usage: open <hex_blob>`);
        return;
      }
      log(`COMMAND: ${rawCmd}`);
      (async () => {
        try {
          const mod = await import('../../wasm/scale94_kernels.js');
          const wasmEntry = Object.values(wasmRegistry).find(e => e.wasmUrl);
          const wasmUrl = wasmEntry?.wasmUrl ?? '/wasm/scale94_kernels_bg.wasm';
          await mod.default({ module_or_path: wasmUrl });
          const t0 = performance.now();
          const result = mod.enclave_open(query);
          const elapsed = (performance.now() - t0).toFixed(4);
          const dataMatch = result.match(/\nDATA:(\{.*\})$/s);
          const displayResult = dataMatch ? result.slice(0, result.length - dataMatch[0].length) : result;
          const lines = displayResult.split('\n');
          const doneTime = new Date().toLocaleTimeString('en-US', { hour12: false });
          setSystemLogs(prev => [
            ...prev,
            { time: now, msg: `  ── ENCLAVE OPEN ──────────────────────────`, rust: true },
            ...lines.map(l => ({ time: now, msg: `  ${l}`, rust: true })),
            { time: now, msg: `  ──────────────────────────────────────────`, rust: true },
            { time: doneTime, msg: `ENCLAVE: OPEN COMPLETE  ·  EXEC_TIME: ${elapsed}ms`, rust: true },
          ].slice(-2000));
        } catch (err) {
          logs(`  ENCLAVE_ERROR :: ${err.message}`, `  Have you run 'keygen' first?`);
        }
      })();
      return;
    }

    // ── load ──────────────────────────────────────────────────────────────────
    if (action === 'load' && query) {
      const loadQ = query.toLowerCase().trim();
      if (LOAD_TAB_MAP[loadQ]) {
        const tgt = LOAD_TAB_MAP[loadQ];
        handleNav(`~/system/${tgt}`, tgt);
        executeCommand(rawCmd, `Switching directory to /system/${tgt}...`);
        return;
      }

      const q = norm(query);

      // 1. kernelBuilds — triggers full handleKernelClick animation
      const kMatches = kernelBuildsData.filter(k =>
        norm(k.id).includes(q) ||
        norm(k.name).includes(q) ||
        norm(k.articleId).includes(q)
      );
      if (kMatches.length === 1) {
        log(`COMMAND: ${rawCmd}`);
        log(`Locating kernel module "${kMatches[0].name}"...`);
        handleKernelClick(kMatches[0]);
        return;
      }
      if (kMatches.length > 1) {
        setActiveTab('kernel');
        setSelectedArticle(null);
        setSearchFilter(query);
        setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
        executeCommand(rawCmd, `${kMatches.length} kernel modules match "${query}". Filter applied.`);
        return;
      }

      // 2. Full article search (kernel_doc / kernel types)
      const aMatches = articles.filter(a =>
        (a.type === 'kernel_doc' || a.type === 'kernel') &&
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
        return;
      }
      if (aMatches.length > 1) {
        setActiveTab('kernel');
        setSelectedArticle(null);
        setSearchFilter(query);
        setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);
        executeCommand(rawCmd, `${aMatches.length} matches found. Filter applied.`);
        return;
      }

      // 3. Transmission stream (fiction / signal archive)
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
        log(`COMMAND: ${rawCmd}`);
        logs(
          `  SIGNAL_LOST :: "${query}" – no carrier detected.`,
          `  SORBE NODE: offline // last contact consumed by the Thermodynamic Bloom`,
          `  Entropy has claimed this fragment. The kernel registry holds no record.`,
          `  Try: search ${query.toLowerCase().split(' ')[0]} | list | help`,
        );
      }
      return;
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (action === 'list') {
      log(`COMMAND: ${rawCmd}`);
      const divider = `  ${'─'.repeat(44)}`;
      const rows = kernelBuildsData.map(k => {
        const pad = 30 - k.name.length;
        return `  ${k.name}${pad > 0 ? ' '.repeat(pad) : '  '}${k.status}`;
      });
      setSystemLogs(prev => [
        ...prev,
        { time: now, msg: `  KERNEL_INDEX · ${kernelBuildsData.length} modules` },
        { time: now, msg: divider },
        ...rows.map(msg => ({ time: now, msg })),
        { time: now, msg: divider },
        { time: now, msg: `  load <name>  ·  search <tag> to filter` },
      ].slice(-2000));
      return;
    }

    // ── search ────────────────────────────────────────────────────────────────
    if (action === 'search' && query) {
      const q = norm(query);
      // Collect all tag hits, group by kernel id, merge matched tags
      const tagHitMap = new Map();
      Object.entries(tagIndex)
        .filter(([tag]) => norm(tag).includes(q))
        .forEach(([tag, kernels]) => {
          kernels.forEach(k => {
            if (!tagHitMap.has(k.id)) tagHitMap.set(k.id, { ...k, tags: [] });
            tagHitMap.get(k.id).tags.push(tag);
          });
        });
      const hits = [...tagHitMap.values()];

      setActiveTab('kernel');
      setSelectedArticle(null);
      setSearchFilter(query);
      setCurrentPath(`~/system/kernel?q=${query.replace(/ /g, '_')}`);

      log(`COMMAND: ${rawCmd}`);
      if (hits.length > 0) {
        const divider = `  ${'─'.repeat(44)}`;
        setSystemLogs(prev => [
          ...prev,
          { time: now, msg: `  SEARCH "${query.toUpperCase()}" · ${hits.length} result${hits.length !== 1 ? 's' : ''}` },
          { time: now, msg: divider },
          ...hits.slice(0, 10).map(k => ({
            time: now,
            msg: `  · ${k.id}  ${k.tags.join(', ')}`,
          })),
          { time: now, msg: divider },
        ].slice(-2000));
      } else {
        log(`  no matches for "${query}" – filter active on /kernel`);
      }
      return;
    }

    // ── help ──────────────────────────────────────────────────────────────────
    if (action === 'help') {
      const helpArticle = systemArticles['HELP'];
      if (helpArticle) {
        log(`COMMAND: ${rawCmd}`);
        log('Loading SYSTEM_COMMAND_REFERENCE...');
        setOriginTab(activeTab);
        setSelectedArticle(helpArticle);
      } else {
        executeCommand(rawCmd, 'Commands: load [term], list, search [term], home/kernel, scaling, transmission, manifesto, privacy, thesis, clear, help. ↑↓ history.');
      }
      return;
    }

    // ── tags ──────────────────────────────────────────────────────────────────
    if (action === 'tags') {
      const tagCount    = Object.keys(tagIndex).length;
      const kernelCount = new Set(Object.values(tagIndex).flat().map(k => k.id)).size;
      log(`COMMAND: ${rawCmd}`);
      log(`TAG_INDEX :: ${tagCount} unique tags across ${kernelCount} kernels`);
      setTagCloudView(true);
      setSelectedArticle(null);
      setArchitectThesis(false);
      setActiveTab('kernel');
      setCurrentPath('~/system/kernel/tags');
      return;
    }

    // ── export ────────────────────────────────────────────────────────────────
    // export <id> [--pass <passphrase>]
    // Fetches the article chunk, encrypts it via Tesseract-Vault seal_markdown
    // (Argon2id + AES-256-GCM + BLAKE3), and downloads as <id>.tesseract
    if (action === 'export') {
      if (!query) {
        log(`COMMAND: ${rawCmd}`);
        logs(
          `  EXPORT_FAIL :: No target specified.`,
          `  Usage: export <kernel-id> [--pass <passphrase>]`,
          `  Example: export TESSERACT-VAULT-1.0 --pass mySecret`,
          `  Default passphrase used if --pass is omitted (displayed in terminal).`,
        );
        return;
      }

      // Parse --pass flag
      const exportTokens = query.split(' ');
      const passIdx      = exportTokens.indexOf('--pass');
      const passphrase   = passIdx !== -1 && exportTokens[passIdx + 1]
        ? exportTokens.slice(passIdx + 1).join(' ')
        : 'TESSERACT-EXPORT-SCALE94';
      const idQuery = exportTokens
        .filter((_, i) => i !== passIdx && (passIdx === -1 || i !== passIdx + 1))
        .join(' ').trim();

      const q = norm(idQuery);
      const match = articles.find(a =>
        norm(a.id) === q ||
        norm(a.id).includes(q) ||
        norm(a.title || '').includes(q)
      );

      log(`COMMAND: ${rawCmd}`);

      if (!match) {
        logs(
          `  EXPORT_FAIL :: "${idQuery}" — no kernel found.`,
          `  Try: load <id> first to confirm the article exists.`,
        );
        return;
      }

      logs(
        `  TESSERACT_EXPORT :: ${match.id}`,
        `  [SEC] Routing payload into Tesseract-Vault pipeline...`,
        `  [KDF] Argon2id m=64KiB t=1 p=1 — deriving master key...`,
      );

      (async () => {
        try {
          const article  = (!match.html && match.loadContent) ? await match.loadContent() : match;
          const payload  = JSON.stringify({ id: article.id, title: article.title, html: article.html ?? article.content ?? '' });
          const encoder  = new TextEncoder();
          const rawBytes = encoder.encode(payload);

          const mod = await import('../../wasm/scale94_kernels.js');
          await mod.default({ module_or_path: '/wasm/scale94_kernels_bg.wasm' });

          const t0       = performance.now();
          const sealed   = mod.seal_markdown(rawBytes, passphrase);
          const elapsed  = (performance.now() - t0).toFixed(1);

          const t = new Date().toLocaleTimeString('en-US', { hour12: false });

          if (!sealed || sealed.length === 0) {
            setSystemLogs(prev => [...prev,
              { time: t, msg: `  EXPORT_FAIL :: seal_markdown returned empty — passphrase or WASM error.` },
            ].slice(-2000));
            return;
          }

          // Trigger download
          const blob = new Blob([sealed], { type: 'application/octet-stream' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href     = url;
          a.download = `${match.id}.tesseract`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setSystemLogs(prev => [...prev,
            { time: t, msg: `  [OK]  AES-256-GCM ENCRYPT : PASS`, rust: true },
            { time: t, msg: `  [OK]  BLAKE3 SEAL          : BOUND`, rust: true },
            { time: t, msg: `  [SEC] WASM linear memory   : ZEROIZED`, rust: true },
            { time: t, msg: `  [SYS] EXPORT COMPLETE — ${match.id}.tesseract  (${sealed.length} bytes, ${elapsed}ms)`, rust: true },
            { time: t, msg: passphrase === 'TESSERACT-EXPORT-SCALE94'
                ? `  [KEY] DEFAULT PASSPHRASE: TESSERACT-EXPORT-SCALE94  ← store this`
                : `  [KEY] Passphrase: <user-supplied>` },
          ].slice(-2000));
        } catch (err) {
          const t = new Date().toLocaleTimeString('en-US', { hour12: false });
          setSystemLogs(prev => [...prev,
            { time: t, msg: `  EXPORT_ERROR :: ${err.message}` },
          ].slice(-2000));
        }
      })();
      return;
    }

    // ── clear ─────────────────────────────────────────────────────────────────
    if (action === 'clear') {
      setSystemLogs([]);
      executeCommand(rawCmd, "System log cleared.");
      return;
    }

    // ── breach ────────────────────────────────────────────────────────────────
    if (action === 'breach') {
      log(`COMMAND: ${rawCmd}`);
      logs(
        `  BREACH_PROTOCOL :: Scanning ICE node...`,
        `  MILITECH MANTIS v4.2 detected – initiating datamining sequence`,
        `  RAM cost: 4 units`,
      );
      applyEcoCost('breach');
      setBreachOpen(true);
      return;
    }

    // ── relic ─────────────────────────────────────────────────────────────────
    if (action === 'relic') {
      log(`COMMAND: ${rawCmd}`);
      logs(
        `  RELIC_CHIP :: Arasaka Secure Your Soul v2.1 – MALFUNCTION DETECTED`,
        `  NEURAL_BRIDGE :: Integrity 23% – cascading failure imminent`,
        `  WARNING: Soulkiller engram overwrite in progress...`,
      );
      setRelicMode(true);

      let tick = 0;
      relicIntervalRef.current = setInterval(() => {
        const line = Array.from({ length: 8 }, () => HEX_POOL[Math.floor(Math.random() * HEX_POOL.length)]).join(' ');
        const msg = tick % 4 === 0
          ? `  ${ERR_TYPES[Math.floor(Math.random() * ERR_TYPES.length)]} :: ${line}`
          : `  0x${line.replace(/ /g, '')}`;
        setSystemLogs(prev => [...prev, { time: now, msg, rust: tick % 4 === 0 }].slice(-2000));
        tick++;
      }, 120);

      relicTimeoutRef.current = setTimeout(() => {
        clearInterval(relicIntervalRef.current);
        relicIntervalRef.current = null;
        setRelicMode(false);
        const t = new Date().toLocaleTimeString('en-US', { hour12: false });
        setSystemLogs(prev => [...prev,
          { time: t, msg: `  RELIC_CHIP :: Emergency stabilization complete – neural bridge restored` },
          { time: t, msg: `  Shannon entropy: H = 4.721 bits – engram partially intact` },
        ].slice(-2000));
      }, 5000);
      return;
    }

    // ── exit ──────────────────────────────────────────────────────────────────
    if (action === 'exit') {
      executeCommand(rawCmd, "Session integrity maintained. Disconnecting terminal interface.");
      return;
    }

    // ── unknown ───────────────────────────────────────────────────────────────
    executeCommand(rawCmd, `ERROR: Command '${action}' not recognized. Type 'help' for assistance.`);
  }, []); // stable — reads state through ctxRef
}

// ── useAutocomplete ────────────────────────────────────────────────────────────
// Owns all keystroke-driven suggestion logic and suggestion execution.
// Extracted from App.jsx — no dynamic state reads, only stable setters +
// module-level data, so both returned callbacks have deps: [].

import { useCallback } from 'react';
import wasmRegistry  from '../../wasm/wasm.generated';
import kernelBuilds  from '../data/kernelBuilds';
import { normalizeQuery } from '../../lib/normalize';
import { CMD_MANIFEST }   from '../commands/runHelpers';

const norm = normalizeQuery;

export function useAutocomplete({
  setCommandInput, setSuggestions, setParamHint, setActiveSugg,
  appendSystemLog, handleKernelClick,
}) {
  // Fire a highlighted or clicked suggestion
  const executeSuggestion = useCallback((item) => {
    setSuggestions([]);
    setActiveSugg(-1);
    setParamHint('');

    // run / cmd completions — fill input, don't navigate
    if (item._type === 'run' || item._type === 'cmd') {
      setCommandInput(item._complete ?? item.name);
      return;
    }

    // kernel load — delegate to handleKernelClick
    setCommandInput('');
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    appendSystemLog({ time: t, msg: `COMMAND: load ${item.name}` });
    appendSystemLog({ time: t, msg: `Locating kernel module "${item.name}"...` });
    handleKernelClick(item);
  }, [setCommandInput, setSuggestions, setParamHint, setActiveSugg, appendSystemLog, handleKernelClick]);

  // Keystroke handler — populates suggestion list + param hint on every change
  const handleInputChange = useCallback((e) => {
    const val     = e.target.value;
    setCommandInput(val);
    const trimmed = val.trimStart();
    const lower   = trimmed.toLowerCase();

    if (lower.startsWith('load ')) {
      // load <keyword>: kernel fuzzy match
      const q = norm(trimmed.slice(5).trim());
      setSuggestions(
        q.length >= 1
          ? kernelBuilds
              .filter(k => norm(k.id).includes(q) || norm(k.name).includes(q))
              .slice(0, 5)
              .map(k => ({ ...k, _type: 'kernel' }))
          : []
      );
      setParamHint('');

    } else if (lower.startsWith('run ')) {
      // run <alias>: WASM registry match + param hinting
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
        const kq = norm(baseCmd);
        setSuggestions(
          Object.values(wasmRegistry)
            .filter(e => norm(e.id).includes(kq) || e.aliases?.some(a => norm(a).includes(kq)))
            .slice(0, 5)
            .map(e => ({
              id:        e.id,
              name:      e.aliases?.[0] ?? e.id,
              desc:      e.label,
              _type:     'run',
              _complete: `run ${e.aliases?.[0] ?? e.id} `,
            }))
        );
        setParamHint('');
      } else {
        // alias resolved, args being typed — param hint, dismiss dropdown
        setSuggestions([]);
        const kq    = norm(baseCmd);
        const entry = Object.values(wasmRegistry).find(e =>
          norm(e.id) === kq ||
          e.aliases?.some(a => norm(a) === kq) ||
          norm(e.id).includes(kq) ||
          e.aliases?.some(a => norm(a).includes(kq))
        );
        if (entry?.params?.length) {
          const typedArgCount = parts.length - 1;
          setParamHint(
            entry.params.slice(typedArgCount).map(p => `[${p.name}]`).join(' ')
          );
        } else {
          setParamHint('');
        }
      }

    } else if (trimmed && !lower.includes(' ')) {
      // bare partial — command prefix completion
      setSuggestions(
        CMD_MANIFEST.filter(c => c.name.startsWith(lower)).slice(0, 5).map(c => ({
          id:        c.name,
          name:      c.name,
          desc:      c.desc,
          _type:     'cmd',
          _complete: ['load', 'run', 'search'].includes(c.name) ? `${c.name} ` : c.name,
        }))
      );
      setParamHint('');

    } else {
      setSuggestions([]);
      setParamHint('');
    }

    setActiveSugg(-1);
  }, [setCommandInput, setSuggestions, setParamHint, setActiveSugg]);

  return { handleInputChange, executeSuggestion };
}

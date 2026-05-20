// useMercuryState.js — Mercury orbital state, WASM primary + JS fallback + 60s tick
//
// Mirrors LunarTab's WASM hook pattern. Returns the JSON shape from
// run_mercury_state (Rust) or getMercuryStateFallback (JS) — identical schema.

import { useState, useEffect, useMemo } from 'react';
import { loadWasm } from '../../wasm/wasmSingleton';
import { getMercuryStateFallback } from './mercuryStateFallback';

let _wasmMod = null;

function getMercuryFromWasm(date) {
  if (!_wasmMod || typeof _wasmMod.run_mercury_state !== 'function') return null;
  try {
    return JSON.parse(_wasmMod.run_mercury_state(date.getTime()));
  } catch {
    return null;
  }
}

export function useMercuryState() {
  const [now, setNow] = useState(() => new Date());
  const [wasmReady, setWasmReady] = useState(false);

  useEffect(() => {
    loadWasm().then(mod => { _wasmMod = mod; setWasmReady(true); }).catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMs = now.getTime();
  return useMemo(
    () => getMercuryFromWasm(now) ?? getMercuryStateFallback(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nowMs, wasmReady],
  );
}

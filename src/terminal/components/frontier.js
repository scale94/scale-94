// ── Compile frontier ─────────────────────────────────────────────────────────
// Pure geometry + copy for the Mercury terminator (spec 2026-07-17). The day/night
// frontier is a GAUGE of compile state: distinct kernels loaded push Mercury into
// twilight; distinct kernels that actually ran burn it to full day.

// Concave easing so a few loads read dramatically — no viewer loads all ~43 kernels,
// so ~4-5 loads must visibly dawn the planet. Tunable; sqrt is the starting curve.
export function ease(x) {
  const c = Math.max(0, Math.min(1, x));
  return Math.sqrt(c);
}

export function frontierFromTotals(totals, N) {
  const t = totals?.transmissions ?? {};
  const loaded = Object.keys(t.kernelsLoaded ?? {}).length;
  const run    = Object.keys(t.ranAliases ?? {}).length;
  if (!N || N <= 0) return { twilight: 0, day: 0, loaded, run };
  const twilight = ease(loaded / N);
  const day      = ease(Math.min(run, loaded) / N); // enforce run ≤ loaded invariant
  return { twilight, day, loaded, run };
}

// The legend is a lure, not a manual: it names where meaning lives (the kernels),
// never hands it over. First-draft copy — tune freely.
export function legendLine({ loaded, run }) {
  if (run > 0)    return `☿ daylight · ${run} burned into knowledge`;
  if (loaded > 0) return `☿ dawn · ${loaded} loaded, not yet real`;
  return '☿ night · no theory yet compiled';
}

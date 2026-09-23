// domainMass.js — how heavy each collider domain flies (spec §5.1).
//
// Mass is weight minus volatility from the domain's sphere-node feature
// vector, RANK-normalised across every collider domain. Rank, not min-max:
// the raw values skew volatile (mean f[4] 0.35 against mean f[11] 0.19), so a
// linear rescale would braid almost every beam. It is available the moment a
// domain is selected -- before collide() resolves -- which is the point: the
// ingress beams have to show it.
//
// Pure, no imports, Node-importable (scripts/_scentMass.mjs reads it).

export const DEFAULT_MASS = 0.5;

export const rawMass = (f) => f[11] - f[4];

export function rankNormalize(values) {
  const out = new Array(values.length).fill(DEFAULT_MASS);
  const idx = [];
  for (let i = 0; i < values.length; i++) if (Number.isFinite(values[i])) idx.push(i);
  const n = idx.length;
  if (n < 2) return out;
  idx.sort((a, b) => values[a] - values[b]);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && values[idx[j + 1]] === values[idx[i]]) j++;
    const rank = (i + j) / 2;               // ties share their average rank
    for (let k = i; k <= j; k++) out[idx[k]] = rank / (n - 1);
    i = j + 1;
  }
  return out;
}

export function buildDomainMass(nodeIds, nodeIdx, features) {
  const raw = nodeIds.map((id) => {
    const row = features[nodeIdx[id]];
    return row ? rawMass(row) : NaN;         // unknown node -> default, never a throw
  });
  return rankNormalize(raw);
}

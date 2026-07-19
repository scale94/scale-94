// auditPresets.js — one-click reference cases for the Open Ledger's audit
// form. Each preset fills location + all 7 PARAM_RANGES fields at once.
// Values are tuned against severityEngine.js's thresholds — see
// docs/superpowers/specs/2026-07-19-ledger-audit-presets-design.md for the
// derivation of every number.

export const AUDIT_PRESETS = [
  {
    key: 'mercury',
    label: 'MERCURY',
    tone: 'safe',
    siteName: 'Syri i Kaltër (Blue Eye spring), Albania',
    lat: 39.9269, lon: 20.0088,
    temp: 11, do: 11.5, bod: 1, dt: 0, epi: 1.2, nitrate: 2, flow: 48,
  },
  {
    key: 'germany',
    label: 'GERMANY',
    tone: 'safe',
    siteName: 'Rhine at Cologne, Germany',
    lat: 50.9375, lon: 6.9603,
    temp: 17, do: 9.5, bod: 6, dt: 3.5, epi: 2.5, nitrate: 18, flow: 42,
  },
  {
    key: 'usa',
    label: 'USA',
    tone: 'stress',
    siteName: 'Lower Mississippi at New Orleans, USA',
    lat: 29.9511, lon: -90.0715,
    temp: 23, do: 6.5, bod: 27, dt: 5, epi: 3.5, nitrate: 32, flow: 30,
  },
  {
    key: 'brazil',
    label: 'BRAZIL',
    tone: 'stress',
    siteName: 'Rio Doce estuary at Regência, Brazil (post-2015 Mariana dam disaster)',
    lat: -19.78, lon: -39.74,
    temp: 26, do: 4.5, bod: 35, dt: 2, epi: 4.5, nitrate: 25, flow: 22,
  },
  {
    key: 'north_korea',
    label: 'NORTH KOREA',
    tone: 'critical',
    // Speculative/satirical — no real public water-quality data exists for
    // North Korea. Hamhung is a real, known chemical-industry city; the
    // numbers themselves are not sourced, they're the worst case the model
    // can express.
    siteName: 'Hamhung industrial corridor, North Korea (unverified — no public data)',
    lat: 39.9186, lon: 127.535,
    temp: 33, do: 3, bod: 55, dt: 8, epi: 6.5, nitrate: 42, flow: 12,
  },
];

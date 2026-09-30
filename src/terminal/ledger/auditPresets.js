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

// Phase-3b presets (spec 2026-09-29 §3). Kernel values tuned by the same
// 2026-07-19 method against severityEngine.js thresholds toward each tone; the
// per-param tiers and reasons are in
// docs/superpowers/plans/2026-09-30-ledger-ocean-phase3b-rivers.md (Task 3).
// Like the first five they are narrative-tuned kernel inputs, not measurements;
// river course and discharge live in ocean/riverCourses.js. AUDIT_PRESETS above
// stays exactly as it was: its test pins those five.
export const EXTRA_PRESETS = [
  {
    key: 'yangtze',
    label: 'YANGTZE',
    tone: 'critical',
    // Wusongkou: the Huangpu mouth on the Yangtze estuary (coordinate from
    // Wikipedia "Huangpu River"; sources in ocean/riverCourses.js).
    siteName: 'Yangtze estuary at Wusongkou, Shanghai, China',
    lat: 31.3925, lon: 121.515,
    temp: 29, do: 3.5, bod: 45, dt: 5.5, epi: 6, nitrate: 38, flow: 15,
  },
  {
    key: 'ganges',
    label: 'GANGES',
    tone: 'critical',
    // The Padma (Ganges + Brahmaputra) joins the Meghna at Chandpur: the site
    // is on the channel that carries the combined flow drained at the estuary.
    siteName: 'Lower Meghna at Chandpur, Bangladesh (combined Ganges–Brahmaputra–Meghna flow)',
    lat: 23.2198, lon: 90.6304,
    temp: 30, do: 3.8, bod: 48, dt: 3, epi: 5.8, nitrate: 36, flow: 14,
  },
  {
    key: 'citarum',
    label: 'CITARUM',
    tone: 'critical',
    // Batujaya temple site, ~500 m from the lower Citarum (Wikipedia
    // Indonesia, "Situs Batujaya"); the earlier 6.12°S 107.03°E was not on it.
    siteName: 'Lower Citarum at Batujaya, Karawang, West Java, Indonesia',
    lat: -6.0556, lon: 107.1535,
    temp: 32, do: 2.5, bod: 58, dt: 7.5, epi: 6, nitrate: 44, flow: 10,
  },
  {
    key: 'danube',
    label: 'DANUBE',
    tone: 'safe',
    // Present-day conditions: the NW Black Sea hypoxia of the 1970s–80s largely
    // recovered after nutrient loads fell — the set's one repaid debt. Nitrate
    // sits just under the stress line: the legacy load still reaches the sea.
    siteName: 'Danube at Linz, Austria',
    lat: 48.31, lon: 14.29,
    temp: 12, do: 10.5, bod: 3, dt: 1.5, epi: 2.8, nitrate: 19, flow: 44,
  },
];

export const ALL_AUDIT_PRESETS = [...AUDIT_PRESETS, ...EXTRA_PRESETS];

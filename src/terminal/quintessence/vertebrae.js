// src/terminal/quintessence/vertebrae.js — the spine's three deliberate vertebrae (spec §4).
// Pure data + pure functions, no React: same discipline as spineStore / guidanceStore.
// This is spine domain knowledge, not view state — the eye's compass and the
// altar's mirror both read it, and a second copy is how tints drift.
//
// ORDER IS LOAD-BEARING: it must match missingVertebrae() in spineStore.js, so
// the mirror, the compass and the reliquary eyebrow all name the same "next".

export const PREVIEW_MAX = 28;

export function truncate(s, max = PREVIEW_MAX) {
  const str = String(s);
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

export const VERTEBRAE = [
  {
    key: 'trend', tab: 'bsky', label: 'bsky', tint: [56, 189, 248],   // sky-400 — /BSKY
    field: 'narcos payload', house: 'the bsky house',
    quoted: true,                                       // a trend label is a string literal
    preview: s => s.trend?.label ?? null,
  },
  {
    // `tab` is the INTERNAL route id (App.jsx activeTab, NAV_TINTS) and stays
    // 'manifesto'; `label` is what the user reads. Never render `tab` directly.
    key: 'council', tab: 'manifesto', label: 'accretion', tint: [167, 139, 250],  // violet-400 — /ACCRETION
    field: 'friction pair', house: 'the accretion house',
    preview: s => (s.council?.pair?.length ? s.council.pair.join(' × ') : null),
  },
  {
    // violet-400, NOT fuchsia (spec §4.1). /LUNAR is violet in the nav
    // (App.jsx:1151), in NAV_TINTS, and in its own tab body (LunarTab.jsx:987).
    // [217,70,239] is fuchsia-500 = NAV_TINTS.scaling — the eye leaned at the
    // wrong house for as long as no test pinned this value. Task 2 pins it.
    key: 'phase', tab: 'lunar', label: 'lunar', tint: [167, 139, 250],  // violet-400 — /LUNAR
    field: 'dryness', house: 'the lunar house',
    preview: s => s.phase ?? null,
  },
];

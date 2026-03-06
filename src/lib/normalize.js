/**
 * normalizeQuery
 *
 * Single canonical normalization function used by:
 *   - App.jsx              (autocomplete, load command fuzzy-match)
 *   - useTerminalCommands  (load / search command matching)
 *   - import-kernel.js     (duplicate-title dedup via sovereignSlug)
 *
 * Algorithm:
 *   1. NFD decomposition  → splits accented glyphs into base + combining mark
 *      e.g. "ü" → "u" + "\u0308"
 *   2. Strip combining diacritics (U+0300–U+036F)
 *      e.g. "für" → "fur", "Ångström" → "angstrom"
 *   3. Lowercase
 *   4. Remove everything except a–z and 0–9
 *      e.g. "fish_scale-11.7" → "fishscale117"
 *
 * Guarantees 100% slug symmetry between the loader pipeline and the UI.
 */
export function normalizeQuery(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

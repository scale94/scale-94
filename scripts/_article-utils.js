#!/usr/bin/env node
/**
 * _article-utils.js — Level 20: Shared Article Metadata Layer
 *
 * Exports shared article metadata helpers used across import-kernel.js,
 * import-academic.js, import-system.js, import-legislation.js, and
 * import-kernel-js.js.
 *
 * Exports:
 *   STATUS_MAP                    — canonical status keyword table
 *   canonicalStatus(raw)          — normalise raw status → ACTIVE/DEPRECATED/EXPERIMENTAL
 *   TYPE_ALIASES                  — canonical type alias map
 *   canonicalType(raw)            — normalise raw type → kernel_doc/fiction/research/null
 *   chunkFileName(id)             — article ID → filesystem-safe chunk name
 *   buildLeanArticle(fields)      — construct the lean index entry object
 */

// ─── STATUS MAPPING ───────────────────────────────────────────────────────────
// Incoming status keywords are canonicalised to ACTIVE / DEPRECATED / EXPERIMENTAL.

export const STATUS_MAP = {
  ACTIVE:       ['active', 'online', 'running', 'stable', 'emergent', 'new', 'rising'],
  DEPRECATED:   ['archived', 'archive', 'historical', 'frozen', 'locked', 'final', 'legacy'],
  EXPERIMENTAL: ['proposed', 'draft', 'wip', 'platinum', 'apex', 'gated'],
};

/**
 * Normalise a raw frontmatter status string to one of the three canonical values.
 * Unrecognised values fall back to 'ACTIVE'.
 */
export function canonicalStatus(raw) {
  if (!raw) return 'ACTIVE';
  const lower = raw.toLowerCase().trim();
  for (const [canonical, keywords] of Object.entries(STATUS_MAP)) {
    if (keywords.includes(lower)) return canonical;
  }
  const upper = raw.toUpperCase().trim();
  if (STATUS_MAP[upper]) return upper;
  return 'ACTIVE';
}

// ─── TYPE MAPPING ─────────────────────────────────────────────────────────────
// Canonical types: kernel_doc | fiction | research
// 'kernel' (bare) used in many frontmatters — normalised to 'kernel_doc'.

export const TYPE_ALIASES = {
  kernel:     'kernel_doc',
  kernel_doc: 'kernel_doc',
  fiction:    'fiction',
  research:   'research',
};

/**
 * Normalise a raw frontmatter type string to a canonical type.
 * Returns null for unrecognised values (caller falls back to inferType()).
 */
export function canonicalType(raw) {
  return TYPE_ALIASES[raw] || null;
}

// ─── CHUNK FILE NAMING ────────────────────────────────────────────────────────

/**
 * Convert an article ID to a filesystem-safe chunk filename (no extension).
 * Replaces chars outside [A-Za-z0-9\-._] (e.g. ∞, spaces) with underscores.
 *
 * @param {string} id
 * @returns {string}
 */
export function chunkFileName(id) {
  return id.replace(/[^a-zA-Z0-9\-._]/g, '_');
}

// ─── LEAN ARTICLE BUILDER ────────────────────────────────────────────────────

/**
 * Construct the lean index entry object used in CAS JSON arrays.
 * Only includes fields that are universally present across all importers.
 * Importer-specific fields (severity, location, etc.) are added by the caller.
 *
 * @param {object} fields
 * @param {string}   fields.id
 * @param {string}   fields.type
 * @param {string}   fields.date
 * @param {string}   [fields.lastModified]
 * @param {string}   fields.title
 * @param {string}   [fields.subtitle]
 * @param {string}   [fields.status]
 * @param {string}   [fields.readTime]
 * @param {string[]} [fields.tags]
 * @param {string}   [fields.len]
 * @returns {object}
 */
export function buildLeanArticle({ id, type, date, lastModified, title, subtitle, status, readTime, tags, len }) {
  return {
    id,
    type,
    date,
    lastModified:  lastModified  ?? null,
    title,
    subtitle:      subtitle      ?? '',
    status:        status        ?? 'ACTIVE',
    readTime:      readTime      ?? '',
    tags:          tags          ?? [],
    len:           len           ?? '',
  };
}

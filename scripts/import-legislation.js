#!/usr/bin/env node
/**
 * import-legislation.js — Level 21: Governance Extraction
 *
 * Two-phase pipeline:
 *
 *   Phase 1 — FETCH → STUB
 *     Fetches grey-c0/legislation JSON, generates one .md file per entry
 *     into content/legislation/. Stubs include full YAML frontmatter +
 *     structured markdown body + attribution block. Skips entries whose
 *     .md already exists unless --force is passed.
 *
 *   Phase 2 — STUB → CAS
 *     Reads all .md files in content/legislation/, pre-renders markdown
 *     → terminal HTML (red/orange threat palette), writes:
 *       src/terminal/data/legislation_chunks/{id}.js  — Tailwind discovery
 *       public/kernel/chunks/{id}.json                — runtime fetch target
 *       public/kernel/legislation.{hash}.json         — lean index
 *     Updates manifest.json key: "legislation".
 *
 * Usage:
 *   node scripts/import-legislation.js              # fetch + build
 *   node scripts/import-legislation.js --stub-only  # Phase 1 only
 *   node scripts/import-legislation.js --build-only # Phase 2 only (skip fetch)
 *   node scripts/import-legislation.js --dry        # dry run (no writes)
 *   node scripts/import-legislation.js --force      # bypass cache + overwrite stubs
 */

import fs   from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import {
  atomicWrite, fileHash, loadCache, saveCache, sha256Prefix,
} from './_build-utils.js';
import { KERNEL_DIR, updateManifest, purgeStaleFiles } from './_manifest-utils.js';
import { renderMarkdown, THEME_RED } from './_renderers.js';
import { chunkFileName } from './_article-utils.js';

// ─── PATHS ────────────────────────────────────────────────────────────────────

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const ROOT         = path.join(__dirname, '..');
const CONTENT_DIR  = path.join(ROOT, 'content', 'legislation');
const CHUNKS_DIR   = path.join(ROOT, 'src', 'terminal', 'data', 'legislation_chunks');
const CHUNKS_CAS   = path.join(KERNEL_DIR, 'chunks');

// ─── FLAGS ────────────────────────────────────────────────────────────────────

const DRY_RUN    = process.argv.includes('--dry');
const FORCE      = process.argv.includes('--force');
const STUB_ONLY  = process.argv.includes('--stub-only');
const BUILD_ONLY = process.argv.includes('--build-only');

// ─── SOURCE ───────────────────────────────────────────────────────────────────

const SOURCE_URL =
  'https://raw.githubusercontent.com/grey-c0/legislation/main/public/legislation.json';

const ATTRIBUTION = `\n---\n\n> **Source:** @grey-c0 / Navigators Guild  \n> Retrieved via [grey-c0/legislation](https://github.com/grey-c0/legislation)  \n> Integrated into scale_9.4 CAS pipeline — do not edit stubs manually.\n`;

// ─── FETCH ────────────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'scale_9.4-import-legislation/1.0' } }, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} — ${url}`));
        res.resume();
        return;
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error(`JSON parse failed: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// ─── SAFE FIELD ACCESS ────────────────────────────────────────────────────────

function safe(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val).trim() || fallback;
}

function safeArr(val) {
  if (!Array.isArray(val)) return [];
  return val.filter(v => v !== null && v !== undefined);
}

// ─── ID GENERATION ────────────────────────────────────────────────────────────
// Prefer the source `id` field; normalise to LAW-{SLUG} if missing.

function legislationId(entry) {
  const raw = safe(entry.id);
  if (raw) {
    return 'LAW-' + raw
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
  const slug = safe(entry.commonName || entry.legalName, 'UNKNOWN')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return `LAW-${slug}`;
}

// ─── SEVERITY BADGE ───────────────────────────────────────────────────────────

const SEVERITY_LABEL = ['MINIMAL', 'LOW', 'MODERATE', 'ELEVATED', 'HIGH', 'CRITICAL'];

function severityLabel(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'UNKNOWN';
  return SEVERITY_LABEL[Math.min(Math.max(Math.round(n), 0), 5)] ?? 'UNKNOWN';
}

// ─── STUB GENERATOR ───────────────────────────────────────────────────────────
// Builds the full .md content for one legislation entry.

function buildStub(entry, id) {
  const title       = safe(entry.commonName || entry.legalName, id);
  const legalName   = safe(entry.legalName,   title);
  const location    = safe(entry.location,    'Unknown');
  const jurisdiction = safe(entry.jurisdiction, 'Unknown');
  const status      = safe(entry.status,      'unknown').toUpperCase();
  const description = safe(entry.description, 'No description available.');
  const notes       = safe(entry.notes,       '');
  const categories  = safeArr(entry.categories).map(c => safe(c)).filter(Boolean);
  const sources     = safeArr(entry.sources);

  const sevScore    = entry.severity?.score;
  const sevRationale = safe(entry.severity?.rationale, '');
  const sevLabel    = severityLabel(sevScore);

  // Tags: categories + location words (capitalised)
  const locationTags = location.split(/[\s,]+/)
    .filter(w => w.length > 2)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const tags = [
    'Legislation', 'Governance', 'Surveillance',
    ...categories.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
    ...locationTags,
  ];
  const uniqueTags = [...new Set(tags)];

  // ── YAML frontmatter ────────────────────────────────────────────────────────
  const fm = [
    '---',
    `id: ${id}`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    `legalName: "${legalName.replace(/"/g, '\\"')}"`,
    `type: "legislation"`,
    `status: "ACTIVE"`,
    `severity: ${sevScore ?? 'null'}`,
    `severityLabel: "${sevLabel}"`,
    `location: "${location}"`,
    `jurisdiction: "${jurisdiction}"`,
    `legislationStatus: "${status}"`,
    `categories: [${categories.map(c => `"${c}"`).join(', ')}]`,
    `tags: [${uniqueTags.map(t => `"${t}"`).join(', ')}]`,
    `date: "${new Date().toISOString().slice(0, 10)}"`,
    `sourceUrl: "${SOURCE_URL}"`,
    '---',
    '',
  ].join('\n');

  // ── Body ────────────────────────────────────────────────────────────────────
  const lines = [];

  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`## ${legalName}`);
  lines.push('');

  // Metadata table
  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(`| **Location** | ${location} |`);
  lines.push(`| **Jurisdiction** | ${jurisdiction} |`);
  lines.push(`| **Status** | ${status} |`);
  if (sevScore !== null && sevScore !== undefined) {
    lines.push(`| **Severity** | ${sevScore}/5 — ${sevLabel} |`);
  }
  if (categories.length > 0) {
    lines.push(`| **Categories** | ${categories.join(', ')} |`);
  }
  lines.push('');

  // Description
  lines.push('## Description');
  lines.push('');
  lines.push(description);
  lines.push('');

  // Severity rationale
  if (sevRationale) {
    lines.push('## Severity Rationale');
    lines.push('');
    lines.push(`> ${sevRationale}`);
    lines.push('');
  }

  // Implementation notes
  if (notes) {
    lines.push('## Implementation Notes');
    lines.push('');
    lines.push(notes);
    lines.push('');
  }

  // Sources
  if (sources.length > 0) {
    lines.push('## Sources');
    lines.push('');
    for (const src of sources) {
      const srcUrl  = safe(src.url,  '#');
      const srcDesc = safe(src.desc || src.description, srcUrl);
      const srcType = safe(src.type, 'reference').toUpperCase();
      lines.push(`- **[${srcType}]** [${srcDesc}](${srcUrl})`);
    }
    lines.push('');
  }

  return fm + lines.join('\n') + ATTRIBUTION;
}

// ─── PHASE 1: FETCH → STUBS ──────────────────────────────────────────────────

async function phaseStub() {
  console.log('\n  ── Phase 1: FETCH → STUB ──────────────────────────────────');

  let payload;
  try {
    payload = await fetchJson(SOURCE_URL);
  } catch (err) {
    console.error(`\n  ✗ Fetch failed: ${err.message}`);
    process.exit(1);
  }

  // Support both { entries: [...] } and bare [...]
  const entries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.entries) ? payload.entries : [];

  if (entries.length === 0) {
    console.error('  ✗ No entries found in source JSON. Check payload structure.');
    process.exit(1);
  }

  console.log(`  ✓ Fetched ${entries.length} entries from source`);

  if (!DRY_RUN) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  let written  = 0;
  let skipped  = 0;
  const ids    = new Set();

  for (const entry of entries) {
    const id   = legislationId(entry);

    // Deduplicate IDs within the same payload
    let uniqueId = id;
    if (ids.has(id)) {
      let n = 2;
      while (ids.has(`${id}-${n}`)) n++;
      uniqueId = `${id}-${n}`;
      console.warn(`  ⚠ Duplicate id "${id}" → renamed to "${uniqueId}"`);
    }
    ids.add(uniqueId);

    const filename = `${uniqueId}.md`;
    const destPath = path.join(CONTENT_DIR, filename);

    if (!FORCE && fs.existsSync(destPath)) {
      skipped++;
      continue;
    }

    const stub = buildStub(entry, uniqueId);
    if (DRY_RUN) {
      console.log(`  [DRY] Would write: content/legislation/${filename}`);
    } else {
      atomicWrite(destPath, stub);
      console.log(`  + ${filename}`);
    }
    written++;
  }

  console.log(`\n  ✓ Phase 1 complete — ${written} stub(s) written, ${skipped} skipped (--force to overwrite)`);
  return entries.length;
}

// ─── PHASE 2: STUBS → CAS ────────────────────────────────────────────────────

function phaseBuild() {
  console.log('\n  ── Phase 2: STUB → CAS ────────────────────────────────────');

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`  ✗ content/legislation/ not found. Run without --build-only first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.log('  No .md files found in content/legislation/.');
    return;
  }

  if (!DRY_RUN) {
    fs.mkdirSync(CHUNKS_DIR,  { recursive: true });
    fs.mkdirSync(CHUNKS_CAS,  { recursive: true });
    fs.mkdirSync(KERNEL_DIR,  { recursive: true });
  }

  const cache    = FORCE ? {} : loadCache();
  const articles = [];

  for (const file of files) {
    const fullPath     = path.join(CONTENT_DIR, file);
    const raw          = fs.readFileSync(fullPath, 'utf8');
    const rawHash      = fileHash(raw);
    const cacheKey     = `legislation/${file}`;
    const lastModified = fs.statSync(fullPath).mtime.toISOString().slice(0, 10);

    const { data: fm, content: body } = matter(raw);

    // Hard-require id + title — both are always present in generated stubs.
    const id    = String(fm.id    || '').trim();
    const title = String(fm.title || '').trim();
    if (!id || !title) {
      console.error(`  ✗ SCHEMA VIOLATION in ${file}: missing id or title`);
      process.exit(1);
    }

    const subtitle     = String(fm.legalName || fm.subtitle || '').slice(0, 120);
    const date         = String(fm.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const severity     = fm.severity ?? null;
    const severityLabel = String(fm.severityLabel || '').trim();
    const location     = String(fm.location     || '').trim();
    const jurisdiction = String(fm.jurisdiction || '').trim();
    const legStatus    = String(fm.legislationStatus || '').trim();

    const rawTags = fm.tags;
    const tags = Array.isArray(rawTags) ? rawTags.map(String) :
                 typeof rawTags === 'string'
                   ? rawTags.split(',').map(t => t.trim()).filter(Boolean)
                   : ['Legislation', 'Governance'];

    const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
    const len       = `${wordCount} WDS`;
    const readTime  = `${Math.max(1, Math.round(wordCount / 200))} min read`;

    console.log(`  Processing: ${file}`);
    console.log(`    id:       ${id}`);
    console.log(`    severity: ${severity}/5 — ${severityLabel}`);
    console.log(`    location: ${location}`);

    if (!DRY_RUN) {
      const cname         = chunkFileName(id);
      const chunkJsPath   = path.join(CHUNKS_DIR, `${cname}.js`);
      const chunkJsonPath = path.join(CHUNKS_CAS,  `${cname}.json`);

      const isCacheHit = !FORCE
        && cache[cacheKey] === rawHash
        && fs.existsSync(chunkJsPath)
        && fs.existsSync(chunkJsonPath);

      if (!isCacheHit) {
        const html = renderMarkdown(body, THEME_RED);

        const jsChunk = [
          `// ${cname}.js — DO NOT EDIT MANUALLY.`,
          '// Generated by: node scripts/import-legislation.js',
          '// Purpose: Tailwind CSS class discovery only. Runtime uses public/kernel/chunks/',
          'export default {',
          `  html: ${JSON.stringify(html)},`,
          `  len:  ${JSON.stringify(len)},`,
          '};',
          '',
        ].join('\n');

        atomicWrite(chunkJsPath,   jsChunk);
        atomicWrite(chunkJsonPath, JSON.stringify({ html, len }) + '\n');
        cache[cacheKey] = rawHash;
      } else {
        console.log(`    [CACHE HIT] ${id}`);
      }

      articles.push({
        id, title, subtitle, date, lastModified,
        type: 'legislation',
        severity, severityLabel, location, jurisdiction, legStatus,
        tags, len, readTime,
      });
    }
  }

  if (DRY_RUN) {
    console.log(`\n  [DRY] Would process ${files.length} legislation stub(s).`);
    return;
  }

  // ── CAS lean index ──────────────────────────────────────────────────────────
  const index = articles.map(a => ({
    id:              a.id,
    type:            'legislation',
    date:            a.date,
    lastModified:    a.lastModified,
    title:           a.title,
    subtitle:        a.subtitle,
    status:          'ACTIVE',
    severity:        a.severity,
    severityLabel:   a.severityLabel,
    location:        a.location,
    jurisdiction:    a.jurisdiction,
    legislationStatus: a.legStatus,
    readTime:        a.readTime,
    tags:            a.tags,
    len:             a.len,
  }));

  const indexJson = JSON.stringify(index, null, 2) + '\n';
  const indexHash = sha256Prefix(indexJson);
  purgeStaleFiles(KERNEL_DIR, 'legislation', 'json', indexHash);
  atomicWrite(path.join(KERNEL_DIR, `legislation.${indexHash}.json`), indexJson);
  saveCache(cache);
  updateManifest({ legislation: `legislation.${indexHash}.json` });

  console.log(`\n  ✓ ${articles.length} legislation chunk(s) → legislation_chunks/ + public/kernel/chunks/`);
  console.log(`  ✓ legislation.${indexHash}.json → public/kernel/`);
  console.log(`  ✓ manifest.json updated (legislation=${indexHash})`);
}

// ─── ENTRYPOINT ───────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  LEGISLATION IMPORT — Level 21: Governance Extraction ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (DRY_RUN)    console.log('  [DRY RUN — no files will be written]\n');
  if (FORCE)      console.log('  [--force — cache bypassed, stubs overwritten]\n');
  if (STUB_ONLY)  console.log('  [--stub-only — Phase 2 will be skipped]\n');
  if (BUILD_ONLY) console.log('  [--build-only — Phase 1 (fetch) will be skipped]\n');

  if (!BUILD_ONLY) await phaseStub();
  if (!STUB_ONLY)  phaseBuild();

  console.log('\n  ✓ SYSTEM_KERNEL_LOG: import-legislation complete\n');
}

main().catch(err => {
  console.error('\n  ✗ FATAL:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * import-kernel.js — Level 9 Hardened
 *
 * Scans a directory for .md files and integrates them into
 * src/terminal/data/articles.soma.js and src/terminal/data/kernelBuilds.js
 *
 * Injection targets must contain the marker pair:
 *   /* @@INJECT_START@@ * /
 *   /* @@INJECT_END@@ * /
 *
 * Usage:
 *   node import-kernel.js                        # scan ./content/
 *   node import-kernel.js ./my-kernels/          # scan custom dir
 *   node import-kernel.js ./my-kernels/ --dry    # preview only, no writes
 *   node import-kernel.js ./my-kernels/ --force  # re-import existing titles
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { normalizeQuery as sovereignSlug } from './src/lib/normalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CONTENT_DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'content');

const DRY_RUN = process.argv.includes('--dry');
const FORCE   = process.argv.includes('--force');

const ARTICLES_PATH = path.join(__dirname, 'src/terminal/data/articles.soma.js');
const BUILDS_PATH   = path.join(__dirname, 'src/terminal/data/kernelBuilds.js');

// ─── EXCLUSION LIST ───────────────────────────────────────────────────────────

const EXCLUDE_FILES = new Set([
  'Soft_Climb_Sequence.md',
]);

// ─── STATUS MAPPING ───────────────────────────────────────────────────────────
// Incoming status keywords are mapped to one of three canonical values.

const STATUS_MAP = {
  ACTIVE:       ['active', 'online', 'running', 'stable', 'emergent', 'new', 'rising'],
  DEPRECATED:   ['archived', 'archive', 'historical', 'frozen', 'locked', 'final', 'legacy'],
  EXPERIMENTAL: ['proposed', 'draft', 'wip', 'platinum', 'apex', 'gated'],
};

function canonicalStatus(raw) {
  if (!raw) return 'ACTIVE';
  const lower = raw.toLowerCase().trim();
  for (const [canonical, keywords] of Object.entries(STATUS_MAP)) {
    if (keywords.includes(lower)) return canonical;
  }
  // Pass through if already a known canonical value
  const upper = raw.toUpperCase().trim();
  if (STATUS_MAP[upper]) return upper;
  return 'ACTIVE';
}


// ─── VERSION EXTRACTION (SEMVER-AWARE) ───────────────────────────────────────
// Priority: vX.Y.Z[-pre] > X.Y.Z (3-or-more part) > X.Y (2-part) > '1.0'

function extractVersion(base) {
  // Explicit v-tag with optional pre-release: v1.2.3-beta, V11.7.0
  const tagged = base.match(/(?:^|[._-])v(\d+\.\d+(?:\.\d+)*(?:-[a-zA-Z0-9.]+)?)/i);
  if (tagged) return tagged[1];

  // Three-or-more part: 11.7.0, 9.9.9.9, 4.5.7
  const multi = base.match(/(?:^|[._-])(\d+(?:\.\d+){2,})/);
  if (multi) return multi[1];

  // Two-part: 11.7, 4.5
  const two = base.match(/(?:^|[._-])(\d+\.\d+)/);
  if (two) return two[1];

  return '1.0';
}

// ─── ID GENERATOR ────────────────────────────────────────────────────────────

function generateId(filename, fm, existingIds) {
  if (fm.id) return fm.id;

  const base    = path.basename(filename, '.md');
  const version = extractVersion(base);

  // Strip the version suffix then split into word segments for prefix
  const stripped = base
    .replace(/[._-]v?\d+([._]\d+)*/i, '')
    .split(/[._-]/)
    .filter(Boolean);

  let prefix;
  if (stripped.length === 0) {
    prefix = base.slice(0, 4).toUpperCase();
  } else if (/^v\d/i.test(stripped[0])) {
    // First segment is already a version label (v3, v11) — use verbatim
    prefix = stripped[0].toUpperCase();
  } else if (stripped.length === 1) {
    prefix = stripped[0].slice(0, 4).toUpperCase();
  } else {
    prefix = stripped.map(w => w[0].toUpperCase()).join('').slice(0, 5);
  }

  let id       = `${prefix}-${version}`;
  let suffix   = 1;
  const origin = id;
  while (existingIds.has(id)) id = `${origin}-${suffix++}`;

  return id;
}

function buildNameFromFilename(filename) {
  return path.basename(filename, '.md')
    .toUpperCase()
    .replace(/[.\s]/g, '_')
    .replace(/-/g, '_');
}

// ─── TYPE INFERENCE ───────────────────────────────────────────────────────────

function inferType(filename, body) {
  const lower = filename.toLowerCase();
  if (lower.includes('kernel') || lower.includes('soma') || lower.includes('protocol')) return 'kernel_doc';
  if (lower.includes('research') || lower.includes('study') || lower.includes('analysis'))  return 'research';
  if (lower.includes('fiction') || lower.includes('story') || lower.includes('narrative'))  return 'fiction';
  if (/fiction|story|narrative|she said|he said/i.test(body.slice(0, 500)))                 return 'fiction';
  return 'kernel_doc';
}

function inferStatusFromFilename(filename) {
  const lower = filename.toLowerCase();
  for (const [canonical, keywords] of Object.entries(STATUS_MAP)) {
    if (keywords.some(k => lower.includes(k))) return canonical;
  }
  return 'ACTIVE';
}

// ─── CONTENT INFERENCE ───────────────────────────────────────────────────────

function deriveMetadata(body, filename) {
  const lines = body.split('\n');
  const h1    = lines.find(l => /^#(?!#)[ \t]+/.test(l));
  const h2    = lines.find(l => /^##(?!#)[ \t]+/.test(l) && l !== h1);
  const bq    = lines.find(l => /^>[ \t]/.test(l));

  const title = h1
    ? h1.replace(/^#[ \t]+/, '').replace(/\*{1,3}(.+?)\*{1,3}/g, '$1').trim().toUpperCase()
    : path.basename(filename, '.md').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toUpperCase();

  const subtitle = h2
    ? h2.replace(/^##[ \t]+/, '').trim()
    : bq
      ? bq.replace(/^>[ \t]*\*?/, '').replace(/\*$/, '').trim()
      : '';

  const dateMatch = body.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const date      = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  // Extract tags from heading words
  const headerWords  = body.match(/^#{1,4}[ \t]+(.+)/gm) || [];
  const tagCandidates = [];
  for (const h of headerWords) {
    const words = h.replace(/^#{1,4}[ \t]+/, '').split(/[\s_/.\\/]+/);
    for (const w of words) {
      if (
        w.length > 3 &&
        /^[A-Z]/.test(w) &&
        !/^(The|And|For|With|From|Into|This|Violet|Kernel|V\d+)$/i.test(w)
      ) {
        tagCandidates.push(w.replace(/[^a-zA-Z0-9-]/g, ''));
      }
    }
  }
  const tags = [...new Set(tagCandidates)].filter(t => t.length > 1).slice(0, 5);

  const wordCount = body.split(/\s+/).length;
  const readTime  = `${Math.max(1, Math.round(wordCount / 200))} min read`;

  return { title, subtitle, date, tags, readTime };
}

// ─── SERIALISERS — JSON.stringify for every field ─────────────────────────────
// Using JSON.stringify() eliminates all template-literal escaping issues:
//   - backticks, ${}, and backslashes are safely encoded as \u0060, \\, etc.
//   - No manual .replace() chains needed.

function serialiseArticle(a) {
  return [
    '  {',
    `    id: ${JSON.stringify(a.id)},`,
    `    type: ${JSON.stringify(a.type)},`,
    `    date: ${JSON.stringify(a.date)},`,
    `    title: ${JSON.stringify(a.title)},`,
    `    subtitle: ${JSON.stringify(a.subtitle)},`,
    `    status: ${JSON.stringify(a.status)},`,
    `    readTime: ${JSON.stringify(a.readTime)},`,
    `    tags: ${JSON.stringify(a.tags)},`,
    `    content: ${JSON.stringify(a.content)},`,
    '  }',
  ].join('\n');
}

function serialiseBuild(b) {
  return `  { id: ${JSON.stringify(b.id)}, articleId: ${JSON.stringify(b.articleId)}, name: ${JSON.stringify(b.name)}, status: ${JSON.stringify(b.status)}, desc: ${JSON.stringify(b.desc)} }`;
}

// ─── EXISTING-ID / TITLE SCANNERS ────────────────────────────────────────────
// Scan ALL .js files in the data directory so IDs declared in sub-files
// (articles.soma.js, articles.misc.js, kernelBuilds.js) are all captured.

function parseExistingIds(filePath) {
  const dataDir = path.dirname(filePath);
  const ids     = new Set();
  const jsFiles = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter(f => f.endsWith('.js')).map(f => path.join(dataDir, f))
    : [];
  for (const f of jsFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const re  = /\bid:\s*["'`]([^"'`\n]+)["'`]/g;
    let m;
    while ((m = re.exec(src)) !== null) ids.add(m[1]);
  }
  return ids;
}

function parseExistingTitles(filePath) {
  const dataDir = path.dirname(filePath);
  const titles  = new Set();
  const jsFiles = fs.existsSync(dataDir)
    ? fs.readdirSync(dataDir).filter(f => f.endsWith('.js')).map(f => path.join(dataDir, f))
    : [];
  for (const f of jsFiles) {
    const src = fs.readFileSync(f, 'utf8');
    const re  = /\btitle:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(src)) !== null) titles.add(sovereignSlug(m[1]));
  }
  return titles;
}

// ─── MARKER-BASED INJECTION ───────────────────────────────────────────────────

const INJECT_START = '/* @@INJECT_START@@ */';
const INJECT_END   = '/* @@INJECT_END@@ */';

function batchInject(filePath, items, serialiseFn) {
  if (!items.length) return false;
  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ Data file not found: ${filePath}`);
    return false;
  }

  const src      = fs.readFileSync(filePath, 'utf8');
  const startIdx = src.indexOf(INJECT_START);
  const endIdx   = src.indexOf(INJECT_END);

  if (startIdx === -1 || endIdx === -1) {
    console.error(`  ✗ Injection markers not found in ${path.basename(filePath)}`);
    console.error(`    Ensure the file contains both:`);
    console.error(`      ${INJECT_START}`);
    console.error(`      ${INJECT_END}`);
    return false;
  }

  // Content already between the markers (previous injections on re-run with --force)
  const existing = src.slice(startIdx + INJECT_START.length, endIdx).trim();
  const payload  = items.map(serialiseFn).join(',\n');

  const inner = existing
    ? `\n${existing},\n${payload},\n`
    : `\n${payload},\n`;

  const injected =
    src.slice(0, startIdx + INJECT_START.length) +
    inner +
    src.slice(endIdx);

  fs.writeFileSync(filePath, injected, 'utf8');
  return true;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

function run() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   KERNEL IMPORT — LEVEL 9 HARDENED      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('  [DRY RUN — no files will be written]\n');
  if (FORCE)   console.log('  [--force — duplicate-title guard disabled]\n');

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`  ✗ Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONTENT_DIR).filter(f => {
    if (!f.endsWith('.md'))      return false;
    if (EXCLUDE_FILES.has(f))   return false;
    return true;
  });

  if (files.length === 0) {
    console.log('  No .md files found in', CONTENT_DIR);
    process.exit(0);
  }

  const existingIds    = parseExistingIds(ARTICLES_PATH);
  const existingBldIds = parseExistingIds(BUILDS_PATH);
  const allIds         = new Set([...existingIds, ...existingBldIds]);
  const existingTitles = FORCE ? new Set() : parseExistingTitles(ARTICLES_PATH);

  let processed = 0;
  let skipped   = 0;
  const pendingArticles = [];
  const pendingBuilds   = [];

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw      = fs.readFileSync(fullPath, 'utf8');

    // gray-matter handles: UTF-8 BOM, multi-line YAML, all quote styles,
    // CRLF line endings, and YAML arrays/strings automatically.
    const { data: fm, content: body } = matter(raw);

    const derived = deriveMetadata(body, file);
    const title   = (fm.title || derived.title).toUpperCase();

    if (!FORCE && existingTitles.has(sovereignSlug(title))) {
      console.log(`  Skipping (already imported): ${file}`);
      skipped++;
      continue;
    }

    const subtitle = fm.subtitle || derived.subtitle || '';
    // gray-matter parses YAML dates as Date objects — coerce to ISO string
    const date     = fm.date
      ? String(fm.date instanceof Date ? fm.date.toISOString() : fm.date).slice(0, 10)
      : derived.date;
    const status   = canonicalStatus(fm.status || inferStatusFromFilename(file));
    const type     = fm.type     || inferType(file, body);
    const readTime = fm.readTime || derived.readTime;

    let tags = fm.tags || derived.tags || [];
    if (typeof tags === 'string') {
      tags = tags
        .split(',')
        .map(t => t.trim().replace(/^["'`]|["'`]$/g, ''))
        .filter(Boolean);
    } else if (!Array.isArray(tags)) {
      tags = [String(tags)].filter(Boolean);
    }

    const id   = generateId(file, fm, allIds);
    const name = fm.name || buildNameFromFilename(file);
    const desc = fm.desc || subtitle || title;

    allIds.add(id);

    console.log(`  Processing: ${file}`);
    console.log(`    id:       ${id}`);
    console.log(`    title:    ${title}`);
    console.log(`    status:   ${status}`);
    console.log(`    tags:     ${tags.length ? tags.join(', ') : '(none)'}`);

    processed++;
    if (!DRY_RUN) {
      pendingArticles.push({ id, type, date, title, subtitle, status, readTime, tags, content: body });
      pendingBuilds.push({ id: fm.buildId || id, articleId: id, name, status, desc });
    }
  }

  if (!DRY_RUN && pendingArticles.length > 0) {
    batchInject(ARTICLES_PATH, pendingArticles, serialiseArticle);
    batchInject(BUILDS_PATH,   pendingBuilds,   serialiseBuild);
    console.log(`\n  ✓ Injected ${pendingArticles.length} new kernel(s) into data layer.`);
  }

  if (skipped > 0) console.log(`\n  ↷ ${skipped} kernel(s) already in data layer — skipped.`);
  console.log(`\n  Done. ${processed} kernel(s) processed.\n`);
}

run();

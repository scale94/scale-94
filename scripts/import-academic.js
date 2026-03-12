#!/usr/bin/env node
/**
 * import-academic.js — Level 18: PhD Extraction
 *
 * Reads content/cs2 PHD/*.md, pre-renders markdown → terminal HTML, and
 * writes:
 *   src/terminal/data/articles.academic.js   — lean metadata index
 *   src/terminal/data/academic_chunks/{id}.js — per-article HTML chunks
 *
 * Every article is force-tagged with 'Thesis' and 'Academic'.
 * Article IDs are prefixed with 'PHD-'.
 * Article type is set to 'academic'.
 *
 * Usage:
 *   node scripts/import-academic.js
 *   node scripts/import-academic.js --dry
 *   node scripts/import-academic.js --force   # bypass import cache
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { atomicWrite, fileHash, loadCache, saveCache, sha256Prefix } from './_build-utils.js';
import { KERNEL_DIR, updateManifest, purgeStaleFiles } from './_manifest-utils.js';
import { renderMarkdown, escapeHtml, THEME_AMBER } from './_renderers.js';
import { chunkFileName } from './_article-utils.js';

const __dirname      = path.dirname(fileURLToPath(import.meta.url));
const ROOT           = path.join(__dirname, '..');
const CONTENT_DIR    = path.join(ROOT, 'content', 'cs2 PHD');
// Tailwind scanning source — not imported at runtime
const CHUNKS_DIR     = path.join(ROOT, 'src', 'terminal', 'data', 'academic_chunks');
// CAS runtime destination
const CHUNKS_CAS_DIR = path.join(KERNEL_DIR, 'chunks');

const DRY_RUN = process.argv.includes('--dry');
const FORCE   = process.argv.includes('--force');

// Tags injected into every article regardless of content
const FORCED_TAGS = ['Thesis', 'Academic'];

// ─── ID GENERATOR ────────────────────────────────────────────────────────────
// PHD- prefix + uppercased slug from filename.

function academicId(filename) {
  return 'PHD-' + path.basename(filename, '.md')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// ─── SCHEMA GUARD ─────────────────────────────────────────────────────────────

function validateArticle(article, filename) {
  const errors = [];
  if (!article.id    || !article.id.trim())    errors.push('missing `id`');
  if (!article.title || !article.title.trim()) errors.push('missing `title`');
  if (errors.length > 0) {
    console.error(`\n  ✗ SCHEMA VIOLATION in ${filename}:`);
    errors.forEach(e => console.error(`    · ${e}`));
    process.exit(1);
  }
}

// ─── METADATA EXTRACTION ──────────────────────────────────────────────────────

function deriveTitle(body, filename) {
  const h1 = body.split('\n').find(l => /^#(?!#)[ \t]+/.test(l));
  if (h1) {
    return h1.replace(/^#[ \t]+/, '')
      .replace(/\[|\]/g, '')
      .replace(/\*{1,3}(.+?)\*{1,3}/g, '$1')
      .replace(/[^\w\s:–—()./]/g, '')
      .trim()
      .slice(0, 80)
      .toUpperCase();
  }
  return path.basename(filename, '.md')
    .replace(/[-_]/g, ' ')
    .toUpperCase()
    .slice(0, 80);
}

function deriveSubtitle(body) {
  const h2 = body.split('\n').find(l => /^##(?!#)[ \t]+/.test(l));
  if (h2) return h2.replace(/^##[ \t]+/, '').trim().slice(0, 120);
  const bq = body.split('\n').find(l => /^>[ \t]/.test(l));
  if (bq) return bq.replace(/^>[ \t]*\*?/, '').replace(/\*$/, '').trim().slice(0, 120);
  return '';
}

function deriveDate(body) {
  const m = body.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return m ? m[1] : new Date().toISOString().slice(0, 10);
}

function deriveTags(body) {
  const headerWords = body.match(/^#{1,4}[ \t]+(.+)/gm) || [];
  const candidates = [];
  for (const h of headerWords) {
    const words = h.replace(/^#{1,4}[ \t]+/, '').split(/[\s_/.\\/]+/);
    for (const w of words) {
      const clean = w.replace(/[^a-zA-Z0-9-]/g, '');
      if (clean.length > 3 && /^[A-Z]/.test(clean) && !/^(The|And|For|With|From|This)$/i.test(clean)) {
        candidates.push(clean);
      }
    }
  }
  return [...new Set(candidates)].slice(0, 5);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function run() {
  console.log('\n╔═════════════════════════════════════════════╗');
  console.log('║  ACADEMIC IMPORT — LEVEL 18: PHD EXTRACTION ║');
  console.log('╚═════════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('  [DRY RUN — no files will be written]\n');
  if (FORCE)   console.log('  [--force — cache bypassed]\n');

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`  ✗ content/cs2 PHD/ not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const cache = FORCE ? {} : loadCache();

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.log('  No .md files found in content/cs2 PHD/.');
    process.exit(0);
  }

  if (!DRY_RUN) {
    if (!fs.existsSync(CHUNKS_DIR))     fs.mkdirSync(CHUNKS_DIR,     { recursive: true });
    if (!fs.existsSync(CHUNKS_CAS_DIR)) fs.mkdirSync(CHUNKS_CAS_DIR, { recursive: true });
    if (!fs.existsSync(KERNEL_DIR))     fs.mkdirSync(KERNEL_DIR,     { recursive: true });
  }

  const articles = [];

  for (const file of files) {
    const fullPath     = path.join(CONTENT_DIR, file);
    const raw          = fs.readFileSync(fullPath, 'utf8');
    const rawHash      = fileHash(raw);
    const cacheKey     = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    const lastModified = fs.statSync(fullPath).mtime.toISOString().slice(0, 10);

    const { data: fm, content: body } = matter(raw);

    const id       = fm.id || academicId(file);
    const title    = (fm.title || deriveTitle(body, file));
    const subtitle = fm.subtitle || deriveSubtitle(body) || '';
    const date     = fm.date
      ? String(fm.date instanceof Date ? fm.date.toISOString() : fm.date).slice(0, 10)
      : deriveDate(body);

    // Merge content-derived tags with forced academic tags (deduped)
    const contentTags = fm.tags
      ? (typeof fm.tags === 'string'
          ? fm.tags.split(',').map(t => t.trim()).filter(Boolean)
          : Array.isArray(fm.tags) ? fm.tags : [])
      : deriveTags(body);
    const tags = [...new Set([...FORCED_TAGS, 'CS2', ...contentTags])];

    const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
    const len       = `${wordCount} WDS`;
    const readTime  = `${Math.max(1, Math.round(wordCount / 200))} min read`;

    validateArticle({ id, title }, file);

    console.log(`  Processing: ${file}`);
    console.log(`    id:    ${id}`);
    console.log(`    title: ${title}`);
    console.log(`    tags:  ${tags.join(', ')}`);

    if (!DRY_RUN) {
      const cname     = chunkFileName(id);
      const chunkPath = path.join(CHUNKS_DIR, `${cname}.js`);

      const chunkJsonPath = path.join(CHUNKS_CAS_DIR, `${cname}.json`);

      // Cache hit: skip when BOTH files exist and hash matches
      const isCacheHit = !FORCE && cache[cacheKey] === rawHash
        && fs.existsSync(chunkPath) && fs.existsSync(chunkJsonPath);

      if (!isCacheHit) {
        const html = renderMarkdown(body, THEME_AMBER);
        // JS chunk — Tailwind CSS class discovery only; not imported at runtime
        const jsChunk = [
          `// ${cname}.js — DO NOT EDIT MANUALLY.`,
          '// Generated by: node scripts/import-academic.js — Level 20: Immutable Runtime',
          '// Purpose: Tailwind CSS class discovery only. Runtime uses public/kernel/chunks/',
          'export default {',
          `  html: ${JSON.stringify(html)},`,
          `  len:  ${JSON.stringify(len)},`,
          '};',
          '',
        ].join('\n');
        atomicWrite(chunkPath, jsChunk);
        // CAS JSON chunk — runtime fetch target
        atomicWrite(chunkJsonPath, JSON.stringify({ html, len }) + '\n');
        cache[cacheKey] = rawHash;
      } else {
        console.log(`    [CACHE HIT] ${id}`);
      }

      articles.push({ id, title, subtitle, date, lastModified, type: 'academic', tags, len, readTime });
    }
  }

  if (DRY_RUN) {
    console.log(`\n  [DRY] Would write articles.academic.js (${files.length} academic articles).`);
    return;
  }

  // ── CAS lean index — public/kernel/academic.{hash}.json ─────────────────
  // Pure JSON array; app creates fetch-based loadContent closures at runtime.
  const index = articles.map(a => ({
    id:           a.id,
    type:         'academic',
    date:         a.date,
    lastModified: a.lastModified,
    title:        a.title,
    subtitle:     a.subtitle,
    status:       'ACTIVE',
    readTime:     a.readTime,
    tags:         a.tags,
    len:          a.len,
  }));

  const indexJson  = JSON.stringify(index, null, 2) + '\n';
  const indexHash  = sha256Prefix(indexJson);
  purgeStaleFiles(KERNEL_DIR, 'academic', 'json', indexHash);
  atomicWrite(path.join(KERNEL_DIR, `academic.${indexHash}.json`), indexJson);
  saveCache(cache);
  updateManifest({ academic: `academic.${indexHash}.json` });

  console.log(`\n  ✓ SYSTEM_KERNEL_LOG: ${articles.length} academic chunk(s) → academic_chunks/ (Tailwind) + public/kernel/chunks/ (CAS)`);
  console.log(`  ✓ SYSTEM_KERNEL_LOG: academic.${indexHash}.json → public/kernel/`);
  console.log(`  ✓ SYSTEM_KERNEL_LOG: manifest.json updated (academic=${indexHash})`);
  console.log('');
}

run();

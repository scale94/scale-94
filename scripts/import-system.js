#!/usr/bin/env node
/**
 * import-system.js — Level 16: Monolith Extraction
 *
 * Reads content/system_logs/*.md, pre-renders markdown → terminal HTML,
 * and writes src/terminal/data/articles.system.js.
 *
 * System articles are NOT lazy-loaded (no chunk files). They are tiny
 * fixed-layout pages (Manifesto, Thesis, Privacy, Help) that mount
 * synchronously. All HTML is inlined directly in the output file.
 *
 * Usage:
 *   node scripts/import-system.js
 *   node scripts/import-system.js --dry
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { atomicWrite, fileHash, loadCache, saveCache, sha256Prefix } from './_build-utils.js';
import { KERNEL_DIR, updateManifest, purgeStaleFiles } from './_manifest-utils.js';
import { renderMarkdown } from './_renderers.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'system_logs');

const DRY_RUN = process.argv.includes('--dry');

// ─── SCHEMA GUARD ─────────────────────────────────────────────────────────────
// System articles may omit `date`; if present it must be YYYY-MM-DD.

function validateArticle(article, filename) {
  const errors = [];
  if (!article.id    || !article.id.trim())    errors.push('missing `id`');
  if (!article.title || !article.title.trim()) errors.push('missing `title`');
  if (article.date && !/^\d{4}-\d{2}-\d{2}$/.test(article.date))
    errors.push(`invalid \`date\`: "${article.date}" — expected YYYY-MM-DD`);
  if (errors.length > 0) {
    console.error(`\n  ✗ SCHEMA VIOLATION in ${filename}:`);
    errors.forEach(e => console.error(`    · ${e}`));
    process.exit(1);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function run() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  SYSTEM IMPORT — LEVEL 17: HARDENED STATE ║');
  console.log('╚════════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('  [DRY RUN — no files will be written]\n');

  const cache = loadCache();

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`  ✗ content/system_logs/ not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.log('  No .md files found in content/system_logs/.');
    process.exit(0);
  }

  const articles = {};

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw          = fs.readFileSync(fullPath, 'utf8');
    const rawHash      = fileHash(raw);
    const cacheKey     = path.relative(ROOT, fullPath).replace(/\\/g, '/');
    const lastModified = fs.statSync(fullPath).mtime.toISOString().slice(0, 10);

    const { data: fm, content: body } = matter(raw);

    const id       = fm.id || path.basename(file, '.md').toUpperCase().replace(/[^A-Z0-9]/g, '-');
    const title    = fm.title    || id;
    const subtitle = fm.subtitle || '';
    const date     = fm.date
      ? String(fm.date instanceof Date ? fm.date.toISOString() : fm.date).slice(0, 10)
      : '';
    const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
    const len       = `${wordCount} WDS`;

    validateArticle({ id, title, date }, file);

    const html = renderMarkdown(body);

    articles[id] = { id, title, subtitle, date, lastModified, len, html };
    cache[cacheKey] = rawHash;

    console.log(`  Processed: ${file}`);
    console.log(`    id:    ${id}`);
    console.log(`    title: ${title}`);
  }

  // ── CAS write — public/kernel/system.{hash}.json ───────────────────────────
  // Dict format: { [id]: { id, title, subtitle, date, lastModified, len, html } }
  // System articles are small and inlined (no separate chunk files needed).

  const systemJson = JSON.stringify(articles, null, 2) + '\n';
  const systemHash = sha256Prefix(systemJson);
  purgeStaleFiles(KERNEL_DIR, 'system', 'json', systemHash);

  if (!DRY_RUN) {
    if (!fs.existsSync(KERNEL_DIR)) fs.mkdirSync(KERNEL_DIR, { recursive: true });
    atomicWrite(path.join(KERNEL_DIR, `system.${systemHash}.json`), systemJson);
    saveCache(cache);
    updateManifest({ system: `system.${systemHash}.json` });
    console.log(`\n  ✓ SYSTEM_KERNEL_LOG: system.${systemHash}.json → public/kernel/ (${Object.keys(articles).length} system articles)`);
    console.log(`  ✓ SYSTEM_KERNEL_LOG: manifest.json updated (system=${systemHash})`);
  } else {
    console.log(`\n  [DRY] Would write system.${systemHash}.json → public/kernel/ (${Object.keys(articles).length} articles)`);
  }

  console.log('');
}

run();

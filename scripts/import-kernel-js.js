#!/usr/bin/env node
/**
 * import-kernel-js.js — Level 20: Direct JS Ingestion
 *
 * Ingests pre-generated .js kernel chunk files (no .md source required).
 * Accepts the same export format used by generated_chunks/:
 *
 *   export default { html: "<p>...</p>", len: "42 WDS" };
 *
 * For each file, this script:
 *   1. Parses the exported { html, len } payload
 *   2. Derives metadata (id, title, tags) from the filename
 *   3. Writes to public/kernel/chunks/{id}.json  (CAS runtime asset)
 *   4. Updates public/kernel/manifest.json
 *   5. Injects into src/terminal/data/kernelBuilds.js  (@@INJECT zone)
 *
 * Usage:
 *   node scripts/import-kernel-js.js                       # scan src/terminal/data/generated_chunks/
 *   node scripts/import-kernel-js.js ./my-chunks/          # scan custom dir
 *   node scripts/import-kernel-js.js ./my-chunks/ --dry    # preview only
 *   node scripts/import-kernel-js.js ./my-chunks/ --commit # git add . && git commit
 *   node scripts/import-kernel-js.js ./my-chunks/ --force  # skip cache
 */

import fs            from 'fs';
import path          from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { atomicWrite, fileHash, loadCache, saveCache, sha256Prefix } from './_build-utils.js';
import { KERNEL_DIR, readManifest, updateManifest, purgeStaleFiles } from './_manifest-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

const SOURCE_DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'src', 'terminal', 'data', 'generated_chunks');

const DRY_RUN = process.argv.includes('--dry');
const FORCE   = process.argv.includes('--force');
const COMMIT  = process.argv.includes('--commit');

const BUILDS_PATH    = path.join(ROOT, 'src', 'terminal', 'data', 'kernelBuilds.js');
const CHUNKS_CAS_DIR = path.join(KERNEL_DIR, 'chunks');
const INJECT_START   = '/* @@INJECT_START@@ */';
const INJECT_END     = '/* @@INJECT_END@@ */';

// ─── CHUNK PARSER ─────────────────────────────────────────────────────────────
// Extracts { html, len } from the known chunk file format without full eval.
// Uses a targeted regex — safe because we own the generator that writes these files.

function parseChunkFile(src) {
  // Match:  html: "..." or html: '...' (JSON.stringify output is always double-quoted)
  // The html string may contain escaped chars — use a JSON.parse on the captured token.
  const htmlMatch = src.match(/html:\s*(["'])([\s\S]*?)\1\s*[,}]/);
  const lenMatch  = src.match(/len:\s*["']([^"']+)["']/);
  if (!htmlMatch) return null;

  let html;
  try {
    // JSON.stringify was used by the generator; JSON.parse is the safe inverse.
    html = JSON.parse('"' + htmlMatch[2].replace(/"/g, '\\"').replace(/^\\"/g, '"').replace(/\\"$/g, '"') + '"');
  } catch {
    // Fallback: use raw match without re-parsing
    html = htmlMatch[2];
  }

  // Safer: re-extract the full JSON string value using the actual double-quote delimited form
  const fullHtmlMatch = src.match(/html:\s*("(?:[^"\\]|\\.)*")/s);
  if (fullHtmlMatch) {
    try { html = JSON.parse(fullHtmlMatch[1]); } catch { /* keep previous */ }
  }

  const len = lenMatch ? lenMatch[1] : null;
  return { html, len };
}

// ─── METADATA DERIVATION ──────────────────────────────────────────────────────
// Derives id, title, tags, date from filename alone.
// No gray-matter — these files have no frontmatter.

function deriveFromFilename(filename) {
  const base  = path.basename(filename, '.js');
  // ID: use filename as-is (already in UPPER-DASH format from the generator)
  const id    = base;
  // Title: replace dashes/underscores with spaces, capitalise words
  const title = base.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  // Tags: first 1–3 capitalised words from the title that are >3 chars
  const tags  = title.split(' ')
    .filter(w => w.length > 3 && !/^\d/.test(w))
    .slice(0, 3);
  const date  = new Date().toISOString().slice(0, 10);
  // Desc: title truncated
  const desc  = title.slice(0, 60);
  return { id, title, desc, tags, date };
}

// ─── KERNEL BUILDS INJECTION ──────────────────────────────────────────────────

function serialiseBuild(b) {
  return `  { id: ${JSON.stringify(b.id)}, articleId: ${JSON.stringify(b.articleId)}, name: ${JSON.stringify(b.name)}, status: ${JSON.stringify(b.status)}, desc: ${JSON.stringify(b.desc)} }`;
}

function writeInjectZone(items) {
  if (!fs.existsSync(BUILDS_PATH)) {
    console.error(`  ✗ kernelBuilds.js not found: ${BUILDS_PATH}`);
    return false;
  }
  const src        = fs.readFileSync(BUILDS_PATH, 'utf8');
  const startCount = (src.match(/\/\* @@INJECT_START@@ \*\//g) || []).length;
  const endCount   = (src.match(/\/\* @@INJECT_END@@ \*\//g) || []).length;
  if (startCount !== 1 || endCount !== 1) {
    console.error(`  ✗ Injection markers malformed (START:${startCount} END:${endCount}) — aborting`);
    process.exit(1);
  }
  const startIdx = src.indexOf(INJECT_START);
  const endIdx   = src.indexOf(INJECT_END);
  // Read existing zone to merge — we're appending, not wiping, here
  const existingZone = src.slice(startIdx + INJECT_START.length, endIdx);
  const existingIds  = new Set();
  const re = /\barticleId:\s*["'`]([^"'`\n]+)["'`]/g;
  let m;
  while ((m = re.exec(existingZone)) !== null) existingIds.add(m[1]);

  const newItems = items.filter(b => !existingIds.has(b.articleId));
  if (newItems.length === 0) return true; // nothing to inject

  const inner = existingZone.trimEnd() + '\n' + newItems.map(serialiseBuild).join(',\n') + ',\n';
  const newSrc =
    src.slice(0, startIdx + INJECT_START.length) +
    '\n' + inner +
    src.slice(endIdx);
  atomicWrite(BUILDS_PATH, newSrc);
  return true;
}

// ─── MANIFEST: build a new lean index for JS-ingested articles ────────────────

function updateArticlesIndex(newArticles) {
  const manifest   = readManifest();
  const existingKey = manifest.kernels;
  let existingArticles = [];
  if (existingKey) {
    const existingPath = path.join(KERNEL_DIR, existingKey);
    if (fs.existsSync(existingPath)) {
      try { existingArticles = JSON.parse(fs.readFileSync(existingPath, 'utf8')); } catch { /* ignore */ }
    }
  }
  const existingIds = new Set(existingArticles.map(a => a.id));
  const merged = [
    ...existingArticles,
    ...newArticles.filter(a => !existingIds.has(a.id)),
  ];
  const indexJson = JSON.stringify(merged, null, 2) + '\n';
  const indexHash = sha256Prefix(indexJson);
  purgeStaleFiles(KERNEL_DIR, 'articles', 'json', indexHash);
  atomicWrite(path.join(KERNEL_DIR, `articles.${indexHash}.json`), indexJson);
  return indexHash;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  KERNEL JS IMPORT — LEVEL 20: DIRECT INJECT  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('  [DRY RUN — no files will be written]\n');

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`  ✗ Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.js'));
  if (files.length === 0) {
    console.log('  No .js files found in', SOURCE_DIR, '\n');
    process.exit(0);
  }

  if (!fs.existsSync(CHUNKS_CAS_DIR)) fs.mkdirSync(CHUNKS_CAS_DIR, { recursive: true });

  const cache         = FORCE ? {} : loadCache();
  const processed     = [];
  const pendingBuilds = [];
  let   skipped       = 0;

  for (const file of files) {
    const fullPath = path.join(SOURCE_DIR, file);
    const src      = fs.readFileSync(fullPath, 'utf8');
    const rawHash  = fileHash(src);
    const cacheKey = `js:${file}`;

    // Cache hit — skip if already ingested and chunk exists
    const cname         = path.basename(file, '.js').replace(/[^a-zA-Z0-9\-._]/g, '_');
    const chunkJsonPath = path.join(CHUNKS_CAS_DIR, `${cname}.json`);
    if (!FORCE && cache[cacheKey] === rawHash && fs.existsSync(chunkJsonPath)) {
      console.log(`  Cached:     ${file}`);
      skipped++;
      continue;
    }

    const payload = parseChunkFile(src);
    if (!payload || !payload.html) {
      console.warn(`  ⚠ Skipping (no html export): ${file}`);
      skipped++;
      continue;
    }

    const meta = deriveFromFilename(file);
    console.log(`  Processing: ${file}`);
    console.log(`    id:    ${meta.id}`);
    console.log(`    tags:  ${meta.tags.join(', ') || '(none)'}`);

    if (!DRY_RUN) {
      // Write CAS JSON chunk
      const chunkPayload = JSON.stringify({ html: payload.html, len: payload.len ?? '? WDS' }) + '\n';
      atomicWrite(chunkJsonPath, chunkPayload);
      cache[cacheKey] = rawHash;

      // Lean article index entry
      processed.push({
        id:       meta.id,
        type:     'kernel_doc',
        date:     meta.date,
        title:    meta.title,
        subtitle: '',
        status:   'ACTIVE',
        readTime: '',
        tags:     meta.tags,
        len:      payload.len ?? '? WDS',
      });

      // Build entry for kernelBuilds.js inject zone
      pendingBuilds.push({
        id:        meta.id,
        articleId: meta.id,
        name:      meta.id.replace(/[-_]/g, '_'),
        status:    'ACTIVE',
        desc:      meta.desc,
      });
    }
  }

  if (!DRY_RUN && processed.length > 0) {
    saveCache(cache);
    const articlesHash = updateArticlesIndex(processed);
    updateManifest({ kernels: `articles.${articlesHash}.json` });
    writeInjectZone(pendingBuilds);
    console.log(`\n  ✓ ${processed.length} JS chunk(s) ingested → public/kernel/chunks/`);
    console.log(`  ✓ articles.${articlesHash}.json updated (manifest)`);
    console.log(`  ✓ kernelBuilds.js inject zone updated\n`);
  }

  if (skipped > 0) console.log(`  ↷ ${skipped} file(s) cached/skipped\n`);
  console.log(`  Done. ${processed.length} ingested.\n`);

  // ── Auto-commit ────────────────────────────────────────────────────────────
  if (COMMIT && !DRY_RUN && processed.length > 0) {
    const names   = processed.map(a => a.id).join(', ');
    const message = `import: ${names}`;
    console.log(`  git add .`);
    const add = spawnSync('git', ['add', '.'], { stdio: 'inherit' });
    if (add.status !== 0) {
      console.error(`  ✗ git add failed`);
      process.exit(add.status ?? 1);
    }
    console.log(`  git commit -m "${message}"`);
    const commit = spawnSync('git', ['commit', '-m', message], { stdio: 'inherit' });
    if (commit.status !== 0 && commit.status !== 1) {
      console.error(`  ✗ git commit failed`);
      process.exit(commit.status ?? 1);
    }
    console.log(`  ✓ committed: ${message}\n`);
  }
}

run();

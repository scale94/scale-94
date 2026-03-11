#!/usr/bin/env node
/**
 * import-kernel.js — Level 11: De-Chonker
 *
 * Scans a directory for .md files and:
 *   1. GENERATES  src/terminal/data/generated_chunks/{id}.js  (one per kernel)
 *      Each chunk exports { body, content, len } — the heavy payload only.
 *      Vite code-splits these into separate async bundles automatically.
 *   2. GENERATES  src/terminal/data/articles.generated.js
 *      Lean metadata index (id, title, tags, …) — NO body text.
 *      loadContent() bridges to the matching chunk via dynamic import().
 *   3. INJECTS    build entries into kernelBuilds.js via @@INJECT markers.
 *      Append-only, dedup by articleId to prevent duplicates across runs.
 *
 * Usage:
 *   node import-kernel.js                        # scan ./content/soma_kernel/
 *   node import-kernel.js ./my-kernels/          # scan custom dir
 *   node import-kernel.js ./my-kernels/ --dry    # preview only, no writes
 *   node import-kernel.js ./my-kernels/ --force  # bypass title-dedup guard
 */

import fs             from 'fs';
import path           from 'path';
import { fileURLToPath } from 'url';
import { spawnSync }  from 'child_process';
import matter         from 'gray-matter';
import { marked }     from 'marked';
import semver         from 'semver';
import { normalizeQuery as sovereignSlug } from './src/lib/normalize.js';
import { atomicWrite, fileHash, loadCache, saveCache, sha256Prefix } from './scripts/_build-utils.js';
import { KERNEL_DIR, updateManifest, purgeStaleFiles } from './scripts/_manifest-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CONTENT_DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'content', 'soma_kernel');   // default: soma_kernel/

const DRY_RUN = process.argv.includes('--dry');
const FORCE   = process.argv.includes('--force');
const COMMIT  = process.argv.includes('--commit');

const CHUNKS_DIR     = path.join(__dirname, 'src/terminal/data/generated_chunks');
const BUILDS_PATH    = path.join(__dirname, 'src/terminal/data/kernelBuilds.js');
// CAS output — public/kernel/ is served statically and cached by the SW
const CHUNKS_CAS_DIR = path.join(KERNEL_DIR, 'chunks');

// ─── EXCLUSION LIST ───────────────────────────────────────────────────────────

const EXCLUDE_FILES = new Set([
  'Soft_Climb_Sequence.md',
]);

// ─── STATUS MAPPING ───────────────────────────────────────────────────────────
// Incoming status keywords are canonicalised to ACTIVE / DEPRECATED / EXPERIMENTAL.

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
  const upper = raw.toUpperCase().trim();
  if (STATUS_MAP[upper]) return upper;
  return 'ACTIVE';
}

// ─── VERSION EXTRACTION (SEMVER-AWARE) ───────────────────────────────────────
// Priority: vX.Y.Z[-pre] > X.Y.Z (3-part+) > X.Y (2-part) > '1.0'

function extractVersion(base) {
  const tagged = base.match(/(?:^|[._-])v(\d+\.\d+(?:\.\d+)*(?:-[a-zA-Z0-9.]+)?)/i);
  if (tagged) return tagged[1];
  const multi  = base.match(/(?:^|[._-])(\d+(?:\.\d+){2,})/);
  if (multi)  return multi[1];
  const two    = base.match(/(?:^|[._-])(\d+\.\d+)/);
  if (two)    return two[1];
  return '1.0';
}

// ─── ID GENERATOR ────────────────────────────────────────────────────────────
// Priority: frontmatter id > filename-derived prefix + semver version.
// sovereignSlug (= normalizeQuery) is used for dedup matching only — the
// canonical ID itself retains uppercase-dash formatting.

function generateId(filename, fm, existingIds) {
  if (fm.id) return fm.id;

  const base    = path.basename(filename, '.md');
  const version = extractVersion(base);
  const stripped = base
    .replace(/[._-]v?\d+([._]\d+)*/i, '')
    .split(/[._-]/)
    .filter(Boolean);

  let prefix;
  if (stripped.length === 0)          prefix = base.slice(0, 4).toUpperCase();
  else if (/^v\d/i.test(stripped[0])) prefix = stripped[0].toUpperCase();
  else if (stripped.length === 1)     prefix = stripped[0].slice(0, 4).toUpperCase();
  else                                prefix = stripped.map(w => w[0].toUpperCase()).join('').slice(0, 5);

  let id = `${prefix}-${version}`;
  let sfx = 1;
  const base_id = id;
  while (existingIds.has(id)) id = `${base_id}-${sfx++}`;
  return id;
}

function buildNameFromFilename(filename) {
  return path.basename(filename, '.md')
    .toUpperCase()
    .replace(/[.\s]/g, '_')
    .replace(/-/g, '_');
}

// ─── TYPE INFERENCE ───────────────────────────────────────────────────────────
// Canonical types: kernel_doc | fiction | research
// 'kernel' (bare) used in many frontmatters — normalised to 'kernel_doc' here
// so the tier-2 load fallback in App.jsx can filter a single canonical value.

const TYPE_ALIASES = { kernel: 'kernel_doc', 'kernel_doc': 'kernel_doc', fiction: 'fiction', research: 'research' };

function canonicalType(raw) {
  return TYPE_ALIASES[raw] || null;
}

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

// ─── SCHEMA GUARD ─────────────────────────────────────────────────────────────
// Aborts the process if a required field is missing or malformed.

function validateArticle(article, filename) {
  const errors = [];
  if (!article.id    || !article.id.trim())    errors.push('missing `id`');
  if (!article.title || !article.title.trim()) errors.push('missing `title`');
  if (!article.date  || !/^\d{4}-\d{2}-\d{2}$/.test(article.date))
    errors.push(`invalid \`date\`: "${article.date}" — expected YYYY-MM-DD`);
  if (errors.length > 0) {
    console.error(`\n  ✗ SCHEMA VIOLATION in ${filename}:`);
    errors.forEach(e => console.error(`    · ${e}`));
    process.exit(1);
  }
}

// ─── SEMVER SORT HELPER ───────────────────────────────────────────────────────
// Used ONLY for sorting pendingArticles — never for ID generation.
// semver.coerce('v11.4') === semver.coerce('11.4.0') → mathematical parity.

function coerceVersionForSort(id) {
  const m = id.match(/(\d+\.\d+(?:\.\d+)*)$/);
  if (!m) return '0.0.0';
  const c = semver.coerce(m[1]);
  return c ? c.version : '0.0.0';
}

// ─── HTML UTILS ──────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── MARKED RENDERER — TERMINAL AESTHETIC ────────────────────────────────────
// Bakes Tailwind classes into pre-rendered HTML chunks at build time.
// Tailwind scans generated_chunks/*.js so these classes land in the CSS bundle.

marked.use({
  renderer: {
    heading(token) {
      const text = this.parser.parseInline(token.tokens);
      const cls =
        token.depth === 1 ? 'text-[14pt] font-bold mb-4 text-cyan-400 tracking-tighter leading-tight' :
        token.depth === 2 ? 'text-[12pt] text-fuchsia-400 mb-12 font-light tracking-wide' :
                            'text-lg font-bold mt-8 mb-4 text-fuchsia-400 flex items-center gap-2';
      return `<h${token.depth} class="${cls}">${text}</h${token.depth}>\n`;
    },
    paragraph(token) {
      const text = this.parser.parseInline(token.tokens);
      return `<p class="mb-6 text-[#39ff14] leading-relaxed max-w-3xl">${text}</p>\n`;
    },
    list(token) {
      const tag = token.ordered ? 'ol' : 'ul';
      let body = '';
      for (const item of token.items) body += this.listitem(item);
      return `<${tag} class="mb-6 space-y-2 list-none pl-0">${body}</${tag}>\n`;
    },
    listitem(token) {
      // Always use parse (block-aware) — listitem tokens may include tables,
      // paragraphs, or other block tokens regardless of the loose flag.
      const text = this.parser.parse(token.tokens);
      return `<li class="flex items-start gap-2 text-[#39ff14]"><span class="text-cyan-400 mt-1 shrink-0">&#9658;</span><span>${text}</span></li>\n`;
    },
    code(token) {
      return `<pre class="bg-black/80 border border-cyan-900/30 p-4 mb-6 rounded text-xs text-cyan-300 font-mono whitespace-pre-wrap overflow-x-auto shadow-inner"><code>${escapeHtml(token.text)}</code></pre>\n`;
    },
    blockquote(token) {
      const body = this.parser.parse(token.tokens);
      return `<blockquote class="border-l-2 border-cyan-500/50 pl-4 mb-6 text-cyan-400/70 italic">${body}</blockquote>\n`;
    },
    table(token) {
      const th = token.header.map(h =>
        `<th class="px-3 py-2 text-left text-cyan-400 border-b border-cyan-900/50 text-xs font-bold tracking-wider">${this.parser.parseInline(h.tokens)}</th>`
      ).join('');
      const tr = token.rows.map(row =>
        `<tr>${row.map(cell =>
          `<td class="px-3 py-2 text-[#39ff14] text-xs border-b border-cyan-900/20">${this.parser.parseInline(cell.tokens)}</td>`
        ).join('')}</tr>`
      ).join('\n');
      return `<table class="w-full mb-6 border-collapse border border-cyan-900/30"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>\n`;
    },
    strong(token) {
      const text = this.parser.parseInline(token.tokens);
      return `<strong class="text-cyan-300 font-bold">${text}</strong>`;
    },
    em(token) {
      const text = this.parser.parseInline(token.tokens);
      return `<em class="text-fuchsia-300 italic">${text}</em>`;
    },
    codespan(token) {
      return `<code class="bg-black/60 text-cyan-300 font-mono text-xs px-1 py-0.5 rounded border border-cyan-900/30">${escapeHtml(token.text)}</code>`;
    },
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      const href = escapeHtml(token.href || '');
      return `<a href="${href}" class="text-cyan-400 underline underline-offset-2 hover:text-cyan-200" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

// ─── MARKDOWN PRE-RENDERER ────────────────────────────────────────────────────
// Converts raw markdown to terminal-aesthetic HTML at build time.
// Neural links [[KERNEL-ID]] are detected and converted to <button> elements
// before marked runs, so marked passes them through as raw HTML.

function renderMarkdown(body) {
  // Pre-process [[KERNEL-ID]] → neural link buttons
  let processed = body.replace(/\[\[([^\]]+)\]\]/g, (_, id) => {
    const safeId = escapeHtml(id.trim());
    return `<button class="neural-link text-cyan-400 underline underline-offset-2 hover:text-cyan-200 cursor-pointer bg-transparent border-none font-mono text-xs font-bold" data-cmd="${safeId}">${safeId}</button>`;
  });

  // Strip first H1 — ArticleView renders article.title as its own heading
  processed = processed.replace(/^#(?!#)[ \t]+[^\n]*\n?/, '');

  return marked.parse(processed);
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

  const headerWords  = body.match(/^#{1,4}[ \t]+(.+)/gm) || [];
  const tagCandidates = [];
  for (const h of headerWords) {
    const words = h.replace(/^#{1,4}[ \t]+/, '').split(/[\s_/.\\/]+/);
    for (const w of words) {
      if (w.length > 3 && /^[A-Z]/.test(w) && !/^(The|And|For|With|From|Into|This|Violet|Kernel|V\d+)$/i.test(w)) {
        tagCandidates.push(w.replace(/[^a-zA-Z0-9-]/g, ''));
      }
    }
  }
  const tags = [...new Set(tagCandidates)].filter(t => t.length > 1).slice(0, 5);

  const wordCount = body.split(/\s+/).length;
  const readTime  = `${Math.max(1, Math.round(wordCount / 200))} min read`;

  return { title, subtitle, date, tags, readTime };
}

// ─── GENERATED FILE WRITER ────────────────────────────────────────────────────
//
// Level 11: De-Chonker — two-phase write.
//
// PHASE 1 — per-kernel chunk files  (src/terminal/data/generated_chunks/{id}.js)
//   Each file exports ONLY the heavy payload: { body, content, len }.
//   Vite's bundler sees the static import() strings in Phase 2 and splits every
//   chunk into its own async bundle — keeping it out of the main entry point.
//
// PHASE 2 — lean metadata index  (articles.generated.js)
//   Contains ONLY the lightweight fields (id, title, tags, …).
//   loadContent() bridges to the matching chunk via dynamic import().
//   The returned object merges metadata + chunk payload at call time.
//
// SERIALIZATION SAFETY (SAVE America Act):
//   All string values serialised with JSON.stringify() — escapes backticks,
//   ${}, backslashes, and quotes, eliminating all template-injection vectors.

// Convert an article ID to a filesystem-safe chunk filename.
// Replaces chars outside [A-Za-z0-9\-._] (e.g. ∞) with underscores.
function chunkFileName(id) {
  return id.replace(/[^a-zA-Z0-9\-._]/g, '_');
}

function writeGeneratedFile(articles, cache) {
  // ── Phase 0: ensure dirs exist; targeted stale-chunk wipe (src only) ───────
  if (!fs.existsSync(CHUNKS_DIR))     fs.mkdirSync(CHUNKS_DIR,     { recursive: true });
  if (!fs.existsSync(CHUNKS_CAS_DIR)) fs.mkdirSync(CHUNKS_CAS_DIR, { recursive: true });
  const currentChunkNames = new Set(articles.map(a => `${chunkFileName(a.id)}.js`));
  for (const f of fs.readdirSync(CHUNKS_DIR)) {
    if (f.endsWith('.js') && !currentChunkNames.has(f)) {
      fs.rmSync(path.join(CHUNKS_DIR, f));
    }
  }

  // ── Phase 1: JS chunk for Tailwind class scanning + CAS JSON for runtime ───
  for (const a of articles) {
    const wordCount     = (a.content || '').trim().split(/\s+/).filter(Boolean).length;
    const len           = `${wordCount} WDS`;
    const cname         = chunkFileName(a.id);
    const chunkPath     = path.join(CHUNKS_DIR,     `${cname}.js`);
    const chunkJsonPath = path.join(CHUNKS_CAS_DIR, `${cname}.json`);

    // Cache hit: skip when BOTH files exist and hash matches
    if (a._hash && a._cacheKey && cache[a._cacheKey] === a._hash
        && fs.existsSync(chunkPath) && fs.existsSync(chunkJsonPath)) {
      continue;
    }

    const html = renderMarkdown(a.content || '');

    // JS chunk — exists solely for Tailwind CSS class discovery during vite build.
    // Not imported at runtime; content is served via fetch() from public/kernel/chunks/.
    const jsChunk = [
      `// ${cname}.js — DO NOT EDIT MANUALLY.`,
      '// Generated by: node import-kernel.js — Level 20: Immutable Runtime',
      '// Purpose: Tailwind CSS class discovery only. Runtime uses public/kernel/chunks/',
      'export default {',
      `  html: ${JSON.stringify(html)},`,
      `  len:  ${JSON.stringify(len)},`,
      '};',
      '',
    ].join('\n');
    atomicWrite(chunkPath, jsChunk);

    // CAS JSON chunk — served at /kernel/chunks/{id}.json, fetched at runtime.
    atomicWrite(chunkJsonPath, JSON.stringify({ html, len }) + '\n');

    if (a._cacheKey && a._hash) cache[a._cacheKey] = a._hash;
  }

  // ── Phase 2: CAS lean index — public/kernel/articles.{hash}.json ────────────
  // Pure JSON array; no loadContent (the app creates fetch-based closures at runtime).
  const index = articles.map(a => {
    const wordCount = (a.content || '').trim().split(/\s+/).filter(Boolean).length;
    return {
      id:           a.id,
      type:         a.type,
      date:         a.date,
      lastModified: a.lastModified || null,
      title:        a.title,
      subtitle:     a.subtitle,
      status:       a.status,
      readTime:     a.readTime,
      tags:         a.tags,
      len:          `${wordCount} WDS`,
    };
  });

  const indexJson  = JSON.stringify(index, null, 2) + '\n';
  const indexHash  = sha256Prefix(indexJson);
  purgeStaleFiles(KERNEL_DIR, 'articles', 'json', indexHash);
  atomicWrite(path.join(KERNEL_DIR, `articles.${indexHash}.json`), indexJson);
  return indexHash;
}

// ─── TAGS FILE WRITER ─────────────────────────────────────────────────────────
// Generates tags.generated.js — a flat map of tag → [{ id, title }].
// Enables instant vibe-based filtering in the UI without scanning all articles.

function writeTagsFile(articles) {
  const tagMap = new Map();
  for (const a of articles) {
    for (const tag of (a.tags || [])) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag).push({ id: a.id, title: a.title });
    }
  }

  const tagObj = Object.fromEntries(
    [...tagMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  );

  const tagsJson = JSON.stringify(tagObj, null, 2) + '\n';
  const tagsHash = sha256Prefix(tagsJson);
  purgeStaleFiles(KERNEL_DIR, 'tags', 'json', tagsHash);
  atomicWrite(path.join(KERNEL_DIR, `tags.${tagsHash}.json`), tagsJson);
  return tagsHash;
}

// ─── EXISTING-ID SCANNERS ─────────────────────────────────────────────────────

// Scan hand-curated article files (soma + misc) for IDs — used to build the
// allIds set that prevents generateId() from emitting colliding prefixes.
// Does NOT scan articles.generated.js so we don't inherit stale generated IDs.
function parseHandCuratedIds() {
  const dataDir = path.join(__dirname, 'src/terminal/data');
  const ids     = new Set();
  for (const fname of ['articles.soma.js', 'articles.misc.js']) {
    const f = path.join(dataDir, fname);
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const re  = /\bid:\s*["'`]([^"'`\n]+)["'`]/g;
    let m;
    while ((m = re.exec(src)) !== null) ids.add(m[1]);
  }
  return ids;
}

// Scan hand-curated article files for normalised titles — used to skip files
// that duplicate an existing hand-curated entry.
function parseHandCuratedTitles() {
  const dataDir = path.join(__dirname, 'src/terminal/data');
  const titles  = new Set();
  for (const fname of ['articles.soma.js', 'articles.misc.js']) {
    const f = path.join(dataDir, fname);
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const re  = /\btitle:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(src)) !== null) titles.add(sovereignSlug(m[1]));
  }
  return titles;
}

// Scan ONLY the hand-curated section of kernelBuilds.js (everything before
// @@INJECT_START@@) for existing id AND articleId values.  This is the
// idempotency guard: if an article's generated id matches ANY hand-curated
// entry's `id` or `articleId` field, it is already represented and must not
// be injected again.  We deliberately do NOT scan the inject zone itself —
// the zone is always wiped and regenerated from scratch.
function parseHandCuratedBuildIds() {
  if (!fs.existsSync(BUILDS_PATH)) return new Set();
  const src      = fs.readFileSync(BUILDS_PATH, 'utf8');
  const startIdx = src.indexOf(INJECT_START);
  // Only scan the hand-curated block; fall back to whole file if no marker.
  const section  = startIdx !== -1 ? src.slice(0, startIdx) : src;
  const ids      = new Set();
  // Collect both `id:` and `articleId:` field values — either field is enough
  // to establish that a kernel is already declared in the hand-curated block.
  const re = /\b(?:articleId|id):\s*["'`]([^"'`\n]+)["'`]/g;
  let m;
  while ((m = re.exec(section)) !== null) ids.add(m[1]);
  return ids;
}

// ─── MARKER-BASED BUILD INJECTION ─────────────────────────────────────────────

const INJECT_START = '/* @@INJECT_START@@ */';
const INJECT_END   = '/* @@INJECT_END@@ */';

function serialiseBuild(b) {
  return `  { id: ${JSON.stringify(b.id)}, articleId: ${JSON.stringify(b.articleId)}, name: ${JSON.stringify(b.name)}, status: ${JSON.stringify(b.status)}, desc: ${JSON.stringify(b.desc)} }`;
}

// Clean-slate inject-zone writer — IDEMPOTENT by design.
//
// Every run: wipe the zone completely, then write `items` fresh.
// No reading of existing zone content — previous entries are irrelevant.
// Same input (content dir + hand-curated block) → identical output, always.
function writeInjectZone(items) {
  if (!fs.existsSync(BUILDS_PATH)) {
    console.error(`  ✗ Builds file not found: ${BUILDS_PATH}`);
    return false;
  }

  const src = fs.readFileSync(BUILDS_PATH, 'utf8');

  // Marker Integrity: must have exactly 1 START and 1 END — abort on violation.
  const startCount = (src.match(/\/\* @@INJECT_START@@ \*\//g) || []).length;
  const endCount   = (src.match(/\/\* @@INJECT_END@@ \*\//g) || []).length;

  if (startCount === 0 || endCount === 0) {
    console.error(`  ✗ Injection markers not found in ${path.basename(BUILDS_PATH)}`);
    return false;
  }
  if (startCount > 1 || endCount > 1) {
    console.error(`  ✗ Duplicate injection markers in ${path.basename(BUILDS_PATH)} (START:${startCount}, END:${endCount}) — aborting to prevent corruption`);
    process.exit(1);
  }

  const startIdx = src.indexOf(INJECT_START);
  const endIdx   = src.indexOf(INJECT_END);

  // Always regenerate from scratch — append pattern eliminated.
  const inner = items.length > 0
    ? '\n' + items.map(serialiseBuild).join(',\n') + ',\n'
    : '\n';

  const newSrc =
    src.slice(0, startIdx + INJECT_START.length) +
    inner +
    src.slice(endIdx);

  atomicWrite(BUILDS_PATH, newSrc);
  return true;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

function run() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  KERNEL IMPORT — LEVEL 17: HARDENED STATE ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('  [DRY RUN — no files will be written]\n');
  if (FORCE)   console.log('  [--force — cache bypassed, duplicate-title guard disabled]\n');

  const cache = FORCE ? {} : loadCache();

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`  ✗ Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONTENT_DIR).filter(f => {
    if (!f.endsWith('.md'))    return false;
    if (EXCLUDE_FILES.has(f)) return false;
    return true;
  });

  if (files.length === 0) {
    console.log('  No .md files found in', CONTENT_DIR);
    if (!DRY_RUN) {
      writeGeneratedFile([]);
      console.log('  ✓ articles.generated.js reset to empty array. Chunks dir wiped.\n');
    }
    process.exit(0);
  }

  const handCuratedIds       = parseHandCuratedIds();
  const handCuratedBuildIds  = parseHandCuratedBuildIds();   // inject-zone dedup guard
  const allIds               = new Set([...handCuratedIds]); // for ID collision guard
  const handCuratedTitles    = FORCE ? new Set() : parseHandCuratedTitles();

  let processed = 0;
  let skipped   = 0;
  const pendingArticles = [];
  const pendingBuilds   = [];
  const changedArticles = []; // cache-misses only — used for commit message

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const cacheKey = path.relative(__dirname, fullPath).replace(/\\/g, '/');

    // ── mtime pre-check: skip readFileSync for files that haven't changed ────
    // Requires all three cache keys to be present + both chunk files to exist.
    const stat     = fs.statSync(fullPath);
    const mtimeMs  = stat.mtimeMs;
    const metaKey  = `${cacheKey}:meta`;
    const mtimeKey = `${cacheKey}:mtime`;
    if (!FORCE && cache[mtimeKey] === mtimeMs && cache[cacheKey] && cache[metaKey]) {
      const cachedMeta = JSON.parse(cache[metaKey]);
      const cname        = chunkFileName(cachedMeta.id);
      const chunkPath    = path.join(CHUNKS_DIR,     `${cname}.js`);
      const chunkJsonPath = path.join(CHUNKS_CAS_DIR, `${cname}.json`);
      if (fs.existsSync(chunkPath) && fs.existsSync(chunkJsonPath)) {
        console.log(`  mtime-cache: ${file}`);
        if (!DRY_RUN) {
          // Re-push lean article so the manifest index stays complete.
          // writeGeneratedFile sees cache[_cacheKey] === _hash → skips chunk rewrite.
          pendingArticles.push({ ...cachedMeta, content: '', _hash: cache[cacheKey], _cacheKey: cacheKey });
          if (!handCuratedBuildIds.has(cachedMeta.id)) {
            pendingBuilds.push({
              id:        cachedMeta.id,
              articleId: cachedMeta.id,
              name:      buildNameFromFilename(file),
              status:    cachedMeta.status,
              desc:      cachedMeta.subtitle || cachedMeta.title,
            });
          }
          processed++;
        }
        skipped++;
        continue;
      }
    }

    const raw          = fs.readFileSync(fullPath, 'utf8');
    const rawHash      = fileHash(raw);
    const lastModified = stat.mtime.toISOString().slice(0, 10);

    // gray-matter: handles UTF-8 BOM, multi-line YAML, CRLF, Date objects.
    const { data: fm, content: body } = matter(raw);

    const derived = deriveMetadata(body, file);
    const title   = (fm.title || derived.title).toUpperCase();

    // Skip if the title already exists in a hand-curated (soma/misc) file.
    if (handCuratedTitles.has(sovereignSlug(title))) {
      console.log(`  Skipping (hand-curated conflict): ${file}`);
      skipped++;
      continue;
    }

    const subtitle = fm.subtitle || derived.subtitle || '';
    const date     = fm.date
      ? String(fm.date instanceof Date ? fm.date.toISOString() : fm.date).slice(0, 10)
      : derived.date;
    const status   = canonicalStatus(fm.status || inferStatusFromFilename(file));
    const type     = (fm.type && canonicalType(fm.type)) || inferType(file, body);
    const readTime = fm.readTime || derived.readTime;

    let tags = fm.tags || derived.tags || [];
    if (typeof tags === 'string') {
      tags = tags.split(',').map(t => t.trim().replace(/^["'`]|["'`]$/g, '')).filter(Boolean);
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

    validateArticle({ id, title, date }, file);

    processed++;
    if (!DRY_RUN) {
      pendingArticles.push({ id, type, date, lastModified, title, subtitle, status, readTime, tags, content: body, _hash: rawHash, _cacheKey: cacheKey });
      changedArticles.push(id);

      // Build entry — skip only if already declared in the hand-curated section.
      // The inject zone is always wiped; every non-hand-curated kernel is re-written.
      if (!handCuratedBuildIds.has(id)) {
        pendingBuilds.push({ id: fm.buildId || id, articleId: id, name, status, desc });
      }

      // Store mtime + lean meta so future runs can skip readFileSync on cache hit.
      cache[mtimeKey] = mtimeMs;
      cache[metaKey]  = JSON.stringify({ id, type, date, lastModified, title, subtitle, status, readTime, tags });
    }
  }

  if (!DRY_RUN) {
    // Sort by semver descending — newer versions appear first in the index.
    pendingArticles.sort((a, b) =>
      semver.rcompare(coerceVersionForSort(a.id), coerceVersionForSort(b.id))
    );

    if (!fs.existsSync(KERNEL_DIR)) fs.mkdirSync(KERNEL_DIR, { recursive: true });

    const articlesHash = writeGeneratedFile(pendingArticles, cache);
    saveCache(cache);
    console.log(`\n  ✓ SYSTEM_KERNEL_LOG: ${pendingArticles.length} chunk(s) → generated_chunks/ (Tailwind) + public/kernel/chunks/ (CAS, cache-aware)`);
    console.log(`  ✓ SYSTEM_KERNEL_LOG: articles.${articlesHash}.json → public/kernel/ (${pendingArticles.length} entries, semver-sorted)`);

    const tagsHash = writeTagsFile(pendingArticles);
    console.log(`  ✓ SYSTEM_KERNEL_LOG: tags.${tagsHash}.json → public/kernel/`);

    updateManifest({ kernels: `articles.${articlesHash}.json`, tags: `tags.${tagsHash}.json` });
    console.log(`  ✓ SYSTEM_KERNEL_LOG: manifest.json updated (kernels=${articlesHash} tags=${tagsHash})`);

    // Always rewrite the inject zone — idempotent clean-slate.
    writeInjectZone(pendingBuilds);
    console.log(`  ✓ Inject zone rewritten — ${pendingBuilds.length} entry(s) (idempotent).`);
  }

  if (skipped > 0) console.log(`\n  ↷ ${skipped} kernel(s) skipped (hand-curated conflict).`);
  console.log(`\n  Done. ${processed} kernel(s) processed.\n`);

  // ── Auto-commit + push ────────────────────────────────────────────────────
  if (!DRY_RUN && pendingArticles.length > 0) {
    const message = changedArticles.length > 0
      ? `import: ${changedArticles.join(', ')}`
      : `chore: rebuild kernel manifest (no new kernels)`;
    // Stage only the files this importer generates — never touch unrelated
    // working-tree changes (WASM builds, JSX edits, etc.).
    const filesToStage = [
      'public/kernel',
      'src/terminal/data/generated_chunks',
      'src/terminal/data/articles.generated.js',
      'src/terminal/data/tags.generated.js',
      'src/terminal/data/kernelBuilds.js',
    ];
    console.log(`  git add ${filesToStage.join(' ')}`);
    const add = spawnSync('git', ['add', ...filesToStage], { stdio: 'inherit' });
    if (add.status !== 0) {
      console.error(`  ✗ git add failed (status ${add.status})`);
      process.exit(add.status ?? 1);
    }
    console.log(`  git commit -m "${message}"`);
    const commit = spawnSync('git', ['commit', '-m', message], { stdio: 'inherit' });
    if (commit.status !== 0 && commit.status !== 1) {
      // status 1 = nothing to commit — not an error
      console.error(`  ✗ git commit failed (status ${commit.status})`);
      process.exit(commit.status ?? 1);
    }
    console.log(`  git push`);
    const push = spawnSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });
    if (push.status !== 0) {
      console.error(`  ✗ git push failed (status ${push.status})`);
      process.exit(push.status ?? 1);
    }
    console.log(`  ✓ pushed: ${message}\n`);
  }
}

run();

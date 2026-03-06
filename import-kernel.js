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

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';
import semver from 'semver';
import { normalizeQuery as sovereignSlug } from './src/lib/normalize.js';
import { atomicWrite, fileHash, loadCache, saveCache } from './scripts/_build-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CONTENT_DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'content', 'soma_kernel');   // default: soma_kernel/

const DRY_RUN = process.argv.includes('--dry');
const FORCE   = process.argv.includes('--force');

const GENERATED_PATH = path.join(__dirname, 'src/terminal/data/articles.generated.js');
const CHUNKS_DIR     = path.join(__dirname, 'src/terminal/data/generated_chunks');
const BUILDS_PATH    = path.join(__dirname, 'src/terminal/data/kernelBuilds.js');
const TAGS_PATH      = path.join(__dirname, 'src/terminal/data/tags.generated.js');

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
  // ── Phase 0: ensure chunks dir exists; targeted stale-chunk wipe ──────────
  if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
  const currentChunkNames = new Set(articles.map(a => `${chunkFileName(a.id)}.js`));
  for (const f of fs.readdirSync(CHUNKS_DIR)) {
    if (f.endsWith('.js') && !currentChunkNames.has(f)) {
      fs.rmSync(path.join(CHUNKS_DIR, f));
    }
  }

  // ── Phase 1: write one chunk file per kernel (cache-aware) ────────────────
  for (const a of articles) {
    const wordCount = (a.content || '').trim().split(/\s+/).filter(Boolean).length;
    const len       = `${wordCount} WDS`;
    const cname     = chunkFileName(a.id);
    const chunkPath = path.join(CHUNKS_DIR, `${cname}.js`);

    // Cache hit: skip expensive renderMarkdown if hash matches + chunk exists
    if (a._hash && a._cacheKey && cache[a._cacheKey] === a._hash && fs.existsSync(chunkPath)) {
      continue;
    }

    const html = renderMarkdown(a.content || '');

    const chunk = [
      `// ${cname}.js — DO NOT EDIT MANUALLY.`,
      '// Generated by: node import-kernel.js — Level 17: Hardened State',
      'export default {',
      `  html: ${JSON.stringify(html)},`,
      `  len:  ${JSON.stringify(len)},`,
      '};',
      '',
    ].join('\n');

    atomicWrite(chunkPath, chunk);
    if (a._cacheKey && a._hash) cache[a._cacheKey] = a._hash;
  }

  // ── Phase 2: write the lean metadata index ─────────────────────────────────
  const entries = articles.map(a => {
    const wordCount = (a.content || '').trim().split(/\s+/).filter(Boolean).length;
    const len       = `${wordCount} WDS`;
    const cname     = chunkFileName(a.id);

    // meta: lightweight fields merged with the chunk payload at load time.
    // Chunk exports { html, len } — html replaces body/content, len authoritative.
    const meta = {
      id:       a.id,
      type:     a.type,
      date:     a.date,
      title:    a.title,
      subtitle: a.subtitle,
      status:   a.status,
      readTime: a.readTime,
      tags:     a.tags,
      len,
    };

    // Static string literal — Vite splits each chunk into its own async bundle.
    const importPath = `./generated_chunks/${cname}.js`;

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
      `    len: ${JSON.stringify(len)},`,
      `    loadContent: async () => {`,
      `      const m = await import(${JSON.stringify(importPath)});`,
      `      return Object.assign(${JSON.stringify(meta)}, m.default);`,
      `    },`,
      '  }',
    ].join('\n');
  });

  const lines = [
    '// articles.generated.js — DO NOT EDIT MANUALLY.',
    '// Generated by: node import-kernel.js — Level 11: De-Chonker',
    '// Re-run the script to regenerate from content/soma_kernel/.',
    '// loadContent() lazy-loads the content payload from generated_chunks/.',
    '',
    'const articles = [',
  ];

  if (entries.length > 0) lines.push(entries.join(',\n'));
  lines.push('];');
  lines.push('');
  lines.push('export default articles;');
  lines.push('');

  atomicWrite(GENERATED_PATH, lines.join('\n'));
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

  const entries = [...tagMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, kernels]) => {
      const items = kernels
        .map(k => `    { id: ${JSON.stringify(k.id)}, title: ${JSON.stringify(k.title)} }`)
        .join(',\n');
      return `  ${JSON.stringify(tag)}: [\n${items}\n  ]`;
    });

  const lines = [
    '// tags.generated.js — DO NOT EDIT MANUALLY.',
    '// Generated by: node import-kernel.js — Level 15: Associative Index',
    '// Maps tag → [{ id, title }] for instant vibe-based filtering.',
    '',
    'const tagIndex = {',
    entries.join(',\n'),
    '};',
    '',
    'export default tagIndex;',
    '',
  ];

  atomicWrite(TAGS_PATH, lines.join('\n'));
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
// @@INJECT_START@@) for existing articleId values.  This is the idempotency
// guard: if an articleId is already declared in the hand-curated block we
// skip it from the inject zone so it never appears twice.  We deliberately
// do NOT scan the inject zone itself — the zone is always wiped and
// regenerated from scratch, so its previous contents are irrelevant.
function parseHandCuratedBuildIds() {
  if (!fs.existsSync(BUILDS_PATH)) return new Set();
  const src      = fs.readFileSync(BUILDS_PATH, 'utf8');
  const startIdx = src.indexOf(INJECT_START);
  // Only scan the hand-curated block; fall back to whole file if no marker.
  const section  = startIdx !== -1 ? src.slice(0, startIdx) : src;
  const ids      = new Set();
  const re       = /\barticleId:\s*["'`]([^"'`\n]+)["'`]/g;
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

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw      = fs.readFileSync(fullPath, 'utf8');
    const rawHash  = fileHash(raw);
    const cacheKey = path.relative(__dirname, fullPath).replace(/\\/g, '/');

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
      pendingArticles.push({ id, type, date, title, subtitle, status, readTime, tags, content: body, _hash: rawHash, _cacheKey: cacheKey });

      // Build entry — skip only if already declared in the hand-curated section.
      // The inject zone is always wiped; every non-hand-curated kernel is re-written.
      if (!handCuratedBuildIds.has(id)) {
        pendingBuilds.push({ id: fm.buildId || id, articleId: id, name, status, desc });
      }
    }
  }

  if (!DRY_RUN) {
    // Sort by semver descending — newer versions appear first in the index.
    pendingArticles.sort((a, b) =>
      semver.rcompare(coerceVersionForSort(a.id), coerceVersionForSort(b.id))
    );

    writeGeneratedFile(pendingArticles, cache);
    saveCache(cache);
    console.log(`\n  ✓ Generated ${pendingArticles.length} HTML chunk(s) → generated_chunks/ (cache-aware)`);
    console.log(`  ✓ Generated articles.generated.js (lean index, ${pendingArticles.length} entries, semver-sorted).`);

    // Generate the tag index.
    writeTagsFile(pendingArticles);
    console.log(`  ✓ Generated tags.generated.js (associative index).`);

    // Always rewrite the inject zone — idempotent clean-slate.
    writeInjectZone(pendingBuilds);
    console.log(`  ✓ Inject zone rewritten — ${pendingBuilds.length} entry(s) (idempotent).`);
  }

  if (skipped > 0) console.log(`\n  ↷ ${skipped} kernel(s) skipped (hand-curated conflict).`);
  console.log(`\n  Done. ${processed} kernel(s) processed.\n`);
}

run();

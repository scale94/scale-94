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
import { marked } from 'marked';
import { atomicWrite, fileHash, loadCache, saveCache, sha256Prefix } from './_build-utils.js';
import { KERNEL_DIR, updateManifest, purgeStaleFiles } from './_manifest-utils.js';

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

// ─── HTML UTILS ───────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── MARKED RENDERER — TERMINAL AESTHETIC ────────────────────────────────────
// Mirrors the renderer in import-kernel.js exactly.

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
      return `<strong class="text-cyan-300 font-bold">${this.parser.parseInline(token.tokens)}</strong>`;
    },
    em(token) {
      return `<em class="text-fuchsia-300 italic">${this.parser.parseInline(token.tokens)}</em>`;
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

// ─── RENDERER ─────────────────────────────────────────────────────────────────

function renderMarkdown(body) {
  // Pre-process [[KERNEL-ID]] → neural link buttons
  let processed = body.replace(/\[\[([^\]]+)\]\]/g, (_, id) => {
    const safeId = escapeHtml(id.trim());
    return `<button class="neural-link text-cyan-400 underline underline-offset-2 hover:text-cyan-200 cursor-pointer bg-transparent border-none font-mono text-xs font-bold" data-cmd="${safeId}">${safeId}</button>`;
  });
  // Strip first H1 — the view renders the title from frontmatter separately
  processed = processed.replace(/^#(?!#)[ \t]+[^\n]*\n?/, '');
  return marked.parse(processed);
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

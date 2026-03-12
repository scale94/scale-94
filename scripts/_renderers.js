#!/usr/bin/env node
/**
 * _renderers.js — Level 20: Shared Renderer Layer
 *
 * Exports a unified renderMarkdown(body, theme) that pre-renders markdown
 * to terminal-aesthetic HTML. Each importer passes its theme constant so
 * headings, borders, and accent colours stay per-pipeline.
 *
 * Exports:
 *   THEME_CYAN             — soma_kernel / system_logs palette (cyan/fuchsia)
 *   THEME_AMBER            — academic / cs2-PHD palette (amber/yellow)
 *   THEME_RED              — legislation / governance palette (red/orange)
 *   escapeHtml(s)          — HTML entity escaping (identical across all importers)
 *   stripFirstH1(body)     — remove leading # heading before marked.parse()
 *   renderNeuralLinks(body, theme) — [[ID]] → <button class="neural-link …">
 *   renderMarkdown(body, theme)    — full pipeline: neural links → strip H1 → marked
 */

import { Marked } from 'marked';

// ─── THEME CONSTANTS ─────────────────────────────────────────────────────────

export const THEME_CYAN  = 'cyan';
export const THEME_AMBER = 'amber';
export const THEME_RED   = 'red';

// ─── HTML UTILS ──────────────────────────────────────────────────────────────

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── PRE-PROCESSING HELPERS ───────────────────────────────────────────────────

/**
 * Remove the first top-level heading from body text.
 * ArticleView renders article.title as its own heading, so the H1 is redundant.
 */
export function stripFirstH1(body) {
  return body.replace(/^#(?!#)[ \t]+[^\n]*\n?/, '');
}

/**
 * Transform [[KERNEL-ID]] wiki-style links into neural-link <button> elements.
 * The accent colour matches the caller's theme.
 */
export function renderNeuralLinks(body, theme = THEME_CYAN) {
  const accent =
    theme === THEME_AMBER ? 'amber' :
    theme === THEME_RED   ? 'orange' :
    'cyan';
  return body.replace(/\[\[([^\]]+)\]\]/g, (_, id) => {
    const safeId = escapeHtml(id.trim());
    return `<button class="neural-link text-${accent}-400 underline underline-offset-2 hover:text-${accent}-200 cursor-pointer bg-transparent border-none font-mono text-xs font-bold" data-cmd="${safeId}">${safeId}</button>`;
  });
}

// ─── THEME PALETTE LOOKUP ────────────────────────────────────────────────────

function palette(theme) {
  if (theme === THEME_AMBER) {
    return {
      h1:        'text-[14pt] font-bold mb-4 text-amber-400 tracking-tighter leading-tight',
      h2:        'text-[12pt] text-amber-300 mb-8 font-light tracking-wide',
      h3:        'text-lg font-bold mt-8 mb-4 text-amber-300 flex items-center gap-2',
      listArrow: 'text-amber-400',
      code:      'bg-black/80 border border-amber-900/30 p-4 mb-6 rounded text-xs text-amber-300 font-mono whitespace-pre-wrap overflow-x-auto shadow-inner',
      bq:        'border-l-2 border-amber-500/50 pl-4 mb-6 text-amber-400/70 italic',
      th:        'px-3 py-2 text-left text-amber-400 border-b border-amber-900/50 text-xs font-bold tracking-wider',
      td:        'px-3 py-2 text-[#39ff14] text-xs border-b border-amber-900/20',
      table:     'w-full mb-6 border-collapse border border-amber-900/30',
      strong:    'text-amber-300 font-bold',
      em:        'text-amber-200 italic',
      codespan:  'bg-black/60 text-amber-300 font-mono text-xs px-1 py-0.5 rounded border border-amber-900/30',
      link:      'text-amber-400 underline underline-offset-2 hover:text-amber-200',
      hr:        null,   // not used by amber
    };
  }
  if (theme === THEME_RED) {
    return {
      h1:        'text-[14pt] font-bold mb-4 text-red-400 tracking-tighter leading-tight',
      h2:        'text-[12pt] text-orange-300 mb-8 font-light tracking-wide',
      h3:        'text-lg font-bold mt-8 mb-4 text-orange-300 flex items-center gap-2',
      listArrow: 'text-red-400',
      code:      'bg-black/80 border border-red-900/30 p-4 mb-6 rounded text-xs text-red-300 font-mono whitespace-pre-wrap overflow-x-auto shadow-inner',
      bq:        'border-l-2 border-orange-500/50 pl-4 mb-6 text-orange-400/70 italic',
      th:        'px-3 py-2 text-left text-red-400 border-b border-red-900/50 text-xs font-bold tracking-wider',
      td:        'px-3 py-2 text-[#39ff14] text-xs border-b border-red-900/20',
      table:     'w-full mb-6 border-collapse border border-red-900/30',
      strong:    'text-orange-300 font-bold',
      em:        'text-orange-200 italic',
      codespan:  'bg-black/60 text-red-300 font-mono text-xs px-1 py-0.5 rounded border border-red-900/30',
      link:      'text-orange-400 underline underline-offset-2 hover:text-orange-200',
      hr:        'border-red-900/40 my-6',
    };
  }
  // THEME_CYAN (default) — mirrors import-kernel.js / import-system.js exactly
  return {
    h1:        'text-[14pt] font-bold mb-4 text-cyan-400 tracking-tighter leading-tight',
    h2:        'text-[12pt] text-fuchsia-400 mb-12 font-light tracking-wide',
    h3:        'text-lg font-bold mt-8 mb-4 text-fuchsia-400 flex items-center gap-2',
    listArrow: 'text-cyan-400',
    code:      'bg-black/80 border border-cyan-900/30 p-4 mb-6 rounded text-xs text-cyan-300 font-mono whitespace-pre-wrap overflow-x-auto shadow-inner',
    bq:        'border-l-2 border-cyan-500/50 pl-4 mb-6 text-cyan-400/70 italic',
    th:        'px-3 py-2 text-left text-cyan-400 border-b border-cyan-900/50 text-xs font-bold tracking-wider',
    td:        'px-3 py-2 text-[#39ff14] text-xs border-b border-cyan-900/20',
    table:     'w-full mb-6 border-collapse border border-cyan-900/30',
    strong:    'text-cyan-300 font-bold',
    em:        'text-fuchsia-300 italic',
    codespan:  'bg-black/60 text-cyan-300 font-mono text-xs px-1 py-0.5 rounded border border-cyan-900/30',
    link:      'text-cyan-400 underline underline-offset-2 hover:text-cyan-200',
    hr:        null,   // not used by cyan
  };
}

// ─── RENDERER CACHE ──────────────────────────────────────────────────────────
// Each theme gets its own Marked() instance so importers don't clobber each
// other when run together in the same process. Instances are cached after
// first construction.

const _rendererCache = new Map();

function getRenderer(theme) {
  if (_rendererCache.has(theme)) return _rendererCache.get(theme);

  const p  = palette(theme);
  const m  = new Marked();

  const renderer = {
    heading(token) {
      const text = this.parser.parseInline(token.tokens);
      const cls  =
        token.depth === 1 ? p.h1 :
        token.depth === 2 ? p.h2 :
                            p.h3;
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
      return `<li class="flex items-start gap-2 text-[#39ff14]"><span class="${p.listArrow} mt-1 shrink-0">&#9658;</span><span>${text}</span></li>\n`;
    },
    code(token) {
      return `<pre class="${p.code}"><code>${escapeHtml(token.text)}</code></pre>\n`;
    },
    blockquote(token) {
      const body = this.parser.parse(token.tokens);
      return `<blockquote class="${p.bq}">${body}</blockquote>\n`;
    },
    table(token) {
      const th = token.header.map(h =>
        `<th class="${p.th}">${this.parser.parseInline(h.tokens)}</th>`
      ).join('');
      const tr = token.rows.map(row =>
        `<tr>${row.map(cell =>
          `<td class="${p.td}">${this.parser.parseInline(cell.tokens)}</td>`
        ).join('')}</tr>`
      ).join('\n');
      return `<table class="${p.table}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>\n`;
    },
    strong(token) {
      const text = this.parser.parseInline(token.tokens);
      return `<strong class="${p.strong}">${text}</strong>`;
    },
    em(token) {
      const text = this.parser.parseInline(token.tokens);
      return `<em class="${p.em}">${text}</em>`;
    },
    codespan(token) {
      return `<code class="${p.codespan}">${escapeHtml(token.text)}</code>`;
    },
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      const href = escapeHtml(token.href || '');
      return `<a href="${href}" class="${p.link}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  };

  // hr is only present in the legislation (RED) renderer
  if (p.hr) {
    renderer.hr = () => `<hr class="${p.hr}" />\n`;
  }

  m.use({ renderer });
  _rendererCache.set(theme, m);
  return m;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Render a markdown body to terminal-aesthetic HTML.
 *
 * Pre-processing applied (in order):
 *   1. renderNeuralLinks — [[ID]] → <button class="neural-link …">
 *   2. stripFirstH1      — removes leading # heading
 *   3. marked.parse      — full markdown → HTML via theme renderer
 *
 * @param {string} body   - Raw markdown text (post-frontmatter content)
 * @param {string} theme  - One of THEME_CYAN | THEME_AMBER | THEME_RED
 * @returns {string}      - Rendered HTML string
 */
export function renderMarkdown(body, theme = THEME_CYAN) {
  let processed = renderNeuralLinks(body, theme);
  processed     = stripFirstH1(processed);
  return getRenderer(theme).parse(processed);
}

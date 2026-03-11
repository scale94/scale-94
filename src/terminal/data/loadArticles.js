/**
 * loadArticles.js
 *
 * Auto-loads every .md file from content/soma_kernel/ at build time.
 * Drop a new .md file in that folder — it appears on the site automatically.
 *
 * Frontmatter is optional. Files without it get safe defaults derived from
 * their filename (ID, title), type: 'kernel', status: 'ACTIVE'.
 *
 * Supported frontmatter fields:
 *   id, type, date, title, subtitle, status, readTime, tags
 *
 * Generate new files: npm run spawn -- "My Kernel Title" [type]
 */

// ─── LAZY GLOBS ───────────────────────────────────────────────────────────────
// Each entry is () => Promise<string>. Vite emits one async chunk per .md file;
// content is only fetched when the user actually opens an article.
const markdownModules    = import.meta.glob('../../../content/soma_kernel/*.md', { as: 'raw' });
const legislationModules = import.meta.glob('../../../content/legislation/*.md', { as: 'raw' });

// ─── Module-level regex constants ─────────────────────────────────────────────
// Hoisted so each pattern is compiled once by the JS engine, not on every
// function call. Semantics are identical to the inline literals they replace.
const RE_FM_DELIM     = /^---\s*$/m;       // frontmatter fence line
const RE_LEADING_NL   = /^\r?\n/;          // leading newline after closing ---
const RE_H1           = /^#(?!#)[ \t]+(.+)$/m;
const RE_H2           = /^##(?!#)[ \t]+(.+)$/m;
const RE_MD_BOLD      = /\*{1,3}(.+?)\*{1,3}/g;
const RE_ID_UNDER     = /_/g;
const RE_ID_SPACES    = /\s+/g;
const RE_ID_PARENS    = /[()[\\]]/g;
const RE_ID_MULTIDASH = /-+/g;
const RE_ID_EDGES     = /^-|-$/g;
const RE_STUB_DASH    = /[-_]/g;
const RE_STUB_SPACES  = /\s+/g;
const RE_QUOTE_WRAP   = /^["']|["']$/g;
const RE_WORDS        = /\S+/g;

// ─── Frontmatter parser ───────────────────────────────────────────────────────
// Uses a multiline regex split so trailing whitespace or \r after '---' never
// breaks delimiter detection. Handles UTF-8 BOM, Windows CRLF, and '--- '.
//
// Split result for a file with frontmatter:
//   parts[0] — empty string (before the opening ---)
//   parts[1] — raw YAML key:value lines
//   parts[2] — body markdown (everything after the closing ---)
// Split result for a file without frontmatter:
//   parts[0] — entire file content (length === 1, no frontmatter)
const parseFrontmatter = (raw) => {
  if (typeof raw !== 'string') return { frontmatter: {}, body: '' };

  // ── 1. Strip UTF-8 Byte Order Mark ─────────────────────────────────────────
  // A BOM (\uFEFF) prepended by some Windows editors causes raw.startsWith('---')
  // to return false even when the file is correctly formatted, silently dropping
  // all frontmatter fields (date, title, type) and falling through to the body
  // fallback — which then injects a full paragraph as the article title.
  // charCodeAt(0) check avoids constructing a regex object on every call.
  const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;

  // ── 2. Multiline regex split on '---' delimiters ───────────────────────────
  // RE_FM_DELIM matches a line that is exactly '---' plus any trailing whitespace
  // (\s* catches spaces, tabs, and \r from Windows CRLF line endings).
  // This is strictly more robust than indexOf('\n---') which fails when the
  // delimiter has trailing characters.
  const parts = clean.split(RE_FM_DELIM);

  // Fewer than 3 parts → no valid frontmatter block present
  if (parts.length < 3) return { frontmatter: {}, body: clean };

  // parts[1] is the YAML block; parts[2..] is the body (rejoin in case the body
  // itself contains '---' horizontal rules — e.g. SCALE-Y-KERNEL uses --- as a
  // section separator inside the markdown body).
  // Fast path: parts.length === 3 is the common case (no '---' in body), so
  // skip the slice+join allocation entirely.
  const fmRaw  = parts[1];
  const rawBody = parts.length === 3 ? parts[2] : parts.slice(2).join('---\n');
  const body    = rawBody.replace(RE_LEADING_NL, '');

  // ── 3. Parse key: value pairs ──────────────────────────────────────────────
  // Flat YAML only — multi-line blocks (sequences starting with '  - item') are
  // intentionally skipped since our strict template never emits them.
  const frontmatter = {};
  for (const line of fmRaw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key   = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!key || key.startsWith('#') || key.startsWith('-')) continue;
    // Inline array: [Tag1, Tag2, Tag3]
    if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(RE_QUOTE_WRAP, ''))
        .filter(Boolean);
    } else {
      frontmatter[key] = value.replace(RE_QUOTE_WRAP, '');
    }
  }

  return { frontmatter, body };
};

// ─── Metadata derivation ──────────────────────────────────────────────────────
// Extracts title/subtitle from markdown body when frontmatter omits them.
// SAFETY: any derived title is clamped to MAX_TITLE_LEN characters.
// Without this, the 'firstLine' fallback can grab an entire opening paragraph
// (e.g. "The central thesis posits...") and pass it as the title prop to
// HackerText/ArticleView, causing catastrophic layout shifts on mobile.
const MAX_TITLE_LEN = 60;

const deriveFromContent = (body, filename) => {
  const h1 = body.match(RE_H1);
  const h2 = body.match(RE_H2);

  // firstLine: first non-empty, non-heading line — only used as last resort.
  // Clamped hard to MAX_TITLE_LEN to prevent paragraph injection into the title.
  // For-loop with early break avoids allocating an intermediate mapped array
  // just to find a single value.
  let firstLine = '';
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t && !t.startsWith('#')) { firstLine = t; break; }
  }

  let rawTitle;
  if (h1) {
    // H1 titles are intentionally short; strip markdown bold/italic wrappers.
    rawTitle = h1[1].trim().replace(RE_MD_BOLD, '$1');
  } else if (firstLine) {
    // Paragraph fallback — always truncate.
    rawTitle = firstLine.substring(0, MAX_TITLE_LEN);
  } else {
    rawTitle = filename;
  }

  const rawSubtitle = h2 ? h2[1].trim() : '';

  return { rawTitle, rawSubtitle };
};

// ─── Filename → ID (DASH-UPPERCASE Handshake Rule) ────────────────────────────
const filenameToId = (filename) =>
  filename
    .toUpperCase()
    .replace(RE_ID_UNDER, '-')
    .replace(RE_ID_SPACES, '-')
    .replace(RE_ID_PARENS, '')
    .replace(RE_ID_MULTIDASH, '-')
    .replace(RE_ID_EDGES, '');

// ─── Build article stubs ──────────────────────────────────────────────────────
// Stubs are index-only — no content fetched yet. loadContent() fires on open.
// `defaultType` lets legislation stubs self-identify without relying solely on
// frontmatter (which always contains type: 'legislation' in generated stubs, but
// this makes the fallback explicit and safe).
function buildStubs(moduleMap, defaultType = 'kernel') {
  return Object.entries(moduleMap).map(([filePath, loader]) => {
    const filename  = filePath.split('/').pop().replace(/\.md$/, '');
    const stubId    = filenameToId(filename);
    const stubTitle = filename.replace(RE_STUB_DASH, ' ').replace(RE_STUB_SPACES, ' ').toUpperCase();

    // ── Per-stub content cache ─────────────────────────────────────────────────
    // Populated on the first loadContent() call; all subsequent opens return the
    // same object reference with zero re-parsing overhead.
    let _cached = null;

    return {
      id:       stubId,
      type:     defaultType,
      date:     '',
      title:    stubTitle,
      subtitle: '',
      status:   'ACTIVE',
      readTime: '',
      tags:     [],
      body:     undefined,
      content:  undefined,

      loadContent: async () => {
        if (_cached) return _cached;

        let raw = '';
        try { raw = await loader(); } catch (err) { console.error('[KERNEL_LOG] Failed to load chunk:', filename, err); }

        const { frontmatter, body } = parseFrontmatter(raw);
        const { rawTitle, rawSubtitle } = deriveFromContent(body, filename);

        // ── Diagnostic: warn when expected frontmatter fields are absent ───────
        // Fires during development and in the browser console on any open article.
        // Use this to audit which files still have corrupt or missing metadata.
        if (!frontmatter.date) {
          console.warn(`[loadArticles] missing frontmatter.date — id: ${frontmatter.id || stubId}`);
        }
        if (!frontmatter.title) {
          console.warn(`[loadArticles] missing frontmatter.title — id: ${frontmatter.id || stubId} (using derived: "${rawTitle}")`);
        }

        // Word count: RE_WORDS match avoids allocating the full split+filter array.
        const wordCount = body ? (body.match(RE_WORDS) ?? []).length : 0;

        // ── Final title resolution ─────────────────────────────────────────────
        // Priority: frontmatter.title > H1 from body > firstLine (clamped) > stubTitle
        // stubTitle is already uppercase — only call toUpperCase() for other sources.
        const resolvedTitle = frontmatter.title
          ? frontmatter.title.substring(0, MAX_TITLE_LEN).toUpperCase()
          : rawTitle
            ? rawTitle.substring(0, MAX_TITLE_LEN).toUpperCase()
            : stubTitle.substring(0, MAX_TITLE_LEN);  // already uppercase

        _cached = {
          id:       frontmatter.id                               || stubId,
          type:     frontmatter.type                             || defaultType,
          date:     frontmatter.date                             || '',
          title:    resolvedTitle,
          subtitle: frontmatter.subtitle                         || rawSubtitle,
          status:   frontmatter.status                           || 'ACTIVE',
          readTime: frontmatter.readTime                         || '',
          len:      `${wordCount} WDS`,
          tags:     Array.isArray(frontmatter.tags)
                      ? frontmatter.tags
                      : frontmatter.tags
                        ? [frontmatter.tags]
                        : [],
          // body: canonical post-frontmatter markdown content
          // content: alias for backward compatibility with ArticleView
          body,
          content: body,
        };

        return _cached;
      },
    };
  });
}

const articles            = buildStubs(markdownModules,    'kernel');
const legislationArticles = buildStubs(legislationModules, 'legislation');

export default [...articles, ...legislationArticles];

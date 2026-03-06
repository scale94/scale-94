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

// ─── LAZY GLOB ────────────────────────────────────────────────────────────────
// Each entry is () => Promise<string>. Vite emits one async chunk per .md file;
// content is only fetched when the user actually opens an article.
const markdownModules = import.meta.glob('../../../content/soma_kernel/*.md', { as: 'raw' });

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
  const clean = raw.replace(/^\uFEFF/, '');

  // ── 2. Multiline regex split on '---' delimiters ───────────────────────────
  // /^---\s*$/m matches a line that is exactly '---' plus any trailing whitespace
  // (\s* catches spaces, tabs, and \r from Windows CRLF line endings).
  // This is strictly more robust than indexOf('\n---') which fails when the
  // delimiter has trailing characters.
  const parts = clean.split(/^---\s*$/m);

  // Fewer than 3 parts → no valid frontmatter block present
  if (parts.length < 3) return { frontmatter: {}, body: clean };

  // parts[1] is the YAML block; parts[2..] is the body (rejoin in case the body
  // itself contains '---' horizontal rules — e.g. SCALE-Y-KERNEL uses --- as a
  // section separator inside the markdown body).
  const fmRaw = parts[1];
  const body  = parts.slice(2).join('---\n').replace(/^\r?\n/, '');

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
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      frontmatter[key] = value.replace(/^["']|["']$/g, '');
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
  const h1 = body.match(/^#(?!#)[ \t]+(.+)$/m);
  const h2 = body.match(/^##(?!#)[ \t]+(.+)$/m);

  // firstLine: first non-empty, non-heading line — only used as last resort.
  // Clamped hard to MAX_TITLE_LEN to prevent paragraph injection into the title.
  const firstLine = body
    .split('\n')
    .map(l => l.trim())
    .find(l => l && !l.startsWith('#'));

  let rawTitle;
  if (h1) {
    // H1 titles are intentionally short; strip markdown bold/italic wrappers.
    rawTitle = h1[1].trim().replace(/\*{1,3}(.+?)\*{1,3}/g, '$1');
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
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[()[\\]]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// ─── Build article stubs ──────────────────────────────────────────────────────
// Stubs are index-only — no content fetched yet. loadContent() fires on open.
const articles = Object.entries(markdownModules).map(([filePath, loader]) => {
  const filename  = filePath.split('/').pop().replace(/\.md$/, '');
  const stubId    = filenameToId(filename);
  const stubTitle = filename.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toUpperCase();

  return {
    id:       stubId,
    type:     'kernel',
    date:     '',
    title:    stubTitle,
    subtitle: '',
    status:   'ACTIVE',
    readTime: '',
    tags:     [],
    body:     undefined,
    content:  undefined,

    loadContent: async () => {
      let raw = '';
      try { raw = await loader(); } catch (err) { console.error('[KERNEL_LOG] Failed to load chunk:', filename, err); }

      const { frontmatter, body } = parseFrontmatter(raw);
      const { rawTitle, rawSubtitle } = deriveFromContent(body, filename);

      // ── Diagnostic: warn when expected frontmatter fields are absent ─────────
      // Fires during development and in the browser console on any open article.
      // Use this to audit which files still have corrupt or missing metadata.
      if (!frontmatter.date) {
        console.warn(`[loadArticles] missing frontmatter.date — id: ${frontmatter.id || stubId}`);
      }
      if (!frontmatter.title) {
        console.warn(`[loadArticles] missing frontmatter.title — id: ${frontmatter.id || stubId} (using derived: "${rawTitle}")`);
      }

      const wordCount = body.trim()
        ? body.trim().split(/\s+/).filter(Boolean).length
        : 0;

      // ── Final title resolution ───────────────────────────────────────────────
      // Priority: frontmatter.title > H1 from body > firstLine (clamped) > stubTitle
      // The toUpperCase() call is safe on any ≤60-char string.
      // If frontmatter.title is present but abnormally long (shouldn't happen with
      // our strict template), clamp it here as a final safety net.
      const resolvedTitle = (frontmatter.title || rawTitle || stubTitle)
        .substring(0, MAX_TITLE_LEN)
        .toUpperCase();

      return {
        id:       frontmatter.id                               || stubId,
        type:     frontmatter.type                             || 'kernel',
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
    },
  };
});

export default articles;

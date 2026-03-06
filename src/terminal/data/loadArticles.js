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
// Robust split-based approach: finds the opening '---' and the next '---' on its
// own line. Handles \r\n (Windows) and \n. Returns { frontmatter: {}, body: '' }
// for any input, never throws.
const parseFrontmatter = (raw) => {
  if (typeof raw !== 'string' || !raw.startsWith('---')) {
    return { frontmatter: {}, body: raw ?? '' };
  }

  // Find the closing '---' — must be on its own line (after the first \n).
  const afterOpen = raw.indexOf('\n');
  if (afterOpen === -1) return { frontmatter: {}, body: raw };

  // Search for \n--- at any point after the opening line
  const closeIdx = raw.indexOf('\n---', afterOpen);
  if (closeIdx === -1) return { frontmatter: {}, body: raw };

  const fmRaw  = raw.slice(afterOpen + 1, closeIdx);
  // Body starts after the closing '---' line (skip the \n that follows ---)
  const bodyStart = closeIdx + 4; // length of '\n---'
  const body = raw.slice(bodyStart).replace(/^\r?\n/, '');

  // Parse key: value pairs (flat only — no multi-line YAML blocks)
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
const deriveFromContent = (body, filename) => {
  const h1 = body.match(/^#(?!#)[ \t]+(.+)$/m);
  const h2 = body.match(/^##(?!#)[ \t]+(.+)$/m);
  const firstLine = body.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));

  const rawTitle    = h1 ? h1[1].trim().replace(/\*{1,3}(.+?)\*{1,3}/g, '$1') : (firstLine || filename);
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
      try { raw = await loader(); } catch { /* file read failure — return safe stub */ }

      const { frontmatter, body } = parseFrontmatter(raw);
      const { rawTitle, rawSubtitle } = deriveFromContent(body, filename);

      const wordCount = body.trim()
        ? body.trim().split(/\s+/).filter(Boolean).length
        : 0;

      const resolved = {
        id:       frontmatter.id                               || stubId,
        type:     frontmatter.type                             || 'kernel',
        date:     frontmatter.date                             || '',
        title:    (frontmatter.title || rawTitle || stubTitle).toUpperCase(),
        subtitle: frontmatter.subtitle                         || rawSubtitle,
        status:   frontmatter.status                           || 'ACTIVE',
        readTime: frontmatter.readTime                         || '',
        len:      `${wordCount} WDS`,
        tags:     Array.isArray(frontmatter.tags)
                    ? frontmatter.tags
                    : frontmatter.tags
                      ? [frontmatter.tags]
                      : [],
        // body: the raw markdown content (post-frontmatter)
        // content: alias kept for backward compatibility with ArticleView
        body,
        content: body,
      };

      return resolved;
    },
  };
});

export default articles;

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
// Returns { frontmatter: {}, content: string } for any input.
// If the file has no --- block, frontmatter is empty and content is the raw text.
const parseFrontmatter = (raw) => {
  if (typeof raw !== 'string') return { frontmatter: {}, content: '' };
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content: raw };

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key   = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!key) continue;
    // Inline array: [Tag1, Tag2, Tag3]
    if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else {
      frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  return { frontmatter, content: match[2] ?? '' };
};

// ─── Metadata derivation ──────────────────────────────────────────────────────
// Extracts title/subtitle/date from markdown content when frontmatter omits them.
const deriveFromContent = (content, filename) => {
  const h1 = content.match(/^#(?!#)[ \t]+(.+)$/m);
  const h2 = content.match(/^##(?!#)[ \t]+(.+)$/m);
  const firstLine = content.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));

  const rawTitle    = h1 ? h1[1].trim() : (firstLine || filename);
  const rawSubtitle = h2 ? h2[1].trim() : '';
  const dateMatch   = content.match(/(?:^|\n)(?:date|Date):[ \t]*(.+)/);
  const date        = dateMatch ? dateMatch[1].trim() : '';

  return { rawTitle, rawSubtitle, date };
};

// ─── Filename → ID (DASH-UPPERCASE Handshake Rule) ────────────────────────────
const filenameToId = (filename) =>
  filename
    .toUpperCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[()[\]]/g, '')
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
    content:  undefined,

    loadContent: async () => {
      let raw = '';
      try { raw = await loader(); } catch { /* file read failure — return safe stub */ }
      const { frontmatter, content } = parseFrontmatter(raw);
      const { rawTitle, rawSubtitle, date: derivedDate } = deriveFromContent(content, filename);
      const wordCount = content.trim()
        ? content.trim().split(/\s+/).filter(Boolean).length
        : 0;

      return {
        id:       frontmatter.id                               || stubId,
        type:     frontmatter.type                             || 'kernel',
        date:     frontmatter.date                             || derivedDate,
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
        content:  content || '',
      };
    },
  };
});

export default articles;
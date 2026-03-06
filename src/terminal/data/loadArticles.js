/**
 * loadArticles.js
 *
 * Auto-loads every .md file from content/soma_kernel/ at build time.
 * Just drop a new .md file in that folder – it appears on the site automatically.
 * No manual edits to articles.js required.
 *
 * Optional: add YAML frontmatter to a .md file for richer metadata:
 *
 * ---
 * id: MY-KERNEL-1.0
 * date: 2026-02-28
 * status: ACTIVE
 * readTime: 10 min read
 * tags: [Tag1, Tag2, Tag3]
 * ---
 */

// ─── LAZY GLOB — content is NOT bundled ──────────────────────────────────────
// Each entry is a function: () => Promise<string>. Vite emits one async chunk
// per .md file; content is only fetched when the user actually opens an article.
const markdownModules = import.meta.glob('../../../content/soma_kernel/*.md', { as: 'raw' });

// ─── Frontmatter parser ───────────────────────────────────────────────────────
const parseFrontmatter = (raw) => {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content: raw };

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key   = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (!key) continue;
    if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    } else {
      frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }

  return { frontmatter, content: match[2] };
};

// ─── Metadata derivation ──────────────────────────────────────────────────────
const deriveFromContent = (content, filename) => {
  const h1 = content.match(/^#(?!#)[ \t]+(.+)$/m);
  const h2 = content.match(/^##(?!#)[ \t]+(.+)$/m);
  const firstLine = content.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));

  const rawTitle    = h1 ? h1[1].trim() : (firstLine || filename);
  const rawSubtitle = h2 ? h2[1].trim() : '';

  const dateMatch = content.match(/(?:^|\n)(?:date|Date):[ \t]*(.+)/);
  const date = dateMatch ? dateMatch[1].trim() : '';

  return { rawTitle, rawSubtitle, date };
};

// ─── THE HANDSHAKE FIX: Filename → ID ─────────────────────────────────────────
const filenameToId = (filename) =>
  filename
    .toUpperCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[()[\]]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// ─── Build article stubs (index only — no content loaded yet) ─────────────────
// Stubs give the article list enough info to render the kernel index.
// `loadContent()` is called lazily when a user actually opens the article.
const articles = Object.entries(markdownModules).map(([filePath, loader]) => {
  const filename = filePath.split('/').pop().replace(/\.md$/, '');
  const stubId   = filenameToId(filename);
  const stubTitle = filename.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toUpperCase();

  return {
    id:       stubId,
    type:     'kernel_doc',
    date:     '',
    title:    stubTitle,
    subtitle: '',
    status:   'ACTIVE',
    readTime: '',
    tags:     [],
    content:  undefined, // populated by loadContent()

    // Called in App.jsx before setSelectedArticle — fetches + parses the .md file.
    loadContent: async () => {
      const raw = await loader();
      const { frontmatter, content } = parseFrontmatter(raw);
      const { rawTitle, rawSubtitle, date: derivedDate } = deriveFromContent(content, filename);
      return {
        id:       frontmatter.id       || stubId,
        type:     'kernel_doc',
        date:     frontmatter.date     || derivedDate,
        title:    (frontmatter.title   || rawTitle).toUpperCase(),
        subtitle:  frontmatter.subtitle || rawSubtitle,
        status:   frontmatter.status   || 'ACTIVE',
        readTime: frontmatter.readTime || '',
        tags:     Array.isArray(frontmatter.tags)
                    ? frontmatter.tags
                    : frontmatter.tags
                      ? [frontmatter.tags]
                      : [],
        content,
      };
    },
  };
});

export default articles;
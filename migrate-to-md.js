/**
 * migrate-to-md.js
 *
 * One-shot migration: articles.soma.js + articles.misc.js + articles.archive.js
 * → individual .md files in /content/ with full YAML frontmatter.
 *
 * Run from project root:   node migrate-to-md.js
 *
 * After verifying output, complete the migration by emptying the three static
 * arrays (see instructions at the bottom of this file).
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Resolve __dirname in ESM ──────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Import all three static article sources ───────────────────────────────────
import soma    from './src/terminal/data/articles.soma.js';
import misc    from './src/terminal/data/articles.misc.js';
import archive from './src/terminal/data/articles.archive.js';

const ALL_ARTICLES = [...soma, ...misc, ...archive];

// ── Output directory ──────────────────────────────────────────────────────────
// Outputs to /content/ — scanned by loadArticles.js at build time.
const outputDir = path.join(__dirname, 'content');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ── Filename builder ──────────────────────────────────────────────────────────
// Generates a safe, unique filename. The frontmatter id: field is the authority —
// the filename just needs to be valid and unique on disk.
const toFilename = (id) =>
  id.toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')  // keep dots + dashes, kill everything else
    .replace(/-+/g, '-')             // collapse double-dashes
    .replace(/^-|-$/g, '')           // trim edges
  + '.md';

// ── Frontmatter builder ───────────────────────────────────────────────────────
const buildFrontmatter = (a) => {
  const safeStr = (s) => (s || '').replace(/"/g, '\\"');
  const tags    = Array.isArray(a.tags) && a.tags.length > 0
    ? `[${a.tags.join(', ')}]`
    : '[]';

  return [
    '---',
    `id: ${a.id}`,
    `title: "${safeStr(a.title)}"`,
    `subtitle: "${safeStr(a.subtitle)}"`,
    `date: ${a.date || ''}`,
    `status: ${a.status || 'ACTIVE'}`,
    `readTime: ${a.readTime || ''}`,
    `tags: ${tags}`,
    '---',
    '',
  ].join('\n');
};

// ── Run ───────────────────────────────────────────────────────────────────────
let written = 0;
let skipped = 0;
const seenIds = new Set();

for (const article of ALL_ARTICLES) {
  if (!article.id) {
    console.warn(`[SKIP] Article with no id — title: "${article.title}"`);
    skipped++;
    continue;
  }

  // Detect duplicate IDs across the three source files
  if (seenIds.has(article.id)) {
    console.warn(`[DUP]  Skipping duplicate id: ${article.id}`);
    skipped++;
    continue;
  }
  seenIds.add(article.id);

  const filename = toFilename(article.id);
  const filePath = path.join(outputDir, filename);

  // Don't overwrite if a file with identical content already exists
  const fullContent = buildFrontmatter(article) + (article.content || '');
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === fullContent) {
    console.log(`[SAME] ${filename}`);
    skipped++;
    continue;
  }

  fs.writeFileSync(filePath, fullContent, 'utf8');
  console.log(`[WRITE] ${filename}`);
  written++;
}

console.log(`
✅ Migration done.
   Written : ${written}
   Skipped : ${skipped}
   Total   : ${ALL_ARTICLES.length}

━━━ NEXT STEP ━━━
To complete the migration, empty the three static arrays so the
auto-loader becomes the single source of truth:

  src/terminal/data/articles.soma.js    →  export default [];
  src/terminal/data/articles.misc.js    →  export default [];
  src/terminal/data/articles.archive.js →  export default [];

Then run:  npm run build
The auto-loader in loadArticles.js will pick up all .md files from /content/.
`);

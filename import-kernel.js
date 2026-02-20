#!/usr/bin/env node
/**
 * import-kernel.js
 * Scans a directory for .md files and integrates them into
 * src/terminal/data/articles.js and src/terminal/data/kernelBuilds.js
 *
 * Usage:
 *   node import-kernel.js                        # scan ./content/
 *   node import-kernel.js ./my-kernels/          # scan custom dir
 *   node import-kernel.js ./my-kernels/ --dry    # preview only, no writes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONTENT_DIR   = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'content');

const DRY_RUN       = process.argv.includes('--dry');
const ARTICLES_PATH = path.join(__dirname, 'src/terminal/data/articles.js');
const BUILDS_PATH   = path.join(__dirname, 'src/terminal/data/kernelBuilds.js');

// ─── EXCLUSION LIST ───────────────────────────────────────────────────────────
// Files in this set will never be imported regardless of source directory.
const EXCLUDE_FILES = new Set([
  'Soft_Climb_Sequence.md',
]);

// Status badge map — inferred from filename / frontmatter
const STATUS_KEYWORDS = {
  ACTIVE: ['active', 'online', 'running'],
  ARCHIVED: ['archived', 'archive', 'legacy', 'historical'],
  FROZEN: ['frozen', 'locked', 'final'],
  PROPOSED: ['proposed', 'draft', 'wip'],
  PLATINUM: ['platinum', 'apex', 'gated'],
  STABLE: ['stable'],
  RUNNING: ['running'],
  LEGACY: ['legacy'],
};

// ─── FRONTMATTER PARSER ──────────────────────────────────────────────────────
// Supports optional YAML-style frontmatter block at top of file:
//   ---
//   id: GEO-1.0
//   title: Geopolitical Kinetics
//   status: ACTIVE
//   tags: [Geopolitics, Defense]
//   type: kernel_doc
//   subtitle: ...
//   ---

function parseFrontmatter(raw) {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return { fm: {}, body: raw };

  const fmLines = fmMatch[1].split('\n');
  const fm = {};

  for (const line of fmLines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val  = line.slice(colonIdx + 1).trim();

    // Parse array values: [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
    }

    fm[key] = val;
  }

  return { fm, body: fmMatch[2] };
}

// ─── CONTENT EXTRACTOR ───────────────────────────────────────────────────────
// For files WITHOUT frontmatter, infers fields from document structure.

function inferFromContent(body, filename) {
  const lines = body.split('\n');

  // Title: first # heading
  const titleLine = lines.find(l => /^#{1,2}\s/.test(l));
  const title = titleLine
    ? titleLine.replace(/^#{1,2}\s+/, '').trim().toUpperCase()
    : filename.replace(/[-_]/g, ' ').replace(/\.md$/i, '').toUpperCase();

  // Subtitle: first ## after title, or first blockquote
  const subtitleLine = lines.find(l =>
    /^#{2,3}\s/.test(l) && l !== titleLine
  ) || lines.find(l => /^>\s/.test(l));
  const subtitle = subtitleLine
    ? subtitleLine.replace(/^#{2,3}\s+/, '').replace(/^>\s*\*?/, '').replace(/\*$/, '').trim()
    : '';

  // Date: look for ISO date anywhere in doc
  const dateMatch = body.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  // Status: look for STATUS: VALUE pattern in boot sequences
  const statusMatch = body.match(/STATUS:\s*([A-Z]+)/i)
    || body.match(/status[:\s]+([A-Z]+)/i);
  const rawStatus = statusMatch ? statusMatch[1].toUpperCase() : null;
  const status = rawStatus || inferStatus(filename);

  // Tags: look for tag-like words in all-caps headers or extract key nouns
  const tagCandidates = [];
  const headerWords = body.match(/^#{1,4}\s+(.+)/gm) || [];
  for (const h of headerWords) {
    const words = h.replace(/^#{1,4}\s+/, '').split(/[\s_/\\]+/);
    for (const w of words) {
      if (w.length > 3 && /^[A-Z]/.test(w) && !/^(The|And|For|With|From|Into|This)$/.test(w)) {
        tagCandidates.push(w.replace(/[^a-zA-Z0-9-]/g, ''));
      }
    }
  }
  const tags = [...new Set(tagCandidates)].slice(0, 5);

  // Read time: rough estimate (~200 wpm)
  const wordCount = body.split(/\s+/).length;
  const minutes = Math.max(1, Math.round(wordCount / 200));
  const readTime = `${minutes} min read`;

  // Type: infer from filename or content
  const type = inferType(filename, body);

  return { title, subtitle, date, status, tags, readTime, type };
}

function inferStatus(filename) {
  const lower = filename.toLowerCase();
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return status;
  }
  return 'ACTIVE';
}

function inferType(filename, body) {
  const lower = filename.toLowerCase();
  if (lower.includes('kernel') || lower.includes('soma') || lower.includes('protocol')) return 'kernel_doc';
  if (lower.includes('research') || lower.includes('study') || lower.includes('analysis')) return 'research';
  if (lower.includes('fiction') || lower.includes('story') || lower.includes('narrative')) return 'fiction';
  if (/fiction|story|narrative|she said|he said/i.test(body.slice(0, 500))) return 'fiction';
  return 'kernel_doc';
}

// ─── ID GENERATOR ────────────────────────────────────────────────────────────

function generateId(filename, fm, existingIds) {
  if (fm.id) return fm.id;

  // Try to extract version from filename: geopolitical_kinetics_v2_1 → GEO-2.1
  const base = path.basename(filename, '.md');
  const versionMatch = base.match(/[_-]v?(\d+)[_.](\d+)/i);
  const prefix = base
    .replace(/[_-]v?\d+[_.]?\d*$/i, '')
    .split(/[_-]/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 4);

  const version = versionMatch ? `${versionMatch[1]}.${versionMatch[2]}` : '1.0';
  let id = `${prefix}-${version}`;

  // Deduplicate
  let suffix = 1;
  const original = id;
  while (existingIds.has(id)) {
    id = `${original}-${suffix++}`;
  }

  return id;
}

function buildNameFromFilename(filename) {
  return path.basename(filename, '.md')
    .toUpperCase()
    .replace(/[.\s]/g, '_')
    .replace(/-/g, '_');
}

// ─── FILE WRITER ─────────────────────────────────────────────────────────────

function parseExistingIds(filePath, arrayName) {
  if (!fs.existsSync(filePath)) return new Set();
  const src = fs.readFileSync(filePath, 'utf8');
  const ids = new Set();
  const idRegex = /id:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = idRegex.exec(src)) !== null) ids.add(m[1]);
  return ids;
}

function serialiseArticle(article) {
  const content = article.content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');

  const tags = JSON.stringify(article.tags);

  return `  {
    id: '${article.id}',
    type: '${article.type}',
    date: '${article.date}',
    title: '${article.title.replace(/'/g, "\\'")}',
    subtitle: '${article.subtitle.replace(/'/g, "\\'")}',
    status: '${article.status}',
    readTime: '${article.readTime}',
    tags: ${tags},
    content: \`${content}\`,
  }`;
}

function serialiseBuild(build) {
  return `  { id: '${build.id}', articleId: '${build.articleId}', name: '${build.name}', status: '${build.status}', desc: '${build.desc.replace(/'/g, "\\'")}' }`;
}

function injectIntoArticles(newArticle) {
  if (!fs.existsSync(ARTICLES_PATH)) {
    console.error(`  ✗ articles.js not found at ${ARTICLES_PATH}`);
    return false;
  }

  let src = fs.readFileSync(ARTICLES_PATH, 'utf8');

  // Check for duplicate id
  if (src.includes(`id: '${newArticle.id}'`)) {
    console.log(`  ⚠  Article '${newArticle.id}' already exists — skipping.`);
    return false;
  }

  // Inject before the closing ]; of the articles array
  const insertPoint = src.lastIndexOf('];');
  if (insertPoint === -1) {
    console.error('  ✗ Could not find ]; in articles.js');
    return false;
  }

  // Add trailing comma to last entry if missing
  const before = src.slice(0, insertPoint).trimEnd();
  const afterPatch = before.endsWith(',') ? before : before + ',';

  const injected = `${afterPatch}\n${serialiseArticle(newArticle)},\n${src.slice(insertPoint)}`;
  fs.writeFileSync(ARTICLES_PATH, injected, 'utf8');
  return true;
}

function injectIntoBuildList(newBuild) {
  if (!fs.existsSync(BUILDS_PATH)) {
    console.error(`  ✗ kernelBuilds.js not found at ${BUILDS_PATH}`);
    return false;
  }

  let src = fs.readFileSync(BUILDS_PATH, 'utf8');

  if (src.includes(`id: '${newBuild.id}'`)) {
    console.log(`  ⚠  Build '${newBuild.id}' already exists — skipping.`);
    return false;
  }

  const insertPoint = src.lastIndexOf('];');
  if (insertPoint === -1) {
    console.error('  ✗ Could not find ]; in kernelBuilds.js');
    return false;
  }

  const before = src.slice(0, insertPoint).trimEnd();
  const afterPatch = before.endsWith(',') ? before : before + ',';
  const injected = `${afterPatch}\n${serialiseBuild(newBuild)},\n${src.slice(insertPoint)}`;
  fs.writeFileSync(BUILDS_PATH, injected, 'utf8');
  return true;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

function run() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         KERNEL MARKDOWN LOADER           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('  [DRY RUN — no files will be written]\n');

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`  ✗ Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONTENT_DIR).filter(f => {
    if (!f.endsWith('.md')) return false;
    if (EXCLUDE_FILES.has(f)) {
      console.log(`  ⊘ Skipping (excluded): ${f}`);
      return false;
    }
    return true;
  });
  if (files.length === 0) {
    console.log('  No .md files found in', CONTENT_DIR);
    process.exit(0);
  }

  console.log(`  Scanning: ${CONTENT_DIR}`);
  console.log(`  Found ${files.length} file(s)\n`);

  const existingArticleIds = parseExistingIds(ARTICLES_PATH, 'articles');
  const existingBuildIds   = parseExistingIds(BUILDS_PATH, 'kernelBuilds');
  const allIds = new Set([...existingArticleIds, ...existingBuildIds]);

  let imported = 0;

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    console.log(`  Processing: ${file}`);

    const { fm, body } = parseFrontmatter(raw);
    const inferred = inferFromContent(body, file);

    // Merge: frontmatter wins over inferred
    const title    = fm.title    || inferred.title;
    const subtitle = fm.subtitle || inferred.subtitle;
    const date     = fm.date     || inferred.date;
    const status   = (fm.status  || inferred.status).toUpperCase();
    const tags     = fm.tags     || inferred.tags;
    const readTime = fm.readTime || inferred.readTime;
    const type     = fm.type     || inferred.type;
    const id       = generateId(file, fm, allIds);
    const name     = fm.name || buildNameFromFilename(file);
    const desc     = fm.desc || subtitle || title;

    allIds.add(id);

    const article = { id, type, date, title, subtitle, status, readTime, tags, content: body };
    const build   = { id: fm.buildId || id, articleId: id, name, status, desc };

    console.log(`    id:       ${id}`);
    console.log(`    title:    ${title}`);
    console.log(`    status:   ${status}`);
    console.log(`    type:     ${type}`);
    console.log(`    tags:     ${tags.join(', ')}`);

    if (!DRY_RUN) {
      const aOk = injectIntoArticles(article);
      const bOk = injectIntoBuildList(build);
      if (aOk || bOk) {
        imported++;
        console.log(`    ✓ Integrated into data layer\n`);
      } else {
        console.log(`    — No changes made\n`);
      }
    } else {
      console.log(`    [dry run — would inject into articles.js + kernelBuilds.js]\n`);
      imported++;
    }
  }

  console.log(`\n  Done. ${imported} kernel(s) imported.\n`);
}

run();

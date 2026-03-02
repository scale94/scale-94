#!/usr/bin/env node
/**
 * import-kernel.js
 * Scans a directory for .md files and integrates them into
 * src/terminal/data/articles.js and src/terminal/data/kernelBuilds.js
 *
 * Usage:
 * node import-kernel.js                        # scan ./content/
 * node import-kernel.js ./my-kernels/          # scan custom dir
 * node import-kernel.js ./my-kernels/ --dry    # preview only, no writes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONTENT_DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'content');

const DRY_RUN = process.argv.includes('--dry');
const ARTICLES_PATH = path.join(__dirname, 'src/terminal/data/articles.js');
const BUILDS_PATH = path.join(__dirname, 'src/terminal/data/kernelBuilds.js');

// ─── EXCLUSION LIST ───────────────────────────────────────────────────────────
const EXCLUDE_FILES = new Set([
  'Soft_Climb_Sequence.md',
]);

const STATUS_KEYWORDS = {
  ACTIVE: ['active', 'online', 'running'],
  ARCHIVED: ['archived', 'archive', 'legacy', 'historical'],
  FROZEN: ['frozen', 'locked', 'final'],
  PROPOSED: ['proposed', 'draft', 'wip'],
  PLATINUM: ['platinum', 'apex', 'gated'],
  STABLE: ['stable'],
  RUNNING: ['running'],
  LEGACY: ['legacy'],
  EMERGENT: ['emergent', 'new', 'rising'],
};

// ─── FRONTMATTER PARSER ──────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return { fm: {}, body: raw };

  const fmLines = fmMatch[1].split('\n');
  const fm = {};

  for (const line of fmLines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();

    if (val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
    }

    fm[key] = val;
  }

  return { fm, body: fmMatch[2] };
}

// ─── CONTENT EXTRACTOR ───────────────────────────────────────────────────────
function inferFromContent(body, filename) {
  const lines = body.split('\n');

  const titleLine = lines.find(l => /^#{1,2}\s/.test(l));
  const title = titleLine
    ? titleLine.replace(/^#{1,2}\s+/, '').trim().toUpperCase()
    : filename.replace(/[-_]/g, ' ').replace(/\.md$/i, '').toUpperCase();

  const subtitleLine = lines.find(l =>
    /^#{2,3}\s/.test(l) && l !== titleLine
  ) || lines.find(l => /^>\s/.test(l));
  const subtitle = subtitleLine
    ? subtitleLine.replace(/^#{2,3}\s+/, '').replace(/^>\s*\*?/, '').replace(/\*$/, '').trim()
    : '';

  const dateMatch = body.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

  const statusMatch = body.match(/^STATUS:\s*([A-Z]+)/im)
    || body.match(/^status[:\s]+([A-Z]+)/im);
  
  let status = null;
  if (statusMatch) {
    const candidate = statusMatch[1].toUpperCase();
    if (STATUS_KEYWORDS[candidate] || Object.values(STATUS_KEYWORDS).flat().includes(candidate.toLowerCase())) {
      status = candidate;
    }
  }
  
  status = status || inferStatus(filename);

  const tagCandidates = [];
  const headerWords = body.match(/^#{1,4}\s+(.+)/gm) || [];
  for (const h of headerWords) {
    const words = h.replace(/^#{1,4}\s+/, '').split(/[\s_/\.\\]+/);
    for (const w of words) {
      if (w.length > 3 && /^[A-Z]/.test(w) && !/^(The|And|For|With|From|Into|This|Violet|Kernel|V\d+)$/i.test(w)) {
        tagCandidates.push(w.replace(/[^a-zA-Z0-9-]/g, ''));
      }
    }
  }
  const tags = [...new Set(tagCandidates)].filter(t => t.length > 1).slice(0, 5);

  const wordCount = body.split(/\s+/).length;
  const minutes = Math.max(1, Math.round(wordCount / 200));
  const readTime = `${minutes} min read`;

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

  const base = path.basename(filename, '.md');
  // Updated regex to catch versions even at the start of the string or with dots
  const versionMatch = base.match(/(?:^|[._-])v?(\d+)[_.](\d+)/i);
  
  const parts = base
    .replace(/[._-]v?\d+[._]\d*$/i, '')
    .split(/[._-]/)
    .filter(Boolean);

  let prefix = '';
  if (parts.length === 1) {
    prefix = parts[0].slice(0, 4).toUpperCase();
  } else {
    prefix = parts.map(w => w[0].toUpperCase()).join('').slice(0, 5);
  }

  const version = versionMatch ? `${versionMatch[1]}.${versionMatch[2]}` : '1.0';
  let id = `${prefix}-${version}`;

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

  return `  {
    id: '${article.id}',
    type: '${article.type}',
    date: '${article.date}',
    title: ${JSON.stringify(article.title)},
    subtitle: ${JSON.stringify(article.subtitle)},
    status: '${article.status}',
    readTime: '${article.readTime}',
    tags: ${JSON.stringify(article.tags)},
    content: \`${content}\`,
  }`;
}

function serialiseBuild(build) {
  return `  { id: '${build.id}', articleId: '${build.articleId}', name: ${JSON.stringify(build.name)}, status: '${build.status}', desc: ${JSON.stringify(build.desc)} }`;
}

function batchInject(filePath, items, serialiseFn) {
  if (!items.length) return false;
  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ Data file not found at ${filePath}`);
    return false;
  }

  let src = fs.readFileSync(filePath, 'utf8');
  const insertPoint = src.lastIndexOf('];');
  if (insertPoint === -1) {
    console.error(`  ✗ Could not find ]; in ${filePath}`);
    return false;
  }

  const before = src.slice(0, insertPoint).trimEnd();
  const afterPatch = before.endsWith(',') ? before : before + ',';
  
  const payload = items.map(serialiseFn).join(',\n');
  const injected = `${afterPatch}\n${payload},\n${src.slice(insertPoint)}`;
  
  fs.writeFileSync(filePath, injected, 'utf8');
  return true;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
function run() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        KERNEL MARKDOWN LOADER          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('  [DRY RUN — no files will be written]\n');

  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`  ✗ Content directory not found: ${CONTENT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONTENT_DIR).filter(f => {
    if (!f.endsWith('.md')) return false;
    if (EXCLUDE_FILES.has(f)) return false;
    return true;
  });
  
  if (files.length === 0) {
    console.log('  No .md files found in', CONTENT_DIR);
    process.exit(0);
  }

  const existingArticleIds = parseExistingIds(ARTICLES_PATH, 'articles');
  const existingBuildIds   = parseExistingIds(BUILDS_PATH, 'kernelBuilds');
  const allIds = new Set([...existingArticleIds, ...existingBuildIds]);

  let processed = 0;
  const pendingArticles = [];
  const pendingBuilds = [];

  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    const inferred = inferFromContent(body, file);

    const title    = fm.title    || inferred.title;
    const subtitle = fm.subtitle || inferred.subtitle;
    const date     = fm.date     || inferred.date;
    const status   = (fm.status  || inferred.status).toUpperCase();
    
    let tags = fm.tags || inferred.tags || [];
    if (typeof tags === 'string') {
      tags = tags.split(',').map(t => t.trim());
    } else if (!Array.isArray(tags)) {
      tags = [tags];
    }
    tags = tags.filter(Boolean);

    const readTime = fm.readTime || inferred.readTime;
    const type     = fm.type     || inferred.type;
    const id       = generateId(file, fm, allIds);
    const name     = fm.name || buildNameFromFilename(file);
    const desc     = fm.desc || subtitle || title;

    allIds.add(id);

    const article = { id, type, date, title, subtitle, status, readTime, tags, content: body };
    const build   = { id: fm.buildId || id, articleId: id, name, status, desc };

    console.log(`  Processing: ${file}`);
    console.log(`    id:       ${id}`);
    console.log(`    title:    ${title}`);
    console.log(`    status:   ${status}`);
    console.log(`    tags:     ${tags.length ? tags.join(', ') : '(none)'}`);

    processed++;
    if (!DRY_RUN) {
      pendingArticles.push(article);
      pendingBuilds.push(build);
    }
  }

  if (!DRY_RUN && pendingArticles.length > 0) {
    batchInject(ARTICLES_PATH, pendingArticles, serialiseArticle);
    batchInject(BUILDS_PATH, pendingBuilds, serialiseBuild);
    console.log(`\n  ✓ Batch integrated ${pendingArticles.length} new kernel(s) into data layer.`);
  }

  console.log(`\n  Done. ${processed} kernel(s) processed.\n`);
}

run();
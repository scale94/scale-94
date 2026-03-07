/**
 * substrate-repair.cjs
 *
 * Definitive data substrate repair for content/soma_kernel/*.md
 *
 * Pass 1 — Deduplication
 *   Group all files by canonical ID (same logic as loadArticles.js filenameToId).
 *   Within each duplicate group, score each file for canonicality; keep the winner
 *   and permanently delete the rest.
 *
 * Pass 2 — Frontmatter standardisation
 *   For every surviving file, rebuild the frontmatter block from scratch using
 *   exactly 5 fields: id, type, date, status, title.
 *   Any lines inside the old frontmatter block that are NOT valid key:value YAML
 *   (leaked lore, bullet points, table rows, etc.) are rescued and prepended to
 *   the body so zero content is lost.
 *   All fields beyond the 5 standard ones are dropped.
 *
 * Body is NEVER modified — only the block between the two --- delimiters changes.
 */

const fs   = require('fs');
const path = require('path');

const DIR   = path.resolve(__dirname, '../content/soma_kernel');
const TODAY = '2026-03-07';

// ── Same ID derivation as loadArticles.js ────────────────────────────────────
function filenameToId(basename) {
  return basename
    .toUpperCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[()[\]]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function filenameToTitle(basename) {
  return basename.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

// ── Canonicality score — higher wins the dedup ───────────────────────────────
function scoreFilename(filename) {
  const base = filename.replace(/\.md$/, '');
  const derived = filenameToId(base);
  let score = 0;
  if (base === derived)                            score += 100; // perfect canonical form
  if (base === base.toUpperCase())                 score +=  20; // all uppercase
  if (!base.includes(' '))                         score +=  10; // no spaces
  if (!base.includes('_'))                         score +=   5; // no underscores
  if (!base.includes('(') && !base.includes(')')) score +=   5; // no parens
  score -= base.length * 0.01;                                   // prefer shorter
  return score;
}

// ── Line-by-line frontmatter parser ──────────────────────────────────────────
// Finds the opening and closing ---, parses ONLY valid key: value lines,
// and captures any invalid lines as leakedLines (lore that shouldn't be there).
function parseFile(raw) {
  const clean = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n');

  // Locate opening ---
  let openIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    if (lines[i].trim() === '---') { openIdx = i; break; }
  }

  if (openIdx === -1) {
    return { hasFm: false, fmFields: {}, leakedLines: [], bodyLines: lines };
  }

  // Locate closing ---
  let closeIdx = -1;
  for (let i = openIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { closeIdx = i; break; }
  }

  if (closeIdx === -1) {
    // Unclosed frontmatter — treat whole file as body
    return { hasFm: false, fmFields: {}, leakedLines: [], bodyLines: lines };
  }

  const fmLines   = lines.slice(openIdx + 1, closeIdx);
  const bodyLines = lines.slice(closeIdx + 1);

  const fmFields    = {};
  const leakedLines = [];

  for (const line of fmLines) {
    if (line.trim() === '') continue; // skip blank lines inside fm block
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (m) {
      const key   = m[1].toLowerCase();
      const value = m[2].trim().replace(/^["']|["']$/g, ''); // strip surrounding quotes
      fmFields[key] = value;
    } else {
      leakedLines.push(line); // non-YAML content — rescue to body
    }
  }

  return { hasFm: true, fmFields, leakedLines, bodyLines };
}

// ── Build the standard 5-field frontmatter block ─────────────────────────────
function buildFrontmatter(id, title, date) {
  // Escape double quotes inside title
  const safeTitle = title.replace(/"/g, "'");
  return [
    '---',
    `id: ${id}`,
    `type: "kernel_doc"`,
    `date: "${date}"`,
    `status: "ACTIVE"`,
    `title: "${safeTitle}"`,
    '---',
  ].join('\n');
}

// ── Assemble final file content ───────────────────────────────────────────────
function assembleFile(fm, leakedLines, bodyLines) {
  // Combine leaked lore + original body, stripping leading blank lines
  const combined = [...leakedLines, ...bodyLines]
    .join('\n')
    .replace(/^\n+/, '')  // strip leading blanks
    .trimEnd();

  if (!combined) return fm + '\n';
  return fm + '\n\n' + combined + '\n';
}

// ─────────────────────────────────────────────────────────────────────────────
const allFiles = fs.readdirSync(DIR).filter(f => f.endsWith('.md')).sort();

// ── Pass 1: Group by canonical ID ─────────────────────────────────────────────
const groups = new Map();
for (const f of allFiles) {
  const id = filenameToId(f.replace(/\.md$/, ''));
  if (!groups.has(id)) groups.set(id, []);
  groups.get(id).push(f);
}

const toDelete        = new Set();
const duplicateReport = [];

for (const [canonId, files] of groups) {
  if (files.length <= 1) continue;

  const scored = files
    .map(f => ({ file: f, score: scoreFilename(f) }))
    .sort((a, b) => b.score - a.score);

  const keep = scored[0].file;
  const drop = scored.slice(1).map(s => s.file);

  drop.forEach(f => toDelete.add(f));
  duplicateReport.push({ canonId, keep, drop });
}

// ── Pass 2: Repair all surviving files ────────────────────────────────────────
const stats = {
  repaired:  [],
  deleted:   [],
  errors:    [],
  leaked:    [],   // files where lore was found inside the frontmatter block
  extraKeys: [],   // files where extra metadata fields were stripped
  noFm:      [],   // files that had no frontmatter at all (freshly injected)
};

for (const filename of allFiles) {
  const filepath = path.join(DIR, filename);

  // ── Delete duplicates ──────────────────────────────────────────────────────
  if (toDelete.has(filename)) {
    try {
      fs.unlinkSync(filepath);
      stats.deleted.push(filename);
    } catch (err) {
      stats.errors.push({ file: filename, error: 'DELETE FAILED: ' + err.message });
    }
    continue;
  }

  // ── Repair surviving file ──────────────────────────────────────────────────
  const basename = filename.replace(/\.md$/, '');
  const canonId  = filenameToId(basename);

  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    const { hasFm, fmFields, leakedLines, bodyLines } = parseFile(raw);

    // Determine the 5 final field values
    const finalId    = (fmFields.id    || canonId).trim();
    const finalTitle = (fmFields.title || filenameToTitle(basename)).trim();
    const finalDate  = (fmFields.date  && fmFields.date.trim()) ? fmFields.date.trim() : TODAY;

    // Detect extra keys beyond the 5 standard
    const allowed  = new Set(['id', 'type', 'date', 'status', 'title']);
    const extraKeys = Object.keys(fmFields).filter(k => !allowed.has(k));

    const fm      = buildFrontmatter(finalId, finalTitle, finalDate);
    const content = assembleFile(fm, leakedLines, bodyLines);

    fs.writeFileSync(filepath, content, 'utf8');
    stats.repaired.push(filename);

    if (!hasFm)             stats.noFm.push(filename);
    if (leakedLines.length) stats.leaked.push({ file: filename, count: leakedLines.length, lines: leakedLines });
    if (extraKeys.length)   stats.extraKeys.push({ file: filename, keys: extraKeys });

  } catch (err) {
    stats.errors.push({ file: filename, error: err.message });
  }
}

// ── Verification pass ─────────────────────────────────────────────────────────
const survivors = fs.readdirSync(DIR).filter(f => f.endsWith('.md'));
let verifyFail = 0;

for (const f of survivors) {
  const raw   = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  if (lines[0].trim() !== '---') { verifyFail++; console.error('VERIFY FAIL (no opening ---):', f); continue; }

  let close = -1;
  for (let i = 1; i < lines.length; i++) { if (lines[i].trim() === '---') { close = i; break; } }
  if (close === -1) { verifyFail++; console.error('VERIFY FAIL (unclosed fm):', f); continue; }

  const fmBlock = lines.slice(1, close);
  const keys    = fmBlock.filter(l => l.trim()).map(l => l.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/)?.[1]).filter(Boolean);
  const body    = lines.slice(close + 1).join('\n').trim();

  const required = ['id', 'type', 'date', 'status', 'title'];
  for (const req of required) {
    if (!keys.includes(req)) { verifyFail++; console.error(`VERIFY FAIL (missing field '${req}'):`, f); }
  }
  if (!body) { verifyFail++; console.error('VERIFY FAIL (empty body):', f); }
}

// ── Report ─────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  DATA SUBSTRATE REPAIR — COMPLETE                        ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');
console.log(`  Input  file count : ${allFiles.length}`);
console.log(`  Output file count : ${survivors.length}`);
console.log(`  ✅ Repaired        : ${stats.repaired.length}`);
console.log(`  🗑️  Deleted (dups)  : ${stats.deleted.length}`);
console.log(`  ❌ Errors          : ${stats.errors.length}`);
console.log(`  🔧 Leaked lore     : ${stats.leaked.length} files`);
console.log(`  ✂️  Extra keys cut  : ${stats.extraKeys.length} files`);
console.log(`  📄 Fresh inject    : ${stats.noFm.length} files`);
console.log(`  🔍 Verify failures : ${verifyFail}`);

if (duplicateReport.length) {
  console.log('\n── DUPLICATES RESOLVED ─────────────────────────────────────────');
  for (const { canonId, keep, drop } of duplicateReport) {
    console.log(`\n  [${canonId}]`);
    console.log(`    KEPT    → ${keep}`);
    drop.forEach(f => console.log(`    DELETED → ${f}`));
  }
}

if (stats.leaked.length) {
  console.log('\n── LORE RESCUED FROM FRONTMATTER ────────────────────────────────');
  for (const { file, count, lines } of stats.leaked) {
    console.log(`\n  ${file}  (${count} line(s))`);
    lines.forEach(l => console.log(`    > ${l.slice(0, 100)}`));
  }
}

if (stats.extraKeys.length) {
  console.log('\n── EXTRA METADATA FIELDS STRIPPED ───────────────────────────────');
  for (const { file, keys } of stats.extraKeys) {
    console.log(`  ${file}: [${keys.join(', ')}]`);
  }
}

if (stats.errors.length) {
  console.log('\n── ERRORS ────────────────────────────────────────────────────────');
  stats.errors.forEach(e => console.log(`  ❌ ${e.file}: ${e.error}`));
}

if (verifyFail === 0) {
  console.log('\n  ✅ ALL files pass verification — every file has valid 5-field');
  console.log('     frontmatter and a non-empty body.');
}

console.log('');

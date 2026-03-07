/**
 * repair-frontmatter.js
 *
 * Standardises frontmatter for every .md file in content/soma_kernel/.
 * Uses the EXACT same split logic as loadArticles.js so body content
 * that contains '---' horizontal rules is never corrupted.
 *
 * Rules:
 *   - Files WITHOUT frontmatter → inject full block (id, type, title, date, status)
 *   - Files WITH frontmatter    → preserve existing key order + values;
 *                                  add/overwrite: type=kernel_doc, status=ACTIVE,
 *                                  id (if absent), date (if absent or empty)
 *   - Body is NEVER touched — only the block between the two --- delimiters changes.
 *   - Empty bodies are flagged immediately; file is NOT written if body is empty.
 */

const fs   = require('fs');
const path = require('path');

const DIR   = path.resolve(__dirname, '../content/soma_kernel');
const TODAY = '2026-03-07';

// ── Same ID derivation as loadArticles.js ──────────────────────────────────
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
  return basename.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').toUpperCase().trim();
}

// ── Same frontmatter splitter as loadArticles.js ───────────────────────────
function splitFrontmatter(raw) {
  const clean = raw.replace(/^\uFEFF/, '');          // strip UTF-8 BOM
  const parts = clean.split(/^---\s*$/m);
  if (parts.length < 3) return { hasFm: false, fmRaw: '', body: clean };
  // Rejoin parts[2..] with '---\n' to preserve any --- horizontal rules in body
  const body = parts.slice(2).join('---\n').replace(/^\r?\n/, '');
  return { hasFm: true, fmRaw: parts[1], body };
}

// ── Parse existing frontmatter preserving raw values ──────────────────────
function parseFmLines(fmRaw) {
  const order = [];
  const map   = new Map();   // key → raw value string (after the colon)

  for (const line of fmRaw.split('\n')) {
    if (!line.trim()) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    if (!key || key.startsWith('#') || key.startsWith('-')) continue;
    const val = line.slice(colonIdx + 1);  // keep leading space so value is correct
    map.set(key, val);
    if (!order.includes(key)) order.push(key);
  }
  return { order, map };
}

// ── Main ───────────────────────────────────────────────────────────────────
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md')).sort();

const injected    = [];
const updated     = [];
const emptyBodies = [];
const errors      = [];

for (const filename of files) {
  const filepath = path.join(DIR, filename);
  const basename = filename.replace(/\.md$/, '');
  const derivedId    = filenameToId(basename);
  const derivedTitle = filenameToTitle(basename);

  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    const { hasFm, fmRaw, body } = splitFrontmatter(raw);

    // ── EMPTY BODY GUARD ────────────────────────────────────────────────────
    if (!body || body.trim() === '') {
      emptyBodies.push(filename);
      // Do not write — alert only
      continue;
    }

    let newContent;

    if (!hasFm) {
      // ── INJECT: no frontmatter at all ──────────────────────────────────
      const fm = [
        '---',
        `id: ${derivedId}`,
        `type: kernel_doc`,
        `title: ${derivedTitle}`,
        `date: '${TODAY}'`,
        `status: ACTIVE`,
        '---',
        '',
      ].join('\n');
      newContent = fm + body;
      injected.push(filename);

    } else {
      // ── UPDATE: frontmatter present — preserve + patch required fields ──
      const { order, map } = parseFmLines(fmRaw);

      // Ensure id exists (prepend so it's first if missing)
      if (!map.has('id')) {
        order.unshift('id');
        map.set('id', ` ${derivedId}`);
      }

      // Always enforce type = kernel_doc
      if (!map.has('type')) order.push('type');
      map.set('type', ' kernel_doc');

      // Set date only if absent or blank
      const existingDate = map.has('date') ? map.get('date').trim() : '';
      if (!existingDate) {
        if (!map.has('date')) order.push('date');
        map.set('date', ` '${TODAY}'`);
      }

      // Always enforce status = ACTIVE
      if (!map.has('status')) order.push('status');
      map.set('status', ' ACTIVE');

      const newFm = order.map(k => `${k}:${map.get(k)}`).join('\n');
      newContent = `---\n${newFm}\n---\n${body}`;
      updated.push(filename);
    }

    fs.writeFileSync(filepath, newContent, 'utf8');

  } catch (err) {
    errors.push({ file: filename, error: err.message });
  }
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║  FRONTMATTER REPAIR COMPLETE                     ║');
console.log('╚══════════════════════════════════════════════════╝\n');
console.log(`  Total files scanned : ${files.length}`);
console.log(`  ✅ Injected (no fm)  : ${injected.length}`);
console.log(`  ✅ Updated  (has fm) : ${updated.length}`);
console.log(`  ❌ Errors            : ${errors.length}`);
console.log(`  ⚠️  Empty bodies      : ${emptyBodies.length}`);

if (errors.length) {
  console.log('\n── ERRORS ──────────────────────────────────────────');
  errors.forEach(e => console.log(`  ❌ ${e.file}\n     ${e.error}`));
}

if (emptyBodies.length) {
  console.log('\n── ⚠️  EMPTY BODIES — PULL THESE FROM F: DRIVE ────');
  emptyBodies.forEach(f => console.log(`  ⚠️  ${f}`));
  console.log('\n  These files were NOT modified. Restore body text');
  console.log('  from F: drive then re-run this script.');
} else {
  console.log('\n  ✅ All bodies intact — no content was lost.');
}

console.log('');

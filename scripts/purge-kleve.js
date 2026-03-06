#!/usr/bin/env node
// purge-kleve.js — one-shot geographic purge: Kleve → Sorbe
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'content', 'soma_kernel');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
let totalFiles = 0;
let totalHits  = 0;

for (const f of files) {
  const fp   = path.join(dir, f);
  const orig = fs.readFileSync(fp, 'utf8');

  const updated = orig
    .replace(/KLEVE/g, 'SORBE')
    .replace(/Kleve/g, 'Sorbe')
    .replace(/kleve/g, 'sorbe');

  if (updated !== orig) {
    fs.writeFileSync(fp, updated, 'utf8');
    const hits = (orig.match(/kleve/gi) || []).length;
    totalHits += hits;
    totalFiles++;
    console.log(`  Purged (${hits}x): ${f}`);
  }
}

console.log(`\n  Done. ${totalHits} replacement(s) across ${totalFiles} file(s).`);

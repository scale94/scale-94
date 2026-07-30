// ── Pure helpers for the `run` command — no React deps ────────────────────────
// Extracted from App.jsx so the main file doesn't carry these 50 lines.

export function formatKernelHelp(entry) {
  const lines = [
    `  ┌─ ${entry.label}`,
    `  │  ID:      ${entry.id}`,
    `  │  Aliases: ${(entry.aliases ?? []).join(', ')}`,
  ];
  if (entry.params?.length) {
    lines.push(`  │  Parameters:`);
    entry.params.forEach((p, i) => {
      const flags = Object.entries(entry.argMap ?? {})
        .filter(([, idx]) => idx === i)
        .map(([k]) => `--${k}`)
        .join(', ');
      lines.push(`  │    [${i + 1}] ${p.name}  (default: ${p.default})${flags ? `  flags: ${flags}` : ''}`);
      lines.push(`  │        ${p.desc}`);
    });
    const examplePos = entry.params.map(p => p.default).join(' ');
    const firstFlag  = Object.keys(entry.argMap ?? {})[0] ?? 'param';
    lines.push(`  │  Positional: run ${entry.aliases?.[0] ?? entry.id} ${examplePos}`);
    lines.push(`  │  Named flag: run ${entry.aliases?.[0] ?? entry.id} --${firstFlag} <value>`);
  } else {
    lines.push(`  │  Params: none — static boot diagnostic`);
    lines.push(`  │  Usage:  run ${entry.aliases?.[0] ?? entry.id}`);
  }
  lines.push(`  └──────────────────────────────────────────`);
  return lines;
}

export function formatRunHelp(registry) {
  const entries = Object.values(registry);
  const lines = [
    `  RUN_MANIFEST :: ${entries.length} WASM kernel(s) registered`,
    `  ──────────────────────────────────────────────────────────`,
  ];
  for (const e of entries) {
    const paramStr = e.params?.length ? ' ' + e.params.map(p => `[${p.name}]`).join(' ') : '';
    lines.push(`  · run ${e.aliases?.[0] ?? e.id}${paramStr}`);
    lines.push(`      ${e.label}`);
    if (e.params?.length) {
      lines.push(`      defaults: ${e.params.map(p => `${p.name}=${p.default}`).join('  ')}`);
    }
  }
  lines.push(`  ──────────────────────────────────────────────────────────`);
  lines.push(`  Per-kernel help:  run [alias] --help`);
  lines.push(`  Positional args:  run climate 450 3.0 0.5`);
  lines.push(`  Named flags:      run climate --carbon 450 --drag 3.0`);
  return lines;
}

// Stable reference — module-level so suggestion dropdown never re-creates it.
export const CMD_MANIFEST = [
  { name: 'load',         desc: 'open a kernel module  e.g. load soma' },
  { name: 'run',          desc: 'execute WASM kernel    e.g. run climate' },
  { name: 'list',         desc: 'show all modules' },
  { name: 'search',       desc: 'filter kernel index    e.g. search quantum' },
  { name: 'help',         desc: 'system command reference' },
  { name: 'clear',        desc: 'clear system log' },
  { name: 'tags',         desc: 'open tag cloud' },
  { name: 'thesis',       desc: 'load architect thesis' },
  { name: 'home',         desc: 'navigate to /kernel' },
  { name: 'scent',        desc: 'navigate to /scent' },
  { name: 'transmission', desc: 'navigate to /transmission' },
  { name: 'manifesto',    desc: 'navigate to /manifesto' },
  { name: 'surveillance',  desc: 'navigate to /surveillance' },
  { name: 'bsky',          desc: 'navigate to /bsky' },
  { name: 'privacy',       desc: 'navigate to /privacy' },
  { name: 'cryptography',  desc: 'navigate to /cryptography — PQC kernel' },
  { name: 'verify',        desc: 'submit classified challenge  e.g. verify ABCDEF' },
  { name: 'keygen',        desc: 'generate ML-KEM-768 keypair for encrypt/decrypt' },
  { name: 'seal',          desc: 'encrypt message with ML-KEM-768 + AES-256-GCM  e.g. seal hello world' },
  { name: 'open',          desc: 'decrypt sealed blob  e.g. open <hex>' },
  { name: 'breach',        desc: 'launch Breach Protocol minigame' },
  { name: 'relic',         desc: 'trigger Relic malfunction diagnostics' },
];

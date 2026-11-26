// @vitest-environment node
// The Content-Security-Policy in vercel.json. These tests catch drift; whether the
// site actually runs under the policy is checked in real Chrome by
// scripts/cspCheck.mjs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const policyHeaders = vercel.headers.flatMap((rule) => rule.headers
  .filter((h) => h.key.toLowerCase() === 'content-security-policy')
  .map((h) => ({ source: rule.source, value: h.value })));

const directives = Object.fromEntries((policyHeaders[0]?.value ?? '')
  .split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0])
  .map(([name, ...values]) => [name, values]));

const allows = (directive, url) => {
  const { protocol, hostname } = new URL(url);
  return (directives[directive] ?? []).some((source) => {
    const m = source.match(/^https:\/\/(\*\.)?(.+)$/);
    if (!m || protocol !== 'https:') return false;
    return m[1] ? hostname.endsWith(`.${m[2]}`) : hostname === m[2];
  });
};

// The HTML parser normalises newlines before the browser hashes a script.
const inlineScriptHashes = [...readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n')
  .matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);

describe('Content-Security-Policy', () => {
  it('is set once, for every path', () => {
    expect(policyHeaders.map((h) => h.source)).toEqual(['/(.*)']);
  });

  it.each([
    ['default-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['frame-src', ["'none'"]],
    ['form-action', ["'self'"]],
  ])('locks down %s', (name, expected) => {
    expect(directives[name]).toEqual(expected);
  });

  it('lets scripts run only from this site, the two inline hashes and WASM', () => {
    expect(inlineScriptHashes).toHaveLength(2);
    expect([...directives['script-src']].sort())
      .toEqual(["'self'", "'wasm-unsafe-eval'", ...inlineScriptHashes].sort());
  });

  // The hashes above cover LF bytes, as Vercel builds them. A CRLF checkout on
  // Windows would make a local build whose scripts the policy blocks.
  it('has git check out index.html with LF endings', () => {
    expect(execFileSync('git', ['check-attr', 'eol', '--', 'index.html'], { encoding: 'utf8' }).trim())
      .toBe('index.html: eol: lf');
  });

  it('uses no wildcard or bare-scheme source for anything that can fetch or run', () => {
    for (const name of ['default-src', 'script-src', 'connect-src', 'img-src', 'style-src', 'font-src']) {
      expect(directives[name], name).toBeDefined();
      expect(directives[name].filter((s) => /^(\*|https?:|wss?:)$/.test(s)), name).toEqual([]);
    }
    expect(directives['connect-src']).not.toContain('data:');
  });

  it.each([
    'src/terminal/ledger/apiIngest.js',
    'src/terminal/data/EcoDataFeed.js',
    'src/terminal/views/BskyTab.jsx',
    'src/terminal/lib/inverseEngine.js',
  ])('allows every host that %s fetches', (file) => {
    // Links the visitor clicks are not fetches; take only the API hosts.
    const urls = [...readFileSync(file, 'utf8').matchAll(
      /['"`](https:\/\/(?:public\.api\.|api\.|data-api\.|air-quality-api\.|waterservices\.|discodata\.|data\.giss\.|raw\.)[^'"`\s]+)/g)]
      .map((m) => m[1].split('${')[0]);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((u) => !allows('connect-src', u))).toEqual([]);
  });

  it.each([
    'https://a.basemaps.cartocdn.com/dark_all/1/0/0.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    'https://cdn.bsky.app/img/feed_thumbnail/plain/x/y@jpeg',
  ])('allows the image %s', (url) => {
    expect(allows('img-src', url)).toBe(true);
  });

  it('no longer lets the browser reach GraphTracks', () => {
    expect(allows('connect-src', 'https://api.graphtracks.com/v1')).toBe(false);
  });
});

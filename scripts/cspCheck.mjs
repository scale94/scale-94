// cspCheck.mjs — runs the production build in real headless Chrome under the exact
// headers vercel.json sends, and fails on any Content-Security-Policy violation.
// jsdom enforces no CSP, so this is the only place a missing source shows up.
//
//   npm run build && node scripts/cspCheck.mjs [distDir]
//
// It opens every tab, runs a WASM kernel from the terminal, compiles WebGL1 and
// WebGL2 shaders, and requests every live feed and image host from inside the
// page. Feeds are contacted for real. /api/* is stubbed. It first breaks the
// policy on purpose, so a silent detector cannot pass.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { launch } from './cdp.mjs';

const dist = resolve(process.argv[2] ?? 'dist');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const globalHeaders = Object.fromEntries(JSON.parse(readFileSync('vercel.json', 'utf8'))
  .headers.find((rule) => rule.source === '/(.*)').headers.map((h) => [h.key, h.value]));
if (!globalHeaders['Content-Security-Policy']) throw new Error('vercel.json has no CSP');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/api/')) {
    res.writeHead(404, { ...globalHeaders, 'Content-Type': 'application/json' });
    return res.end('{}');
  }
  let file = join(dist, path);
  if (!file.startsWith(dist + sep)) file = join(dist, 'index.html');
  let body;
  try {
    body = await readFile(file);
  } catch {
    file = join(dist, 'index.html'); // the SPA rewrite
    body = await readFile(file);
  }
  res.writeHead(200, { ...globalHeaders, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://localhost:${server.address().port}/`;

const page = await launch({ url, width: 1280, height: 800 });
const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures.push(label);
};
const violations = () => page.eval('window.__csp.splice(0)');

try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      window.__csp.push(e.effectiveDirective + ' blocked ' + (e.blockedURI || 'inline')));
  ` });
  await page.goto(url);
  await page.waitFor(`document.querySelector('nav button[aria-label="Kernel"]') !== null`,
    { timeoutMs: 90000, label: 'boot sequence to finish' });
  await sleep(6000);
  check(true, 'app boots');

  // ── The detector must see a deliberate breach ──────────────────────────────
  const atBoot = await violations();
  await page.eval(`(async () => {
    const s = document.createElement('script'); s.textContent = 'window.__ran = 1';
    document.body.appendChild(s);
    await fetch('https://example.com/').catch(() => {});
    await new Promise(r => setTimeout(r, 500));
  })()`, { awaitPromise: true });
  const control = await violations();
  check(control.some((v) => v.startsWith('script-src')) && control.some((v) => v.startsWith('connect-src')),
    `control: a breach is reported (${control.length} seen)`);
  check(await page.eval('window.__ran === undefined'), 'control: an unlisted inline script does not run');
  check(atBoot.length === 0, `no violations during boot ${JSON.stringify(atBoot)}`);

  check(await page.eval('navigator.serviceWorker.getRegistration().then(Boolean)', { awaitPromise: true }),
    'inline script ran: service worker registered');

  // ── WebGL1 and WebGL2 ──────────────────────────────────────────────────────
  for (const [kind, src] of [
    ['webgl', 'void main(){gl_FragColor=vec4(1.);}'],
    ['webgl2', '#version 300 es\nprecision highp float;out vec4 o;void main(){o=vec4(1.);}'],
  ]) {
    check(await page.eval(`(() => {
      const gl = document.createElement('canvas').getContext('${kind}');
      if (!gl) return false;
      const sh = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(sh, ${JSON.stringify(src)}); gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS);
    })()`), `${kind} shader compiles`);
  }

  // ── Every tab ──────────────────────────────────────────────────────────────
  const tabs = ['Kernel', 'BSKY', 'Accretion', 'Transmission', 'Scent', 'Sol', 'Surveillance',
    'Cryptography', 'Chaos', 'Ecocide', 'Ledger', 'Lunar'];
  for (const tab of tabs) {
    await page.eval(`document.querySelector('nav button[aria-label="${tab}"]').click()`);
    await sleep(5000);
    const seen = await violations();
    const canvases = await page.eval('document.querySelectorAll("canvas").length');
    check(seen.length === 0, `/${tab.toUpperCase()} (${canvases} canvas) ${seen.length ? JSON.stringify([...new Set(seen)]) : ''}`);
  }

  // ── WASM through the terminal ──────────────────────────────────────────────
  await page.eval(`document.querySelector('nav button[aria-label="Kernel"]').click()`);
  await page.waitFor(`document.querySelector('input[placeholder="enter command…"]') !== null`);
  await page.eval(`document.querySelector('input[placeholder="enter command…"]').focus()`);
  await page.send('Input.insertText', { text: 'run fade' });
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: type === 'keyDown' ? '\r' : undefined });
  }
  let ran = true;
  try {
    await page.waitFor('document.body.innerText.includes("LINDBLAD_FADE")', { timeoutMs: 45000 });
  } catch { ran = false; }
  const wasmSeen = await violations();
  check(ran && wasmSeen.length === 0, `WASM instantiates and runs a kernel ${JSON.stringify(wasmSeen)}`);

  // ── Live feeds and image hosts, redirects included ─────────────────────────
  // A CORS or HTTP error is not a CSP failure; only a violation event counts.
  const feeds = [
    'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=scale94.com',
    'https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=river&limit=1',
    'https://api.github.com/repos/bluesky-social/atproto/commits?per_page=1',
    'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv',
    'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01646500&parameterCd=00060',
    'https://discodata.eea.europa.eu/sql?query=SELECT%201%20AS%20a',
    'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=48.3&longitude=14.3&current=pm2_5',
    'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv',
    'https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest/query?sql=SELECT%201',
  ];
  for (const feed of feeds) {
    const outcome = await page.eval(`(async () => {
      const stop = new AbortController(); const t = setTimeout(() => stop.abort(), 20000);
      try { const r = await fetch(${JSON.stringify(feed)}, { signal: stop.signal }); stop.abort(); return 'HTTP ' + r.status; }
      catch (e) { return e.name; } finally { clearTimeout(t); await new Promise(r => setTimeout(r, 300)); }
    })()`, { awaitPromise: true });
    const seen = await violations();
    check(seen.length === 0, `feed ${new URL(feed).hostname} → ${outcome} ${seen.length ? JSON.stringify(seen) : ''}`);
  }

  const images = [
    'https://a.basemaps.cartocdn.com/dark_all/1/0/0.png',
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    'https://cdn.bsky.app/img/feed_thumbnail/plain/none/none@jpeg',
  ];
  for (const image of images) {
    const outcome = await page.eval(`new Promise((done) => {
      const img = new Image();
      img.onload = () => setTimeout(() => done('loaded'), 300);
      img.onerror = () => setTimeout(() => done('not loaded'), 300);
      img.src = ${JSON.stringify(image)};
    })`, { awaitPromise: true });
    const seen = await violations();
    check(seen.length === 0, `image ${new URL(image).hostname} → ${outcome} ${seen.length ? JSON.stringify(seen) : ''}`);
  }

  // Violations raised outside the page (service worker) only reach the log.
  const logged = page.events
    .map((e) => e.params?.entry?.text ?? '')
    .filter((t) => /Content Security Policy/i.test(t) && !/example\.com|inline script/i.test(t));
  check(logged.length === 0, `no other CSP messages in the browser log ${JSON.stringify([...new Set(logged)].slice(0, 5))}`);
} finally {
  await page.close();
  server.close();
}

console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nCSP check passed');
process.exit(failures.length ? 1 : 0);

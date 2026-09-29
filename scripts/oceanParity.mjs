// GPU parity gate for the Ledger ocean: starts a Vite dev server, opens the
// probe page in headless Chrome (SwiftShader), prints the comparison and exits
// non-zero on any mismatch.
//
//   node scripts/oceanParity.mjs
import { createServer } from 'vite';
import { launch } from './cdp.mjs';

const server = await createServer({
  server: { port: 5199, strictPort: false, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0];
let result = { ok: false, error: 'probe never reported' };
let page;
try {
  page = await launch({ url: `${base}ledger-ocean-probe.html`, width: 640, height: 480 });
  await page.waitFor('window.__parity !== undefined', { timeoutMs: 180000, label: 'parity' });
  result = JSON.parse(await page.eval('JSON.stringify(window.__parity)'));
} finally {
  if (page) await page.close();
  await server.close();
}
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

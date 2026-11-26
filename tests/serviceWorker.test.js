// @vitest-environment node
// Runs public/sw.js against a fake Cache Storage and network. Cache Storage
// ignores Cache-Control, so the worker has to enforce it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const ORIGIN = 'https://scale94.com';
const source = readFileSync('public/sw.js', 'utf8');

const reply = (headers = {}) =>
  new Response('x', { status: 200, headers: { 'content-type': 'application/json', ...headers } });

function load({ network = () => reply(), existing = [] } = {}) {
  const listeners = {};
  const stores = new Map(existing.map(name => [name, new Map()]));
  const touched = [];
  const fetched = [];
  const key = r => new URL(typeof r === 'string' ? r : r.url, ORIGIN).href;
  const open = async name => {
    touched.push(name);
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put:    async (r, res) => { store.set(key(r), res); },
      addAll: async urls => { for (const u of urls) store.set(key(u), await fetch(u)); },
    };
  };
  const caches = {
    open,
    keys:   async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match:  async r => {
      touched.push('match');
      for (const store of stores.values()) if (store.has(key(r))) return store.get(key(r));
      return undefined;
    },
  };
  const fetch = async r => { fetched.push(key(r)); return network(new URL(key(r))); };
  const self = {
    location: { origin: ORIGIN },
    skipWaiting() {},
    clients: { claim: async () => {} },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, fetch);

  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  const lifecycle = async type => {
    const waits = [];
    listeners[type]({ waitUntil: p => waits.push(p) });
    await Promise.all(waits);
    await settle();
  };
  const request = async path => {
    let answered;
    listeners.fetch({
      request: { url: ORIGIN + path, method: 'GET' },
      respondWith: p => { answered = p; },
    });
    const response = answered && await answered;
    await settle();
    return { intercepted: answered !== undefined, response };
  };
  const cached = () => [...stores.values()].flatMap(s => [...s.keys()].map(u => u.slice(ORIGIN.length)));

  return { lifecycle, request, cached, touched, fetched, stores };
}

describe('service worker', () => {
  it.each([
    '/api/transmute/status?hash=abc',
    '/api/transmute/threshold',
    '/api/graphtracks/top-posts',
    '/api/sigil/abc.json',
  ])('leaves %s entirely to the network', async path => {
    const sw = load();
    const { intercepted } = await sw.request(path);
    expect(intercepted).toBe(false);
    expect(sw.touched).toEqual([]);
  });

  it.each(['/page', '/assets/app-abc.js', '/kernel/manifest.json'])('caches an ordinary %s', async path => {
    const sw = load();
    await sw.request(path);
    expect(sw.cached()).toEqual([path]);
  });

  describe.each(['/page', '/assets/app-abc.js', '/kernel/manifest.json'])('for %s', path => {
    it.each(['no-store', 'max-age=0, No-Store', 'private, max-age=60'])(
      'returns but never stores a response marked %s', async cacheControl => {
        const sw = load({ network: () => reply({ 'cache-control': cacheControl }) });
        const { response } = await sw.request(path);
        expect(response.status).toBe(200);
        expect(sw.cached()).toEqual([]);
      });
  });

  // The SPA rewrite answers a missing chunk with index.html and 200.
  it('does not keep the SPA shell forever under a missing asset', async () => {
    const sw = load({ network: () => reply({ 'content-type': 'text/html; charset=utf-8' }) });
    await sw.request('/assets/gone-abc.js');
    expect(sw.cached()).toEqual([]);
  });

  it('precaches the shell and nothing that does not exist', async () => {
    const sw = load();
    await sw.lifecycle('install');
    expect(sw.cached()).toEqual(['/']);
    expect(sw.fetched).toEqual([`${ORIGIN}/`]);
  });

  it('does not precache a shell marked no-store', async () => {
    const sw = load({ network: () => reply({ 'cache-control': 'no-store' }) });
    await sw.lifecycle('install');
    expect(sw.cached()).toEqual([]);
  });

  it('drops the v7 cache, which may hold API responses', async () => {
    const sw = load({ existing: ['scale94-v7'] });
    await sw.lifecycle('activate');
    expect([...sw.stores.keys()]).not.toContain('scale94-v7');
  });
});

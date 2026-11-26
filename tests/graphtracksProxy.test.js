// @vitest-environment node
// /api/graphtracks/top-posts holds the GraphTracks key so the browser never does.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const KEY = 'gt-test-key-5c1e';
const DID = 'did:plc:testaccount';

let handler;
let upstream;

const upstreamPost = (over = {}) => ({
  post_id: 'abc', indexedAt: '2026-11-01T00:00:00Z', likes: 3, reposts: 2, replies: 1,
  viewerEmail: 'private@example.com',
  details: {
    secretNote: 'private',
    record: { text: 'hello', langs: ['en'] },
    embed: { images: [{ thumb: 'https://cdn.bsky.app/t.jpg', alt: 'a', fullsize: 'x' }] },
  },
  ...over,
});

const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

async function call({ method = 'GET', url = '/api/graphtracks/top-posts' } = {}) {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = () => res;
  await handler({ method, url, headers: {} }, res);
  return res;
}

beforeEach(async () => {
  vi.resetModules(); // the route caches in module scope
  process.env.GRAPHTRACKS_KEY = KEY;
  process.env.GRAPHTRACKS_DID = DID;
  upstream = vi.fn(async () => reply([upstreamPost()]));
  vi.stubGlobal('fetch', upstream);
  ({ default: handler } = await import('../api/graphtracks/top-posts.js'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('/api/graphtracks/top-posts', () => {
  it('calls one fixed upstream address with the server-held key', async () => {
    await call();
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, options] = upstream.mock.calls[0];
    expect(url).toBe(`https://api.graphtracks.com/v1/api/networks/BlueSky/accounts/${DID}/top-posts`);
    expect(options.headers['X-API-Key']).toBe(KEY);
  });

  it('returns only the fields the page shows, and never the key', async () => {
    const res = await call();
    expect(res.body).toEqual({
      configured: true,
      did: DID,
      posts: [{
        post_id: 'abc', indexedAt: '2026-11-01T00:00:00Z', likes: 3, reposts: 2, replies: 1,
        details: {
          record: { text: 'hello' },
          embed: { images: [{ thumb: 'https://cdn.bsky.app/t.jpg', alt: 'a' }] },
        },
      }],
    });
    expect(JSON.stringify(res)).not.toContain(KEY);
  });

  it('drops posts with neither text nor image and returns at most 6', async () => {
    upstream.mockResolvedValue(reply([
      upstreamPost({ post_id: 'empty', details: {} }),
      ...Array.from({ length: 9 }, (_, i) => upstreamPost({ post_id: `p${i}` })),
    ]));
    const { posts } = (await call()).body;
    expect(posts.map((p) => p.post_id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it.each(['GRAPHTRACKS_KEY', 'GRAPHTRACKS_DID'])('reports unconfigured without %s', async (name) => {
    delete process.env[name];
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ configured: false, posts: [] });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('ignores the old VITE_ names', async () => {
    delete process.env.GRAPHTRACKS_KEY;
    process.env.VITE_GRAPHTRACKS_KEY = KEY;
    expect((await call()).body.configured).toBe(false);
    delete process.env.VITE_GRAPHTRACKS_KEY;
  });

  it.each(['POST', 'PUT', 'DELETE'])('refuses %s', async (method) => {
    expect((await call({ method })).statusCode).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses a query string, which would slip past the CDN cache', async () => {
    const res = await call({ url: '/api/graphtracks/top-posts?bust=1' });
    expect(res.statusCode).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('caches a good answer for 10 minutes', async () => {
    vi.useFakeTimers({ now: 0 });
    const first = await call();
    expect(first.headers['cache-control']).toContain('s-maxage=600');
    vi.setSystemTime(599_000);
    await call();
    expect(upstream).toHaveBeenCalledTimes(1);
    vi.setSystemTime(601_000);
    await call();
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['an upstream error status', () => Promise.resolve(reply({ message: `bad key ${KEY}` }, 401))],
    ['a network failure',        () => Promise.reject(new Error(`connect failed ${KEY}`))],
    ['a non-array answer',       () => Promise.resolve(reply({ error: KEY }))],
  ])('answers 502 on %s, leaking nothing and caching nothing', async (_name, impl) => {
    upstream.mockImplementation(impl);
    const res = await call();
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ configured: true, did: DID, posts: [], error: 'GraphTracks unavailable' });
    expect(res.headers['cache-control']).toBe('no-store');
    await call();
    expect(upstream).toHaveBeenCalledTimes(2);
  });
});

describe('client bundle', () => {
  const files = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return e.name === '__tests__' ? [] : files(join(dir, e.name));
    return /\.(jsx?|tsx?)$/.test(e.name) ? [join(dir, e.name)] : [];
  });
  const offenders = (re) => files('src').filter((f) => re.test(readFileSync(f, 'utf8')));

  it('reads no GraphTracks variable', () => {
    expect(offenders(/import\.meta\.env\.\w*GRAPHTRACKS/)).toEqual([]);
  });

  it('never calls GraphTracks or sends an API key itself', () => {
    expect(offenders(/api\.graphtracks\.com|X-API-Key/)).toEqual([]);
  });
});

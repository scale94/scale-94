// api/graphtracks/top-posts.js — server side of the /BSKY top-posts panel.
// GET /api/graphtracks/top-posts
//
// Holds the GraphTracks API key so it never reaches the browser. This is not an
// open proxy: one fixed upstream address, no caller input, and only the fields
// the page shows come back. Answers are cached for 10 minutes (CDN and warm
// instance) so visitors cannot spend the key's quota.
//
// Env: GRAPHTRACKS_KEY, GRAPHTRACKS_DID. Never give either a VITE_ prefix.

const UPSTREAM   = 'https://api.graphtracks.com/v1/api/networks/BlueSky/accounts';
const MAX_POSTS  = 6;
const CACHE_S    = 600;
const TIMEOUT_MS = 8000;

let cached = null; // { at, body }

const toPublicPost = (p) => ({
  post_id:   p.post_id,
  indexedAt: p.indexedAt,
  likes:     p.likes,
  reposts:   p.reposts,
  replies:   p.replies,
  details: {
    record: { text: p.details?.record?.text },
    embed: {
      images: (p.details?.embed?.images ?? []).slice(0, 1)
        .map((img) => ({ thumb: img?.thumb, alt: img?.alt })),
    },
  },
});

const hasContent = (p) => p?.details?.record?.text || p?.details?.embed?.images?.length;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  // The CDN caches by full URL, so a query string would reach the function every time.
  if (req.url?.includes('?')) return res.status(400).json({ error: 'No parameters accepted' });

  const key = process.env.GRAPHTRACKS_KEY;
  const did = process.env.GRAPHTRACKS_DID;
  const configured = Boolean(key && did);

  const send = (status, body, cacheControl) => {
    res.setHeader('Cache-Control', cacheControl);
    return res.status(status).json(body);
  };
  const fresh = `public, max-age=0, s-maxage=${CACHE_S}`;

  if (!configured) return send(200, { configured, did: did || null, posts: [] }, 'no-store');
  if (cached && Date.now() - cached.at < CACHE_S * 1000) return send(200, cached.body, fresh);

  try {
    const upstream = await fetch(`${UPSTREAM}/${encodeURIComponent(did).replace(/%3A/g, ':')}/top-posts`, {
      headers: { 'X-API-Key': key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    const data = await upstream.json();
    if (!Array.isArray(data)) throw new Error('unexpected shape');

    const body = { configured, did, posts: data.filter(hasContent).slice(0, MAX_POSTS).map(toPublicPost) };
    cached = { at: Date.now(), body };
    return send(200, body, fresh);
  } catch (err) {
    // Upstream text can echo the key; log only our own status or the error type.
    console.error('[graphtracks/top-posts]',
      /^(status \d+|unexpected shape)$/.test(err.message) ? err.message : err.name);
    return send(502, { configured, did, posts: [], error: 'GraphTracks unavailable' }, 'no-store');
  }
}

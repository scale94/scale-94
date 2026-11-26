/* eslint-env browser, serviceworker */
// sw.js — Scale 9.4 // Service Worker // Level 20: Trivial CAS Worker
//
// CAS model: every data file in /kernel/ is content-addressed (immutable).
// The manifest tells the app which hash is current — it is the only file
// that must always be fresh. Everything else is cached forever.
//
// Strategy:
//   /api/**                       → not intercepted: network only, never stored
//   /kernel/manifest.json         → network-first, cache fallback
//   /kernel/**  (hash-named .json) → cache-first, eternal (content-addressed)
//   /assets/**  (Vite hashed JS/CSS) → cache-first, eternal
//   /wasm/**                       → cache-first, eternal
//   HTML / navigation              → network-first, SPA fallback to '/'
// Cache Storage ignores Cache-Control, so store() refuses no-store and private.

const CACHE_VERSION = 'scale94-v8'; // bumped: purges the API responses v7 cached

// Content-addressed patterns — safe to cache forever.
const IMMUTABLE_PATTERN = /\/assets\/[^/?]+\.(js|css)(\?.*)?$/;
const WASM_PATTERN      = /\/wasm\/[^/?]+\.(js|wasm)(\?.*)?$/;
// /kernel/**/*.json but NOT /kernel/manifest.json
const KERNEL_CAS_PATTERN = /\/kernel\/(?!manifest\.json)[^/?]+\.json(\?.*)?$/;

const UNCACHEABLE = /\b(no-store|private)\b/i;

// The only way anything enters Cache Storage.
function store(request, response) {
  if (!response.ok) return undefined;
  if (UNCACHEABLE.test(response.headers.get('cache-control') ?? '')) return undefined;
  const clone = response.clone();
  return caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
}

const isHtml = response => (response.headers.get('content-type') ?? '').includes('text/html');

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    fetch('/').then(response => store('/', response)).catch(() => {})
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;
  // Never intercept Vercel infrastructure or analytics routes.
  if (url.pathname.startsWith('/_vercel/')) return;
  // API responses are per-visitor or live: leave them to the browser's own fetch.
  if (url.pathname.startsWith('/api/')) return;

  const p = url.pathname;

  // Immutable content-addressed assets — cache forever, no revalidation needed.
  if (IMMUTABLE_PATTERN.test(p) || WASM_PATTERN.test(p) || KERNEL_CAS_PATTERN.test(p)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // HTML here is the SPA rewrite answering for a missing file; kept
          // cache-first, it would break that URL until the next CACHE_VERSION.
          if (!isHtml(response)) store(request, response);
          return response;
        });
      })
    );
    return;
  }

  // manifest.json — network-first; cache fallback for offline.
  // The manifest is tiny and must always be fresh so the app boots the correct hashes.
  if (p === '/kernel/manifest.json') {
    event.respondWith(
      fetch(request)
        .then(response => {
          store(request, response);
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else — network-first with SPA fallback.
  event.respondWith(
    fetch(request)
      .then(response => {
        store(request, response);
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached => cached ?? caches.match('/'))
      )
  );
});

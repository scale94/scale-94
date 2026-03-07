/* eslint-env browser, serviceworker */
// sw.js — Scale 9.4 // Service Worker // Apocalypse Protocol
// Level 19: Offline-first PWA — survives complete network partition.
//
// Strategy:
//   STATIC ASSETS  (.js, .css, .wasm, hashed filenames) → cache-first
//   HTML navigation (index.html, /) → network-first with cache fallback
//   WASM modules    (/wasm/*.*)     → cache-first (large, rarely change)
//
// The entire production bundle is progressively cached on first visit.
// On subsequent visits, the terminal boots from cache even with zero connectivity.

const CACHE_VERSION = 'scale94-v1';

// Hashed asset pattern — Vite appends a content hash to all JS/CSS/WASM chunks.
// These are immutable once cached: if the hash changes, it's a new file.
const IMMUTABLE_PATTERN = /\/assets\/[^/?]+\.(js|css)(\?.*)?$/;
const WASM_PATTERN      = /\/wasm\/[^/?]+\.(js|wasm)(\?.*)?$/;

// ── Install ──────────────────────────────────────────────────────────────────
// Skip waiting so the new SW activates immediately on deploy, without requiring
// the user to close all tabs.

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // Pre-cache the app shell (HTML + known static roots)
      cache.addAll(['/', '/vite.svg']).catch(() => {
        // Ignore pre-cache failures — runtime caching covers the rest
      })
    )
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
// Purge old cache versions so stale bundles never serve after a deploy.

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  if (IMMUTABLE_PATTERN.test(url.pathname) || WASM_PATTERN.test(url.pathname)) {
    // Cache-first: hashed assets are content-addressed — safe to serve stale forever
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // Network-first: HTML + dynamic paths — prefer fresh, fall back to cache
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached => {
            if (cached) return cached;
            // Final fallback: serve index.html for SPA navigation
            return caches.match('/');
          })
        )
    );
  }
});

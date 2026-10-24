/* VidyaPariksha service worker — static caching only.
 * Private /api responses are NEVER cached here; the server remains authoritative
 * for attempts, answers, deadlines and results. */
const CACHE = 'vidyapariksha-static-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/') || url.pathname === '/health') return;

  // Hashed build assets: cache-first (safe because filenames change per build).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => caches.match('/'))),
    );
    return;
  }

  // Navigations: network-first with an offline fallback to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put('/', response.clone()));
        return response;
      }).catch(() => caches.match('/').then((hit) => hit || new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title><div style="font:16px system-ui;padding:32px">You are offline. Static pages may be available, but examinations require a connection to load questions and save answers.</div>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
      ))),
    );
    return;
  }

  // Other same-origin static files: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => hit);
      return hit || network;
    }),
  );
});

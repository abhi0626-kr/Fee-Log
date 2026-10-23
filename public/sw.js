const CACHE_NAME = 't1d-log-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/timeline',
  '/patterns',
  '/summary',
  '/export',
  '/settings',
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never intercept or cache Next.js internal chunks, HMR, or API calls
  if (
    event.request.url.includes('/_next/') ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('webpack')
  ) {
    return;
  }

  // Navigation requests: stale-while-revalidate or network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((res) => res || caches.match('/'));
      })
    );
    return;
  }

  // Assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request);
        });
    })
  );
});

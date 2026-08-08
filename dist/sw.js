// ============================================================
// SERVICE WORKER — Kun COM VH PWA (v91)
// Stratégie : Network-First pour JS/HTML (Garantie de mise à jour instantanée)
// app.js a été découpé en modules (voir dossier js/) pour la maintenabilité —
// même stratégie de cache, juste plus de fichiers listés ci-dessous.
// ============================================================

const CACHE_NAME = 'kun-com-pwa-v91';
const STATIC_ASSETS = [
  './',
  './index.html',
  './js/01-core.js',
  './js/02-media.js',
  './js/03-render-engine.js',
  './js/04-render-auth-cropper.js',
  './js/05-render-feed.js',
  './js/06-render-panels.js',
  './js/07-app-controller.js',
  './js/08-bootstrap.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache initial:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-First pour les scripts et pages HTML : garantie d'affichage direct des mises à jour
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-cache' })).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Stale-While-Revalidate pour les autres ressources statiques
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      });
    })
  );
});

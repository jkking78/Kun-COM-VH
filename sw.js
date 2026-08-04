// ============================================================
// SERVICE WORKER — Kun COM VH PWA
// Stratégie : Stale-While-Revalidate (Chargement 0ms instantané)
// ============================================================

const CACHE_NAME = 'kun-com-pwa-v15';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// Installation : mise en cache immédiate
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

// Activation : nettoyage des anciens caches
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

// Requêtes : Stale-While-Revalidate (chargement 0ms depuis cache + mise à jour en arrière-plan)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Fetch réseau en arrière-plan pour mettre à jour le cache
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        // Rendu instantané si disponible en cache, sinon attendre le réseau
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// ============================================================
// SERVICE WORKER — Kun COM VH PWA
// Stratégie : Network First (toujours la dernière version)
// ============================================================

const CACHE_NAME = 'kun-com-pwa-v4';
const STATIC_ASSETS = [
  './index.html',
  './app.js',
  './manifest.json'
];

// Installation : mise en cache des assets statiques
self.addEventListener('install', (event) => {
  console.log('[SW] Installation v4...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Certains assets non mis en cache:', err);
      });
    })
  );
  // Activation immédiate (sans attendre la fermeture des onglets précédents)
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation — nettoyage des anciens caches');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Suppression cache obsolète:', key);
              return caches.delete(key);
            })
      );
    })
  );
  // Prise de contrôle immédiate de tous les clients
  self.clients.claim();
});

// Requêtes réseau : Network First avec fallback cache
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET et les requêtes cross-origin (Supabase, etc.)
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  
  if (!isLocal) {
    // Pour les requêtes externes (API, CDN) : Network Only
    return;
  }

  event.respondWith(
    // Network First : essayer le réseau d'abord
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        // Mettre en cache la nouvelle version
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Si réseau indisponible : fallback sur le cache
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Fallback cache pour:', event.request.url);
          return cachedResponse;
        }
        // Fallback final : page d'accueil
        return caches.match('./index.html');
      });
    })
  );
});

// Gestion des messages (ex: forcer mise à jour)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

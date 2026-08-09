// ============================================================
// SERVICE WORKER — Kun COM VH PWA (v104)
// Stratégie : Network-First pour JS/HTML (Garantie de mise à jour instantanée)
// app.js a été découpé en modules (voir dossier js/) pour la maintenabilité —
// même stratégie de cache, juste plus de fichiers listés ci-dessous.
// ============================================================

const CACHE_NAME = 'kun-com-pwa-v104';
// Numéro de version seul ('102'), tel qu'il apparaît dans les ?v=… de index.html.
const NUM_V = CACHE_NAME.split('-v')[1];
const JS_FILES = [
  '01-core', '02-media', '03-render-engine', '04-render-auth-cropper',
  '05-render-feed', '06-render-panels', '07-app-controller', '08-bootstrap'
];
// Les scripts sont mis en cache AVEC leur ?v=… : c'est l'adresse réellement
// demandée par la page. Sans le paramètre, les entrées ne correspondaient à
// aucune requête et le pré-chargement ne servait strictement à rien.
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon-180.png'
].concat(JS_FILES.map((f) => `./js/${f}.js?v=${NUM_V}`));

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

  // SCRIPTS VERSIONNÉS (js/…?v=102) : servis depuis le cache EN PRIORITÉ.
  // Auparavant ils passaient tous par le réseau avec cache:'no-cache' — soit huit
  // allers-retours obligatoires avant que l'application ne puisse démarrer, à
  // chaque lancement. C'était la vraie raison de la lenteur d'affichage sur
  // réseau mobile (imperceptible en Wi-Fi rapide, d'où la confusion).
  // Cela ne retarde aucune mise à jour : une nouvelle version change le ?v=…,
  // donc l'adresse demandée est différente et ne peut jamais être servie depuis
  // l'ancienne entrée. C'est index.html qui annonce les nouvelles versions, et
  // lui reste en réseau d'abord (voir ci-dessous).
  const estScriptVersionne = url.pathname.endsWith('.js') && url.search.indexOf('v=') !== -1;
  if (estScriptVersionne) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((reseau) => {
          if (reseau && reseau.status === 200) {
            const copie = reseau.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
          }
          return reseau;
        });
      })
    );
    return;
  }

  // HTML (et scripts sans version) : réseau d'abord, pour que les nouvelles
  // versions soient prises en compte immédiatement. Une seule requête bloquante
  // au lieu de neuf.
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

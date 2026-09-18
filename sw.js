const CACHE_NAME = 'closing-tracker-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon-32.png',
  './favicon-192.png',
  './favicon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  // Laisse passer les requêtes vers d'autres origines (Google Drive, Agenda, polices...)
  // sans les mettre en cache : elles doivent rester à jour et ne fonctionnent
  // de toute façon pas hors-ligne.
  if (url.origin !== self.location.origin) return;

  // Page principale : réseau en priorité pour toujours avoir la dernière version
  // déployée quand la connexion est disponible, avec repli sur la version en
  // cache si l'appareil est hors-ligne.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Autres fichiers statiques de l'appli (manifest, icônes) : cache en priorité,
  // rafraîchi en arrière-plan dès que le réseau répond.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

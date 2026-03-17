// ─── Service Worker pour le mode hors-ligne (PWA) ────────
const CACHE_NAME = 'tempoci-v1';
const ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './js/app.js',
  './js/helpers.js',
  './js/chrono.js',
  './js/timer.js',
  './js/ui.js',
  './js/keyboard.js',
  './js/audio.js',
  './js/storage.js',
  './js/history.js',
  './manifest.json',
];

// Mise en cache des ressources à l'installation
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Nettoyage des anciens caches à l'activation
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie cache-first avec fallback réseau
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

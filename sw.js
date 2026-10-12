// Service worker : l'application s'ouvre même hors connexion avec la dernière édition.
const VERSION = 'journal-v2';
const SHELL = [
  './',
  'index.html',
  'assets/css/app.css',
  'assets/js/i18n.js',
  'assets/js/icons.js',
  'assets/js/app.js',
  'assets/icons/icon.svg',
  'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // L'édition : réseau d'abord, cache en secours
  if (url.origin === location.origin && url.pathname.endsWith('/data/news.json')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('data/news.json', copy));
          return res;
        })
        .catch(() => caches.match('data/news.json')),
    );
    return;
  }

  // L'application et les polices : cache d'abord, mise à jour en arrière-plan
  if (url.origin === location.origin || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const network = fetch(e.request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

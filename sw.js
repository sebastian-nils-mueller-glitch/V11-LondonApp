/* =========================================================
   London 2025 – Service Worker (leichtgewichtig)
   ========================================================= */
const SW_VERSION = 'v1.0.3';
const CACHE_NAME = `london2025-${SW_VERSION}`;
const APP_SHELL = [
  '/',                      // Host kann dies zu /V11-LondonApp/ mappen; bei Bedarf entfernen
  '/V11-LondonApp/',        // GitHub Pages Unterordner (anpassen falls anders)
  '/V11-LondonApp/index.html',
  '/V11-LondonApp/style.css?v=2',
  '/V11-LondonApp/script.js?v=3',
  '/V11-LondonApp/manifest.json',
  '/V11-LondonApp/img/london-morning.jpg',
  '/V11-LondonApp/img/london-day.jpg',
  '/V11-LondonApp/img/london-evening.jpg',
  '/V11-LondonApp/img/london-night.jpg',
  '/V11-LondonApp/icons/icon-192.png',
  '/V11-LondonApp/icons/icon-512.png'
];

const RUNTIME_BLOCKLIST = [
  'tile.openstreetmap.org',
  'unpkg.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isBlocked = RUNTIME_BLOCKLIST.some((d) => url.hostname.includes(d));

  if (!sameOrigin || isBlocked || req.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

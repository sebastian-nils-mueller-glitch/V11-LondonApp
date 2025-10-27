/* =========================================================
   London 2025 – Service Worker (leichtgewichtig)
   Strategie: Stale-While-Revalidate für App-Assets
   ========================================================= */

const SW_VERSION = 'v1.0.0';
const CACHE_NAME = `london2025-${SW_VERSION}`;
const APP_SHELL = [
  '/',                 // ggf. auf /index.html mappen, je nach Hosting
  '/index.html',
  '/style.css?v=1',
  '/script.js?v=1',
  '/manifest.json',
  // Hero-Bilder:
  '/img/london-morning.jpg',
  '/img/london-day.jpg',
  '/img/london-evening.jpg',
  '/img/london-night.jpg',
  // Icons:
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Bestimmte Domains nicht cachen (z.B. Kartenkacheln dynamisch lassen)
const RUNTIME_BLOCKLIST = [
  'tile.openstreetmap.org',
  'unpkg.com' // Leaflet JS/CSS
];

// Install: App-Shell vorcachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: alte Caches aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch: Stale-While-Revalidate für gleiche-Origin-Requests
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nur gleiche Origin cachen
  const sameOrigin = url.origin === self.location.origin;

  // Runtime-Blocklist (z.B. OSM-Kacheln immer direkt aus dem Netz)
  const isBlocked = RUNTIME_BLOCKLIST.some((d) => url.hostname.includes(d));
  if (!sameOrigin || isBlocked || req.method !== 'GET') {
    return; // Standard-Netzverhalten
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => {
          // Nur erfolgreiche Antworten cachen
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached); // offline: Fallback auf Cache, falls vorhanden

      // Sofort etwas liefern, falls vorhanden; parallel aktualisieren
      return cached || networkFetch;
    })
  );
});

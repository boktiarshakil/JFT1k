// JFT Exam Hub — Service Worker for offline support (Item #13)
const CACHE_NAME = 'jft-hub-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/exam.html',
  '/history.html',
  '/css/style.css',
  '/js/app.js',
  '/js/audio.js',
  '/js/darkmode.js',
  '/js/i18n.js'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls: network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => {
      return new Response(JSON.stringify({ error: { message: 'Offline — please check your connection' } }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // Static assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', { status: 503 }));

      return cached || fetchPromise;
    })
  );
});

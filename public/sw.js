const CACHE_NAME = 'dashop-v28';

// Only public storefront assets to cache for offline support
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/catalog',
  '/catalog.html',
  '/product',
  '/product.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/scanner.js',
  '/js/supabase-client.js',
  '/js/i18n.js',
  '/js/promos.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // NEVER cache or intercept Admin pages or Supabase API calls
  if (url.pathname.startsWith('/admin') || url.hostname.includes('supabase.co')) {
    return; // Pass through to network directly
  }

  // Network-First strategy: always fetch fresh from network, fallback to cache if offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

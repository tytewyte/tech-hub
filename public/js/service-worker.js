const CACHE_NAME = 'hvac-app-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/modules/ui.js',
  '/js/modules/api.js',
  '/js/utils/lazy-loader.js',
  '/js/store/store.js',
  '/js/store/slices/hvacSlice.js',
  '/js/store/slices/authSlice.js',
  '/js/store/slices/uiSlice.js'
];

// Install service worker and cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Network first, then cache strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response since it can only be consumed once
        const responseClone = response.clone();
        
        // Cache the fresh response
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
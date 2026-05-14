const CACHE_NAME = 'counseling-center-v3';
const ASSETS = [
      './',
      './index.html',      './style.css',// Clean state     './app.js',      './manifest.json',
      './assets/logo.svg',
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Padauk:wght@400;700&display=swap',// RECOVERY      'https://unpkg.com/lucide@latest'const CACHE_NAME = 'counseling-center-v3';const ASSETS = [      './',
// Final Fix Attempt
      const CACHE_NAME = 'counseling-center-v3';
const ASSETS = [
          './',
          './index.html',
          './style.css',
          './app.js',
          './manifest.json',
          './assets/logo.svg',
          'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Padauk:wght@400;700&display=swap',
          'https://unpkg.com/lucide@latest'
      ];

self.addEventListener('install', (event) => {
          event.waitUntil(
                        caches.open(CACHE_NAME).then((cache) => {
                                          return cache.addAll(ASSETS);
                        })
                    );
          self.skipWaiting();
});

self.addEventListener('activate', (event) => {
          event.waitUntil(
                        caches.keys().then((cacheNames) => {
                                          return Promise.all(
                                                                cacheNames.map((cache) => {
                                                                                          if (cache !== CACHE_NAME) {
                                                                                                                        return caches.delete(cache);
                                                                                                }
                                                                })
                                                            );
                        })
                    );
          self.clients.claim();
});

self.addEventListener('fetch', (event) => {
          event.respondWith(
                        caches.match(event.request).then((response) => {
                                          return response || fetch(event.request);
                        })
                    );
});
'./index.html',
      './style.css',
      './app.js',
      './manifest.json',
      './assets/logo.svg',
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Padauk:wght@400;700&display=swap',
      'https://unpkg.com/lucide@latest'  ];self.addEventListener('install', (event) => {
      event.waitUntil(
                caches.open(CACHE_NAME).then((cache) => {
                              return cache.addAll(ASSETS);
                })
            );
      self.skipWaiting();
});

self.addEventListener('activate', (event) => {
      event.waitUntil(
                caches.keys().then((cacheNames) => {
                              return Promise.all(
                                                cacheNames.map((cache) => {
                                                                      if (cache !== CACHE_NAME) {
                                                                                                return caches.delete(cache);
                                                                      }
                                                })
                                            );
                })
            );
      self.clients.claim();
});

self.addEventListener('fetch', (event) => {
      event.respondWith(
                caches.match(event.request).then((response) => {
                              return response || fetch(event.request);
                })
            );
});

];

self.addEventListener('install', (event) => {
      event.waitUntil(
                caches.open(CACHE_NAME).then((cache) => {
                              return cache.addAll(ASSETS);
                })
            );
      self.skipWaiting();
});

self.addEventListener('activate', (event) => {
      event.waitUntil(
                caches.keys().then((cacheNames) => {
                              return Promise.all(
                                                cacheNames.map((cache) => {
                                                                      if (cache !== CACHE_NAME) {
                                                                                                return caches.delete(cache);
                                                                      }
                                                })
                                            );
                })
            );
      self.clients.claim();
});

self.addEventListener('fetch', (event) => {
      event.respondWith(
                caches.match(event.request).then((response) => {
                              return response || fetch(event.request);
                })
            );
});
const CACHE_NAME = 'counseling-center-v3';
const ASSETS = [
      './',
      './index.html',
      './style.css',
      './app.js',
      './manifest.json',
      './assets/logo.svg',
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Padauk:wght@400;700&display=swap',
      'https://unpkg.com/lucide@latest'
  ];
const CACHE_NAME = 3counseling-center-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './assets/logo.svg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Padauk:wght@400;700&display=swap',
  'https://unpkg.com/lucide@latest'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Do not cache Google Gemini API requests
  if (event.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

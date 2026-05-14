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
                                                                                                            });
                                                                                                            
                                                                                                            self.addEventListener('fetch', (event) => {
                                                                                                              event.respondWith(
                                                                                                                  caches.match(event.request).then((response) => {
                                                                                                                        return response || fetch(event.request);
                                                                                                                            })
                                                                                                                              );
                                                                                                                              });

const CACHE_NAME = 'spritz-reader-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/reader.css',
  '/app.js',
  '/reader.js',
  '/parsers.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Установка — кэшируем файлы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.log('SW install error:', err))
  );
});

// Обслуживание запросов — сначала из кэша, потом из сети
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});
const CACHE_NAME = 'sheet-app-ia-v1';
const urlsToCache = ['/', '/index.html', '/src/assets/images/app_icon_sheet_ia_1779096642893.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});

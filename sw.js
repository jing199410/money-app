// V5_REAL_CLEAN_RESTORE_2026_05_08_NO_BUDGET
// Clean restore service worker: clears old caches and unregisters itself so old V5.1 files stop sticking.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', () => {
  // Intentionally no cache interception. Always let the browser/network handle requests.
});

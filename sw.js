self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.destination !== 'image') return;

  event.respondWith(
    caches.open('img-cache').then(async cache => {
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        cache.put(req, res.clone());
        return res;
      });
      return cached || network;
    })
  );
});
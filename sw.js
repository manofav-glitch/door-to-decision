// Replaces the old app's service worker at the old address. Installed copies of the old app check this file
// for updates; this version clears the old app's caches, removes itself and reloads open windows, which then
// load the forwarding page (index.html). On-device progress lives in localStorage, which is not touched.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' }))
        client.navigate(client.url);
    })(),
  );
});

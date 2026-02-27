// Self-unregistering Service Worker
// Cleans up all caches and removes itself to prevent stale cache issues.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
            .then(() => self.registration.unregister())
            .then(() => console.log('[SW] Unregistered and caches cleared'))
    );
});

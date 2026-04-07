const CACHE_NAME = 'foodplanner-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/styles.css',
];

// Install: pre-cache static shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: stale-while-revalidate for navigation/static, network-first for API
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API requests: let the browser handle normally (IndexedDB offline layer handles caching)
    if (url.pathname.startsWith('/recipes') || url.pathname.startsWith('/weekplan') ||
        url.pathname.startsWith('/shopping') || url.pathname.startsWith('/pantry') ||
        url.pathname.startsWith('/auth') || url.pathname.startsWith('/health') ||
        url.pathname.startsWith('/ai') || url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/cooking-history') || url.pathname.startsWith('/seasons')) {
        return;
    }

    // Static assets: stale-while-revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
            cache.match(event.request).then((cached) => {
                const fetched = fetch(event.request).then((response) => {
                    if (response.ok) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                }).catch(() => cached);

                return cached || fetched;
            })
        )
    );
});

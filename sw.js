// Service Worker for Food Planner PWA
const CACHE_VERSION = 'v4';
const STATIC_CACHE = `foodplanner-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `foodplanner-dynamic-${CACHE_VERSION}`;
const API_CACHE = `foodplanner-api-${CACHE_VERSION}`;

// Static assets to cache on install
// Views are NOT listed here – they are cached on first access (stale-while-revalidate)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/js/main.js',
    '/js/app.js',
    '/js/config.js',
    '/js/core/utils.js',
    '/js/core/date-utils.js',
    '/js/core/dark-mode.js',
    '/js/core/offline-db.js',
    '/js/core/toast.js',
    '/js/core/action-history.js',
    '/js/core/pwa.js',
    '/js/core/storage-service.js',
    '/js/core/app-state.js',
    '/js/core/mobile-utils.js',
    '/js/core/onboarding.js'
];

// API endpoints to cache
const API_ROUTES = [
    '/recipes',
    '/weekplan'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
            .catch((err) => console.error('[SW] Cache install failed:', err))
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => {
                            return key.startsWith('foodplanner-') &&
                                   key !== STATIC_CACHE &&
                                   key !== DYNAMIC_CACHE &&
                                   key !== API_CACHE;
                        })
                        .map((key) => {
                            console.log('[SW] Removing old cache:', key);
                            return caches.delete(key);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Handle API requests (network-first with cache fallback)
    if (isApiRequest(url)) {
        event.respondWith(networkFirstStrategy(request, API_CACHE));
        return;
    }

    // Handle static assets (cache-first)
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
        return;
    }

    // Handle navigation requests (network-first)
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
        return;
    }

    // Default: stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// Check if request is an API call
function isApiRequest(url) {
    return url.pathname.startsWith('/api/') ||
           url.pathname.startsWith('/recipes') ||
           url.pathname.startsWith('/weekplan') ||
           url.pathname.startsWith('/shopping') ||
           url.pathname.startsWith('/ai/') ||
           url.port === '3000';
}

// Check if request is for a static asset
function isStaticAsset(url) {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
           url.pathname === '/' ||
           url.pathname === '/index.html' ||
           url.pathname === '/manifest.json';
}

// Cache-first strategy
async function cacheFirstStrategy(request, cacheName) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Cache-first fetch failed:', error);
        return createOfflineResponse();
    }
}

// Network-first strategy with cache fallback
async function networkFirstStrategy(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', request.url);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        return createOfflineResponse(request);
    }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => cachedResponse);

    return cachedResponse || fetchPromise;
}

// Create offline fallback response
function createOfflineResponse(request) {
    const url = request ? new URL(request.url) : null;

    // Return cached HTML for navigation
    if (request && request.mode === 'navigate') {
        return caches.match('/index.html');
    }

    // Return empty JSON for API requests
    if (url && isApiRequest(url)) {
        return new Response(
            JSON.stringify({
                error: 'Offline',
                message: 'Du bist offline. Die Daten werden geladen, sobald du wieder online bist.',
                offline: true
            }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    // Generic offline response
    return new Response('Offline', { status: 503 });
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-recipes') {
        event.waitUntil(syncRecipes());
    }

    if (event.tag === 'sync-weekplan') {
        event.waitUntil(syncWeekplan());
    }

    if (event.tag === 'sync-shopping') {
        event.waitUntil(syncShopping());
    }
});

// Sync recipes from IndexedDB to server
async function syncRecipes() {
    const pendingRecipes = await getPendingData('recipes');
    for (const recipe of pendingRecipes) {
        try {
            await fetch('/recipes', {
                method: recipe.method || 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recipe.data)
            });
            await removePendingData('recipes', recipe.id);
        } catch (error) {
            console.error('[SW] Failed to sync recipe:', error);
        }
    }
}

// Sync weekplan from IndexedDB to server
async function syncWeekplan() {
    const pendingPlans = await getPendingData('weekplan');
    for (const plan of pendingPlans) {
        try {
            await fetch('/weekplan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(plan.data)
            });
            await removePendingData('weekplan', plan.id);
        } catch (error) {
            console.error('[SW] Failed to sync weekplan:', error);
        }
    }
}

// Sync shopping list from IndexedDB to server
async function syncShopping() {
    const pendingItems = await getPendingData('shopping');
    for (const item of pendingItems) {
        try {
            await fetch('/shopping', {
                method: item.method || 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });
            await removePendingData('shopping', item.id);
        } catch (error) {
            console.error('[SW] Failed to sync shopping item:', error);
        }
    }
}

// IndexedDB helpers for pending data
function getPendingData(storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('foodplanner-offline', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(storeName)) {
                resolve([]);
                return;
            }
            const transaction = db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const getAll = store.getAll();
            getAll.onsuccess = () => resolve(getAll.result);
            getAll.onerror = () => reject(getAll.error);
        };
    });
}

function removePendingData(storeName, id) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('foodplanner-offline', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const deleteRequest = store.delete(id);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
        };
    });
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'Neue Benachrichtigung',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Food Planner', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                const url = event.notification.data?.url || '/';

                for (const client of clientList) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }

                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

console.log('[SW] Service Worker loaded');

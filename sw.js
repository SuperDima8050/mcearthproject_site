const CACHE_VERSION = '18-09-2026-v1';
const SUPABASE_HOST = 'sqlylxcnoqehorlgmztm.supabase.co';

function isCacheable(url) {
    if (url.hostname !== SUPABASE_HOST) return false;
    return /\.(ttf|ttc|otf|woff2?|png|jpe?g|webp|gif|ico|svg)(\?.*)?$/i.test(url.pathname);
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_VERSION)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || !isCacheable(url)) return;

    event.respondWith(
        caches.open(CACHE_VERSION).then(async (cache) => {
            const cached = await cache.match(event.request);
            if (cached) {
                fetch(event.request)
                    .then((fresh) => {
                        if (fresh && fresh.ok) cache.put(event.request, fresh.clone());
                    })
                    .catch(() => {});
                return cached;
            }

            const response = await fetch(event.request);
            if (response && response.ok) {
                cache.put(event.request, response.clone());
            }
            return response;
        })
    );
});

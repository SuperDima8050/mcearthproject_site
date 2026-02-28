const CACHE_NAME = 'mce-sw-v1';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Handle push notification received from server
self.addEventListener('push', function(event) {
    let data = { title: 'Revival MCEarth', body: 'Новая новость!', url: '/' };
    try {
        if (event.data) data = { ...data, ...event.data.json() };
    } catch(e) {}

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'mce-news',
            renotify: true,
            data: { url: data.url || '/' },
            actions: [
                { action: 'open', title: '📰 Открыть' },
                { action: 'close', title: '✕ Закрыть' }
            ]
        })
    );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'close') return;

    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});

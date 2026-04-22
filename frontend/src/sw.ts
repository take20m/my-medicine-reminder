/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// Workbox precache
self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation
const handler = new NetworkFirst({ cacheName: 'pages-cache' });
registerRoute(new NavigationRoute(handler));

// API cache
registerRoute(
  /^https:\/\/api\..*/i,
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 })]
  }),
  'GET'
);

// プッシュ通知を受信
self.addEventListener('push', (event) => {
  let data = {
    title: 'おくすりリマインダー',
    body: 'お薬の時間です',
    tag: 'reminder',
    data: {} as Record<string, unknown>
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open', title: '開く' },
      { action: 'dismiss', title: '閉じる' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ページからの通知クローズ依頼（服用記録直後に残留通知を消す用途）
self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; tag?: string } | undefined;
  if (data?.type !== 'CLOSE_NOTIFICATIONS' || !data.tag) return;

  event.waitUntil(
    self.registration.getNotifications({ tag: data.tag }).then((notifications) => {
      for (const n of notifications) {
        n.close();
      }
    })
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

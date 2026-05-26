/* It Rents service worker — push notifications + basic offline shell. */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = { title: 'It Rents', body: '', url: '/', badgeCount: undefined };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }
  const tasks = [
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url || '/' },
      tag: payload.tag,
    }),
  ];
  // Try navigator first (iOS), fall back to registration (Chrome/Android).
  const badger =
    (typeof self.navigator !== 'undefined' && typeof self.navigator.setAppBadge === 'function')
      ? self.navigator
      : (typeof self.registration.setAppBadge === 'function' ? self.registration : null);
  if (badger) {
    tasks.push(
      typeof payload.badgeCount === 'number'
        ? badger.setAppBadge(payload.badgeCount)
        : badger.setAppBadge(),
    );
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

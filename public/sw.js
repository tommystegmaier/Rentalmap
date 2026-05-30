/* It Rents service worker — push notifications + offline support. */

const CACHE_VERSION = 'v2';
const SHELL_CACHE = `itrents-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `itrents-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

// Pre-cache the offline fallback + core icons so they're always available.
const PRECACHE_URLS = [OFFLINE_URL, '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Caching strategy:
//   - Navigations (HTML): network-first, fall back to the cached page, then
//     to the offline page. Keeps content fresh online, usable offline.
//   - Next.js static assets (/_next/static, icons): stale-while-revalidate.
//   - Everything else (API calls, etc.): network-only — never cache mutations
//     or per-request data.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // skip cross-origin (Supabase, Stripe)

  // Never cache API responses.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        }),
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons') ||
    url.pathname === '/manifest.webmanifest';

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
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

// MinaDental OTA Auto-Update & Offline-First Service Worker (iOS 27 / Android APK / PWA)
const CACHE_NAME = 'minadental-ota-cache-v27.6';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/logo.png',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for OTA forced update commands from otaUpdateService
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'PURGE_AND_UPDATE_OTA') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .then(() => self.skipWaiting())
        .then(() => self.clients.claim())
        .then(() => {
          return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'OTA_CACHE_PURGED_READY',
              version: event.data.version || 'latest',
              timestamp: Date.now()
            });
          });
        })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetView = data.view || 'reminders';
  const targetUrl = `/?view=${encodeURIComponent(targetView)}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_NAVIGATE',
            view: targetView,
            patientId: data.patientId || undefined,
            reminderId: data.reminderId || undefined
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1. Never cache Vite dev endpoints, live clinic API routes, or package downloads
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    /\.(apk|ipa|zip|mobileconfig)$/i.test(url.pathname)
  ) {
    return;
  }

  if (url.pathname.endsWith('/version.json') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Network-First for HTML navigation & JS/CSS bundles so new deployments auto-update immediately
  if (
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 3. Stale-While-Revalidate for images, fonts, and static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

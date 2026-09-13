const CACHE_NAME = 'bokea-v37';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/404.html',
  '/css/style.css',
  '/js/config.js',
  '/js/a11y.js',
  '/js/onboarding.js',
  '/js/app.js',
  '/manifest.json',
  '/assets/icon.svg',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// The only third-party hosts whose responses are cached. Everything else that
// leaves this origin is live data - Supabase above all - and it used to go
// through the stale-while-revalidate branch below. With ignoreSearch on, every
// query against a table shared one cache entry, so reloading after a tick
// painted the list from before it, and another device kept showing an old
// list until it happened to refresh twice.
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
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

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Live data is never answered from the cache.
  if (url.origin !== self.location.origin && !CDN_HOSTS.includes(url.hostname)) return;
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Network-first policy for runtime configuration to prevent stale credentials
  if (url.pathname.endsWith('config.js') || url.pathname.includes('/js/config.js')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // Same-origin app shell files (HTML/CSS/JS) change on every deploy during
  // active development. Stale-while-revalidate kept serving whatever was
  // cached first and never caught up, so a fix could sit on disk for days
  // without ever reaching an already-open tab. Network-first fixes that:
  // always try the live file, and only fall back to the cache when offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // Stale-while-revalidate for third-party CDN assets (fonts, icon library,
  // Supabase client) - these don't change on our deploys, so serving the
  // cached copy immediately and refreshing in the background is fine.
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback logic here if needed
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Push notification received from the server (task escalated to Amber/Red)
self.addEventListener('push', (event) => {
  let data = { title: 'Bokeà', body: 'A task needs your attention.', url: '/' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/icon.svg',
      badge: '/assets/icon.svg',
      data: { url: data.url || '/' }
    })
  );
});

// Focus/open the app when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

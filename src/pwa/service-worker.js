/* Only this explicit, public allowlist is persisted. Never cache application/API responses. */
const CACHE = 'saathi-public-__PWA_REVISION__';
const PUBLIC_FILES = [
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_FILES)));
  // Updates wait for existing tabs to close; never reload a form without consent.
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(
        names
          .filter((name) => name.startsWith('saathi-public-') && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    }),
  );
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // APIs, including navigations directly to /api, always use the network unchanged.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const fallback = await caches.match('/offline.html', { cacheName: CACHE });
        return fallback || Response.error();
      }),
    );
  } else if (PUBLIC_FILES.includes(url.pathname) && !url.search) {
    event.respondWith(
      caches.match(request, { cacheName: CACHE }).then((cached) => cached || fetch(request)),
    );
  }
});

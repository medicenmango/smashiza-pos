/* ═══════════════════════════════════════
   SERVICE WORKER — La Smashiza POS
   Permite uso offline básico
════════════════════════════════════════ */

const CACHE_NAME = 'smashiza-pos-v20';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './src/main.js',
  './src/constants.js',
  './src/state.js',
  './src/utils/format.js',
  './src/ui/toast.js',
  './src/ui/clock.js',
  './src/domain/menu.js',
  './src/domain/catalog.js',
  './src/domain/orders.js',
  './src/domain/inventory.js',
  './src/storage/index.js',
  './src/storage/events.js',
  './src/storage/excel.js',
  './src/features/setup.js',
  './src/features/nav.js',
  './src/features/nueva-orden.js',
  './src/features/ticket.js',
  './src/features/ordenes.js',
  './src/features/dashboard.js',
  './src/features/menu-editor.js',
  './src/features/clientes.js',
  './src/features/inventario.js',
  './src/features/analisis.js',
  './manifest.json',
  './demo-data.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Share+Tech+Mono&family=Roboto:wght@400;700&display=swap',
];

// INSTALL: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('SW: some assets failed to cache', err);
      });
    })
  );
  self.skipWaiting();
});

// ACTIVATE: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH: cache-first strategy
self.addEventListener('fetch', e => {
  // Skip non-GET and cross-origin file writes
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful responses
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML navigation
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

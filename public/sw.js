const CACHE_NAME = 'album-stickers-v1';
const IMAGE_CACHE = 'sticker-images-v1';

// Ativos básicos do app para cache inicial
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Estratégia especial para imagens (Stickers)
  // Se for uma imagem do Picsum ou qualquer link externo de figurinha
  if (request.destination === 'image' || url.hostname.includes('picsum.photos')) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((response) => {
          // Retorna do cache se existir, senão busca na rede e salva no cache
          return response || fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
            // Se falhar a rede e não tiver no cache, retorna nada ou uma imagem placeholder
            return response;
          });
        });
      })
    );
    return;
  }

  // Estratégia padrão para outros arquivos: Cache First, fallback to Network
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});

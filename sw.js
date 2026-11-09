const CACHE_NAME = 'tea-workshop-offline-v3';
const CORE_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest'
];
const VIDEO_FILES = [
  './assets/breathing-dots.mp4',
  './assets/five-rings.mp4'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cachedVideoResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request.url);
  if (!cached) return fetch(request);

  const range = request.headers.get('range');
  if (!range) return cached;

  const bytes = await cached.arrayBuffer();
  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) return new Response(null, { status: 416 });

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : bytes.byteLength - 1;
  const end = Math.min(requestedEnd, bytes.byteLength - 1);
  if (start >= bytes.byteLength || start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${bytes.byteLength}` }
    });
  }

  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`,
      'Content-Type': cached.headers.get('Content-Type') || 'video/mp4'
    }
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (VIDEO_FILES.some((path) => url.pathname.endsWith(path.slice(1)))) {
    event.respondWith(cachedVideoResponse(event.request));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

async function broadcast(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach((client) => client.postMessage(message));
}

async function offlineReady() {
  const cache = await caches.open(CACHE_NAME);
  const matches = await Promise.all(VIDEO_FILES.map((file) => cache.match(file)));
  return matches.every(Boolean);
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_OFFLINE_STATUS') {
    event.waitUntil(
      offlineReady().then((ready) => event.source?.postMessage({ type: 'OFFLINE_STATUS', ready }))
    );
    return;
  }

  if (event.data?.type === 'CACHE_OFFLINE_CONTENT') {
    event.waitUntil((async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        for (let index = 0; index < VIDEO_FILES.length; index += 1) {
          const file = VIDEO_FILES[index];
          const response = await fetch(file, { cache: 'reload' });
          if (!response.ok) throw new Error(`Unable to download ${file}`);
          await cache.put(file, response);
          await broadcast({ type: 'OFFLINE_PROGRESS', completed: index + 1, total: VIDEO_FILES.length });
        }
        await broadcast({ type: 'OFFLINE_READY' });
      } catch {
        await broadcast({ type: 'OFFLINE_ERROR' });
      }
    })());
  }
});

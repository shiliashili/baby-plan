/* 柚柚今天学什么 · 离线缓存（GitHub Pages 子路径安全：全部用相对路径） */
const CACHE = 'yoyo-v1';
const ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/quotes.js',
  './js/core.js',
  './js/baby-plan.js',
  './js/ui.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // 逐个添加：某个资源 404 不会让整批预缓存失败
      Promise.all(ASSETS.map((u) => c.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* 网络优先、失败回落缓存：保证更新及时，同时离线可用 */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});

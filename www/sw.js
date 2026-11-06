// Service worker: permite instalar la versión web y jugar offline (1 jugador / práctica)
const CACHE = 'fiesta-estelar-v1';
const FILES = ['./', './index.html', './css/style.css', './manifest.json', './lib/peerjs.min.js', './config.js', './icons/icon-192.png',
  './js/main.js', './js/engine.js', './js/boards.js', './js/data.js', './js/util.js', './js/ai.js', './js/mgmeta.js', './js/minigames.js', './js/render.js', './js/net.js', './js/audio.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});

// Offline cache: the app works in class even without reception.
const CACHE = 'noa-planner-v3';
const FILES = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/planparse.js', 'js/pdftext.js',
  'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs', 'manifest.webmanifest',
  'fonts/varela-round-hebrew-400-normal.woff2', 'fonts/varela-round-latin-400-normal.woff2',
  'fonts/rubik-hebrew-400-normal.woff2', 'fonts/rubik-hebrew-500-normal.woff2', 'fonts/rubik-hebrew-700-normal.woff2',
  'fonts/rubik-latin-400-normal.woff2', 'fonts/rubik-latin-500-normal.woff2', 'fonts/rubik-latin-700-normal.woff2',
  'icons/icon-192.png', 'icons/apple-touch-icon.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// network first (so updates arrive), cache as fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

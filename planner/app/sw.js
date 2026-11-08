// Offline cache: the app works in class even without reception.
const CACHE = 'noa-planner-v34';
const FILES = [
  './', 'index.html', 'css/style.css', 'css/luxe.css', 'fonts/assistant-hebrew-200-normal.woff2', 'fonts/varela-round-hebrew-400-normal.woff2', 'fonts/playpen-sans-hebrew-hebrew-300-normal.woff2', 'fonts/playpen-sans-hebrew-hebrew-400-normal.woff2', 'fonts/assistant-hebrew-300-normal.woff2', 'fonts/assistant-hebrew-400-normal.woff2', 'fonts/assistant-hebrew-600-normal.woff2', 'img/night.jpg', 'fonts/heebo-hebrew-300-normal.woff2', 'js/app.js', 'js/planparse.js', 'js/pdftext.js', 'js/icons.js', 'js/files.js', 'js/genparse.js', 'js/toolkit.js', 'js/printweek.js', 'js/parentmsg.js', 'vendor/identity.mjs',
  'vendor/pdf.min.mjs', 'vendor/keepawake.mp4', 'vendor/pdf.worker.min.mjs', 'manifest.webmanifest',
  'fonts/heebo-hebrew-400-normal.woff2', 'fonts/heebo-hebrew-500-normal.woff2', 'fonts/heebo-hebrew-700-normal.woff2',
  'fonts/heebo-latin-400-normal.woff2', 'fonts/heebo-latin-500-normal.woff2', 'fonts/heebo-latin-700-normal.woff2',
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
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/.netlify/')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// reminders sent by the server (see netlify/functions/notify.mts)
self.addEventListener('push', e => {
  let n = {};
  try { n = e.data ? e.data.json() : {}; } catch { n = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(n.title || 'הכיתה שלי', {
    body: n.body || '', tag: n.tag || undefined, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { url: n.url || './' }, lang: 'he', dir: 'rtl',
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const url = e.notification.data && e.notification.data.url || './';
    for (const c of list) if ('focus' in c) return c.focus().then(w => (url !== './' && w && 'navigate' in w ? w.navigate(url) : w));
    return self.clients.openWindow(url);
  }));
});

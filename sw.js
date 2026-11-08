/* Pulse service worker — network-first so the app is always fresh when online,
   and still opens (from cache) when offline. Bump CACHE on each release. */
const CACHE = 'pulse-v77-5';
const SHELL = ['./', './index.html', './manifest.webmanifest', './pulse-192.png', './pulse-512.png', './pulse-maskable-512.png', './pulse-apple-touch.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // don't touch Firebase writes etc.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // only cache our own assets (not Firebase/gstatic)
  e.respondWith(
    fetch(req).then(res => {
      // V75.6: keep only good answers, so an error page never replaces the app offline
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

/* V74: tapping a deadline reminder opens Pulse (or brings it forward) */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  // V75.6: only ever open a page of this site
  let target = new URL('./', self.location.href).href;
  try {
    const u = new URL((e.notification.data && e.notification.data.url) || './', self.location.href);
    if (u.origin === self.location.origin) target = u.href;
  } catch (_) {}
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow ? self.clients.openWindow(target) : null;
    })
  );
});

/* V74.3: the 9 am deadline reminder, sent by .github/workflows/daily-reminders.yml */
self.addEventListener('push', e => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = j.data || j.notification || j || {}; } catch (_) {}
  const opts = { body: d.body || '', icon: 'pulse-192.png', badge: 'pulse-192.png',
                 tag: d.tag || 'sahkar-daily', renotify: true, data: { url: d.url || './' } };
  e.waitUntil(
    self.registration.showNotification(d.title || 'Pulse', opts).then(() => {
      if (d.count && self.navigator && self.navigator.setAppBadge) return self.navigator.setAppBadge(+d.count).catch(() => {});
    })
  );
});

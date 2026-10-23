/* Service worker — caché simple de la shell; los datos siempre frescos */
var CACHE = 'activate-v1';
var SHELL = ['.', 'index.html', 'styles.css', 'config.js',
             'js/app.js', 'js/docente.js', 'js/familia.js', 'js/estudiante.js',
             'vendor/supabase-js.js', 'icon.svg', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  if (url.indexOf('supabase.co') !== -1) return;            // datos siempre de la red
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        var copia = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
        return res;
      });
    })
  );
});

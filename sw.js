/* ============================================================
   sw.js — Service Worker

   Hace dos cosas:
   1. Guarda los archivos de la app en el teléfono, así abre
      instantáneo y funciona sin internet.
   2. Deja pasar de largo todo lo que va a Supabase: los datos
      SIEMPRE se piden a la red, nunca se sirven cacheados
      (si no, tu tío vería tareas viejas).

   ⚠️ Cada vez que cambies algo del código, subile el número a
   VERSION. Eso obliga a los teléfonos a bajar la versión nueva.
   ============================================================ */

var VERSION = 'dona-v2';

var ARCHIVOS = [
  './',
  './index.html',
  './css/estilos.css',
  './js/config.js',
  './js/db.js',
  './js/arbol.js',
  './js/dona.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(ARCHIVOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (claves) {
      return Promise.all(claves.map(function (k) {
        if (k !== VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Datos y login: siempre a la red, sin cache.
  if (url.hostname.indexOf('supabase') >= 0) return;

  // Navegación: intento red primero, y si no hay, sirvo lo cacheado.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // Resto (css, js, íconos, fuentes): cache primero, red de respaldo.
  e.respondWith(
    caches.match(e.request).then(function (guardado) {
      return guardado || fetch(e.request).then(function (resp) {
        if (resp.ok && url.origin === location.origin) {
          var copia = resp.clone();
          caches.open(VERSION).then(function (c) { c.put(e.request, copia); });
        }
        return resp;
      });
    })
  );
});

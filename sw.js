// Service worker: deja la app disponible sin señal.
// Estrategia: primero la red (para que siempre llegue la última versión) y,
// si no hay señal, lo guardado. Las llamadas al Apps Script nunca se guardan.

const CACHE = "saifo-campo-v3";
const ARCHIVOS = ["./", "./index.html", "./styles.css", "./app.js", "./config.js", "./manifest.json", "./icons/hallo-logo.svg"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copia));
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

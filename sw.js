// Service worker mínimo: deja la app (HTML/CSS/JS) disponible sin señal.
// Las llamadas al Apps Script (catálogos y envíos) siempre van a la red:
// eso lo maneja app.js con su propia cola local, no este archivo.

const CACHE = "saifo-campo-v1";
const ARCHIVOS = [
"./",
"./index.html",
"./styles.css",
"./app.js",
"./config.js",
"./manifest.json"
];

self.addEventListener("install", event => {
event.waitUntil(
caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting())
);
});

self.addEventListener("activate", event => {
event.waitUntil(
caches.keys().then(nombres =>
Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n)))
).then(() => self.clients.claim())
);
});

self.addEventListener("fetch", event => {
const url = new URL(event.request.url);
// Nunca cachear llamadas al backend (Apps Script / google.com): siempre red.
if (url.origin.indexOf("google.com") !== -1 || url.origin.indexOf("googleusercontent") !== -1) {
return;
}
event.respondWith(
caches.match(event.request).then(cached => cached || fetch(event.request))
);
});

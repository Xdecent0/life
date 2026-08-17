// Network first, cache as the fallback — the same rule the kitchen uses, and for
// the same reason: a cache that answers first forever is how a deployed fix
// never reaches the phone.

const CACHE = "places-v1";

const SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.js",
  "./manifest.webmanifest",
  "./lib/model.js",
  "./lib/store.js",
  "./screens/places.js",
  "./screens/place.js",
  "./screens/settings.js",
  "../../design/app.css",
  "../../core/app.js",
  "../../core/shell.js",
  "../../core/dom.js",
  "../../core/icons.js",
  "../../core/state.js",
  "../../core/store.js",
  "../../core/sync.js",
  "../../core/github.js",
  "../../core/time.js",
  "../../core/money.js",
  "../../core/vault.js",
  "../../core/log.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit ?? caches.match("./index.html")))
  );
});

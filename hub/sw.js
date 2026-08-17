// The hub's shell. Network first, cache as the fallback — the same rule the
// kitchen uses, and for the same reason: a cache that answers first forever is
// how a deployed fix never reaches the phone.

const CACHE = "hub-v1";

const SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "../design/app.css",
  "../core/app.js",
  "../core/dom.js",
  "../core/icons.js",
  "../core/registry.js",
  "../core/github.js",
  "../core/log.js",
  "../core/qr.js",
  "../core/pair.js",
  "../core/install.js",
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

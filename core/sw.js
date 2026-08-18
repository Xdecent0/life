// The offline behaviour, once, for every app.
//
// There were five of these files. They differed by a cache name and by which
// of the kitchen's hard-won details each copy happened to have — the newer
// three had none of them. Five near-identical workers also mean five version
// numbers to raise on every release, and the one that gets forgotten leaves a
// person running last week's code inside an app that looks current.
//
// So: one version here, one behaviour here, and each app contributes the only
// thing that is actually its own — the list of files it is made of.

/* Raised once, for all of them. The cache name carries the app key too, so the
   four apps do not evict each other while sharing an origin. */
const VERSION = "v44";

/* Long enough that a working connection nearly always wins the race, short
   enough that a shop doorway does not feel broken. navigator.onLine stays true
   on one bar, so "offline" never fires and every shell file would otherwise
   hang until the network gave up — a white screen with a perfectly good copy
   already in the cache. */
const PATIENCE = 1500;

/**
 * Wire up an app's worker.
 *
 * @param {object} opts
 * @param {string} opts.key    the app's key — becomes the cache name
 * @param {string[]} opts.shell  every file the app needs to open with no network
 */
self.life = { serve };

function serve({ key, shell }) {
  const CACHE = `${key}-${VERSION}`;

  self.addEventListener("install", (e) => {
    e.waitUntil(
      caches
        .open(CACHE)
        // reload skips the HTTP cache, so a fresh install never seeds itself stale.
        .then((c) => c.addAll(shell.map((url) => new Request(url, { cache: "reload" }))))
        .then(() => self.skipWaiting())
    );
  });

  self.addEventListener("activate", (e) => {
    e.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            // Only this app's own old caches: the other three are sharing the
            // origin and are none of our business.
            keys.filter((k) => k !== CACHE && k.startsWith(`${key}-`)).map((k) => caches.delete(k))
          )
        )
        .then(() => self.clients.claim())
    );
  });

  self.addEventListener("fetch", (e) => {
    const { request } = e;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== location.origin) return;

    // A plain fetch() here still goes through the HTTP cache, and GitHub Pages
    // serves max-age=600 — so the worker would happily hand back ten-minute-old
    // code it never asked the server about. "no-cache" revalidates by ETag: a
    // 304 when nothing changed, the new file the moment something did.
    const network = fetch(new Request(request, { cache: "no-cache" })).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    });

    network.catch(() => {});

    e.respondWith(
      Promise.race([
        network,
        new Promise((resolve) => setTimeout(resolve, PATIENCE)).then(() =>
          caches.match(request).then((hit) => hit ?? network)
        ),
      ]).catch(() => caches.match(request).then((hit) => hit ?? caches.match("./index.html")))
    );
  });

  self.addEventListener("message", (e) => {
    if (e.data === "skipWaiting") self.skipWaiting();
  });
}

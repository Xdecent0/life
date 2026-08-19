// What the hub is made of. The behaviour lives in core/sw.js.
//
// It carries the four manifests, because the hub runs their sync rounds: a
// manifest is the only place that says which files an app writes and how each
// one merges.

importScripts("../core/sw.js");

life.serve({
  key: "hub",
  shell: [
    "./",
    "./index.html",
    "./app.js",
    "./panels.js",
    "./keys.js",
    "./lib/dash.js",
    "./manifest.webmanifest",
    "../design/app.css",
    "../design/hub.css",
    "../core/app.js",
    "../core/dom.js",
    "../core/icons.js",
    "../core/registry.js",
    "../core/github.js",
    "../core/log.js",
    "../core/qr.js",
    "../core/pair.js",
    "../core/install.js",
    "../core/time.js",
    "../core/sync.js",
    "../core/state.js",
    "../core/store.js",
    "../core/money.js",
    "../core/vault.js",
    "../apps/kitchen/manifest.js",
    "../apps/kitchen/lib/store.js",
    "../apps/kitchen/lib/model.js",
    "../apps/things/manifest.js",
    "../apps/things/lib/store.js",
    "../apps/things/lib/model.js",
    "../apps/clean/manifest.js",
    "../apps/clean/lib/store.js",
    "../apps/clean/lib/model.js",
    "../apps/places/manifest.js",
    "../apps/places/lib/store.js",
    "../apps/places/lib/model.js",
    "../apps/projects/manifest.js",
    "../apps/projects/lib/model.js",
  ],
});

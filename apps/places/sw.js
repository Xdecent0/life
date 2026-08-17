// What Места are made of. The behaviour lives in core/sw.js.

importScripts("../../core/sw.js");

life.serve({
  key: "places",
  shell: [
    "./",
    "./index.html",
    "./app.js",
    "./manifest.js",
    "./manifest.webmanifest",
    "./lib/model.js",
    "./lib/store.js",
    "./screens/places.js",
    "./screens/place.js",
    "./screens/togo.js",
    "./screens/settings.js",
    "../../design/app.css",
    "../../design/places.css",
    "../../core/app.js",
    "../../core/shell.js",
    "../../core/dom.js",
    "../../core/icons.js",
    "../../core/state.js",
    "../../core/store.js",
    "../../core/sync.js",
    "../../core/github.js",
    "../../core/time.js",
    "../../core/vault.js",
    "../../core/log.js",
    "../../core/registry.js",
    "../../core/reach.js",
    "../../core/keys.js",
    "../../core/health.js",
    "../../core/screens/card.js",
    "../../core/screens/settings.js",
  ],
});

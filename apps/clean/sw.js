// What Уборка is made of. The behaviour lives in core/sw.js.

importScripts("../../core/sw.js");

life.serve({
  key: "clean",
  shell: [
    "./",
    "./index.html",
    "./app.js",
    "./manifest.js",
    "./manifest.webmanifest",
    "./lib/model.js",
    "./lib/store.js",
    "./screens/today.js",
    "./screens/map.js",
    "./screens/rooms.js",
    "./screens/spot.js",
    "./screens/settings.js",
    "../../design/app.css",
    "../../design/clean.css",
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
    "../../core/screens/card.js",
    "../../core/screens/settings.js",
  ],
});

// What the hub is made of. The behaviour lives in core/sw.js.

importScripts("../core/sw.js");

life.serve({
  key: "hub",
  shell: [
    "./",
    "./index.html",
    "./app.js",
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
  ],
});

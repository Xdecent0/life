// What Проекты are made of. The behaviour lives in core/sw.js.

importScripts("../../core/sw.js");

life.serve({
  key: "projects",
  shell: [
    "./",
    "./index.html",
    "./app.js",
    "./manifest.js",
    "./manifest.webmanifest",
    "./lib/model.js",
    "./lib/store.js",
    "./screens/projects.js",
    "./screens/project.js",
    "./screens/settings.js",
    "../../design/app.css",
    "../../design/projects.css",
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
    "../../core/screens/settings.js",
  ],
});

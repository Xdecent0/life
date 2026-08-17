// What Проекты are made of. The behaviour lives in core/sw.js.
//
// Своих стилей и экранов у него нет: index.html — это доска проектов из волта,
// перенесённая файлом, со стилями внутри себя.

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
    "../../core/app.js",
    "../../core/state.js",
    "../../core/store.js",
    "../../core/sync.js",
    "../../core/github.js",
    "../../core/time.js",
    "../../core/log.js",
  ],
});
